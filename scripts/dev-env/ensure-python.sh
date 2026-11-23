#!/usr/bin/env bash

ensure_python() {
  local profile="$1"
  local python_prefix python_bin profile_line

  if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(sys.version_info < (3, 9))' >/dev/null 2>&1; then
    echo "Python 3.9 or newer is available ($(python3 --version))."
    return
  fi

  echo "Python 3.9 or newer is missing or outdated; installing Python 3.12 with Homebrew..."
  if ! brew list --versions python@3.12 >/dev/null 2>&1; then
    brew install python@3.12
  fi
  python_prefix="$(brew --prefix python@3.12)"
  python_bin="${python_prefix}/libexec/bin"
  if [[ ! -x "${python_bin}/python3" ]] || ! "${python_bin}/python3" -c 'import sys; sys.exit(sys.version_info < (3, 9))'; then
    echo "ERROR: Homebrew Python 3.12 is unavailable or does not meet the Python 3.9 minimum." >&2
    return 1
  fi
  export PATH="${python_bin}:${PATH}"

  profile_line='export PATH="$(brew --prefix python@3.12)/libexec/bin:$PATH"'
  if [[ ! -f "${profile}" ]] || ! grep -Fxq "${profile_line}" "${profile}"; then
    printf '\n# Python for local environment and secret setup\n%s\n' "${profile_line}" >> "${profile}"
  fi
  echo "Python is available ($(python3 --version)); its path was added to ${profile}."
}
