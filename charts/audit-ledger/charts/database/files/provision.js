// File: charts/audit-ledger/charts/database/files/provision.js
// Run with mongosh authenticated as an administrator against the audit server.
const username = process.env.AUDIT_RUNTIME_USER;
const password = process.env.AUDIT_RUNTIME_PASSWORD;
const databaseName = process.env.AUDIT_DATABASE;
const host = process.env.AUDIT_MONGO_HOST;
const port = process.env.AUDIT_MONGO_PORT;

if (!username || !password || !databaseName || !host || !/^[a-zA-Z0-9.-]+$/.test(host)
    || !port || /^\d+$/.test(port) === false || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('AUDIT_RUNTIME_USER, AUDIT_RUNTIME_PASSWORD, AUDIT_DATABASE, valid AUDIT_MONGO_HOST and AUDIT_MONGO_PORT are required');
}
if (databaseName === 'admin' || databaseName === 'local' || databaseName === 'config') {
  throw new Error('The audit database must not be a MongoDB system database');
}

const auditDb = db.getSiblingDB(databaseName);
const adminDb = db.getSiblingDB('admin');
const roleName = 'dsapAuditRuntime';
const privilege = (collection, actions) => ({
  resource: { db: databaseName, collection },
  actions,
});
const privileges = [
  privilege('', ['listCollections']),
  privilege('events', ['find', 'insert', 'listIndexes']),
  privilege('sealed_transfers', ['find', 'insert', 'listIndexes']),
  privilege('dead_letters', ['find', 'insert', 'listIndexes']),
  privilege('drafts', ['find', 'insert', 'update', 'createIndex']),
  privilege('transfer_renditions', ['find', 'insert', 'update', 'createIndex']),
];

function normalizedPrivileges(items) {
  const actionOrder = ['find', 'insert', 'update', 'listIndexes', 'createIndex', 'listCollections'];
  const compareActions = (left, right) => actionOrder.indexOf(left) - actionOrder.indexOf(right);
  return items
    .map(({ resource, actions }) => ({
      db: resource.db,
      collection: resource.collection,
      actions: [...actions].sort(compareActions),
    }))
    .sort((left, right) => left.collection.localeCompare(right.collection));
}

const existingRole = auditDb.getRole(roleName, { showPrivileges: true });
const existingUser = adminDb.getUser(username);
if (existingRole && (
  existingRole.roles.length !== 0 ||
  JSON.stringify(normalizedPrivileges(existingRole.privileges)) !== JSON.stringify(normalizedPrivileges(privileges))
)) {
  throw new Error(`Existing MongoDB role ${databaseName}.${roleName} conflicts with the expected privileges`);
}
if (existingUser && (
  !existingRole ||
  existingUser.roles.length !== 1 ||
  existingUser.roles[0].role !== roleName ||
  existingUser.roles[0].db !== databaseName
)) {
  throw new Error(`Existing MongoDB user ${username} conflicts with the expected runtime role`);
}

function verifyRuntimeCredentials() {
  const uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/admin?authSource=admin`;
  const runtimeConnection = new Mongo(uri);
  const authInfo = runtimeConnection.getDB('admin').runCommand({ connectionStatus: 1 });
  if (!authInfo.ok || !authInfo.authInfo.authenticatedUsers.some((user) => user.user === username && user.db === 'admin')) {
    throw new Error(`MongoDB runtime authentication failed for ${username}; credentials were not rotated`);
  }
}

if (existingUser) verifyRuntimeCredentials();

for (const name of ['events', 'sealed_transfers', 'dead_letters']) {
  if (auditDb.getCollectionInfos({ name }).length > 0
      && auditDb.getCollection(name).getIndexes().some((index) => index.expireAfterSeconds !== undefined)) {
    throw new Error(`MongoDB collection ${name} has a TTL index; reconcile it before provisioning`);
  }
}
auditDb.events.createIndex({ eventId: 1 }, { unique: true });
auditDb.events.createIndex({ requisitionNumber: 1 });
auditDb.sealed_transfers.createIndex({ sequence: 1 }, { unique: true });
auditDb.sealed_transfers.createIndex({ requisitionNumber: 1 }, { unique: true });
auditDb.dead_letters.createIndex({ receivedAt: -1 });

if (!existingRole) {
  auditDb.createRole({ role: roleName, privileges, roles: [] });
}
if (!existingUser) {
  adminDb.createUser({ user: username, pwd: password, roles: [{ role: roleName, db: databaseName }] });
  verifyRuntimeCredentials();
}

print(`MongoDB audit runtime role and user verified for ${databaseName}.`);
