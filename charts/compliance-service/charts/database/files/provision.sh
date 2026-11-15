#!/bin/sh
# File: charts/compliance-service/charts/database/files/provision.sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${COMPLIANCE_RUNTIME_USER:?COMPLIANCE_RUNTIME_USER is required}"
: "${COMPLIANCE_RUNTIME_PASSWORD:?COMPLIANCE_RUNTIME_PASSWORD is required}"
export COMPLIANCE_RUNTIME_USER COMPLIANCE_RUNTIME_PASSWORD

case "$PGHOST" in
  localhost|localhost.*|127.*|::1|'[::1]'|/*)
    echo 'Use a network database hostname with password authentication; local PostgreSQL connections may trust all users.' >&2
    exit 1
    ;;
  *)
    :
    ;;
esac

if [ "$PGUSER" = "$COMPLIANCE_RUNTIME_USER" ]; then
  echo 'PostgreSQL administrator and runtime identities must differ.' >&2
  exit 1
fi

unsafe_auth=$(psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only <<'SQL'
SELECT EXISTS (
  SELECT 1 FROM pg_hba_file_rules
  WHERE error IS NOT NULL OR (type LIKE 'host%' AND auth_method = 'trust')
) OR COALESCE(inet_client_addr() <<= '127.0.0.0/8'::cidr
              OR inet_client_addr() <<= '::1/128'::cidr, true);
SQL
)
if [ "$unsafe_auth" != f ]; then
  echo 'PostgreSQL host trust rules or a loopback connection prevent reliable credential verification.' >&2
  exit 1
fi

role_state=$(psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only <<'SQL'
\getenv runtime_user COMPLIANCE_RUNTIME_USER
SELECT COALESCE((
  SELECT CASE WHEN rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
    AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datdba = r.oid AND datname <> current_database())
    THEN 'valid' ELSE 'invalid' END
  FROM pg_roles r WHERE rolname = :'runtime_user'
), 'missing');
SQL
)
if [ "$role_state" = invalid ]; then
  echo 'Existing PostgreSQL runtime role is overprivileged or has conflicting ownership; reconcile it before provisioning.' >&2
  exit 1
fi
if [ "$role_state" != valid ] && [ "$role_state" != missing ]; then
  echo 'Could not determine PostgreSQL runtime role state.' >&2
  exit 1
fi

schema_exists=$(psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only \
  -c "SELECT to_regnamespace('public') IS NOT NULL")
if [ "$schema_exists" != t ]; then
  echo 'The PostgreSQL public schema is missing; reconcile the database before provisioning.' >&2
  exit 1
fi

foreign_objects=$(psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only <<'SQL'
\getenv runtime_user COMPLIANCE_RUNTIME_USER
SELECT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
    AND pg_get_userbyid(c.relowner) <> :'runtime_user'
);
SQL
)
if [ "$foreign_objects" != f ]; then
  echo 'Existing PostgreSQL schema objects are not owned by the runtime role; recover or explicitly reset the database.' >&2
  exit 1
fi

verify_runtime_password() {
  if PGUSER="$COMPLIANCE_RUNTIME_USER" PGPASSWORD="${COMPLIANCE_RUNTIME_PASSWORD}-invalid" \
      psql -X --no-psqlrc --set ON_ERROR_STOP=1 --quiet -c 'SELECT 1' >/dev/null 2>&1; then
    echo 'PostgreSQL accepted an incorrect runtime password; refusing to provision with insecure authentication.' >&2
    exit 1
  fi
  if ! PGUSER="$COMPLIANCE_RUNTIME_USER" PGPASSWORD="$COMPLIANCE_RUNTIME_PASSWORD" \
      psql -X --no-psqlrc --set ON_ERROR_STOP=1 --quiet -c 'SELECT 1' >/dev/null; then
    echo 'Existing PostgreSQL runtime credentials failed authentication; no password was rotated.' >&2
    exit 1
  fi
}

if [ "$role_state" = valid ]; then
  verify_runtime_password
else
  {
    printf '%s\n' 'CREATE TEMP TABLE runtime_secret (encoded text);' 'COPY runtime_secret FROM STDIN;'
    printf '%s' "$COMPLIANCE_RUNTIME_PASSWORD" | base64 | tr -d '\n'
    printf '\n\\.\n'
    cat <<'SQL'
\getenv runtime_user COMPLIANCE_RUNTIME_USER
SELECT set_config('dsap.runtime_user', :'runtime_user', false);
DO $block$
DECLARE
  runtime_user text := current_setting('dsap.runtime_user');
  runtime_password text := (SELECT convert_from(decode(encoded, 'base64'), 'UTF8') FROM runtime_secret);
BEGIN
  EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
                 runtime_user, runtime_password);
END
$block$;
SQL
  } | psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only
fi

psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only <<'SQL'
\getenv runtime_user COMPLIANCE_RUNTIME_USER
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_user')
\gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'runtime_user')
\gexec
SQL
verify_runtime_password
echo 'PostgreSQL compliance runtime role verified.'
