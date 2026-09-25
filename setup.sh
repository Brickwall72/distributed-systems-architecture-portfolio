#!/usr/bin/env bash

# =========================================================================
# SYSTEM INFRASTRUCTURE BOOTSTRAP SCRIPT (Self-Healing IaC Environment Gate)
# Target Environment: Node >=26.7.0 | pnpm 11.24.0 | Docker Engine Active
# Prerequisites: Git | SonarQube Audit Class: Clean A-Rating Compliance
# =========================================================================

# Strict Mode Error Handling: Terminate script if any subcommand fails or drifts
set -euo pipefail

# CONSTANT DEFINITION: Centralized string literal to satisfy duplication gates
readonly DEPLOYMENT_BANNER="================================================================="
# System OS Target Constants
readonly OS_DARWIN="Darwin"

echo "${DEPLOYMENT_BANNER}"
echo "Initializing Distributed Systems Architecture Environment Mesh..."
echo "${DEPLOYMENT_BANNER}"

# Detect the underlying host Operating System
OS_TYPE="$(uname -s)"
echo "Host Operating System Detected: ${OS_TYPE}"

# --- STEP 1: SYSTEM PREREQUISITES & HOMEBREW BOOTSTRAP ---
echo "Auditing system dependencies and package manager..."

if [[ "${OS_TYPE}" == "Linux" ]]; then
  echo "Auditing shared system libraries and Linuxbrew build requirements..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update -o Acquire::RaiseOnError=false -y || true
    sudo apt-get install -y libatomic1 build-essential procps curl file git
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y libatomic procps curl file git make automake gcc gcc-c++
  elif command -v yum &> /dev/null; then
    sudo yum install -y libatomic procps curl file git make automake gcc gcc-c++
  else
    echo "ERROR: Unsupported package manager." >&2
    exit 1
  fi
  
  # Verify libatomic dependency
  if ldconfig -p | grep -q "libatomic.so.1" || [[ -f /usr/lib/x86_64-linux-gnu/libatomic.so.1 ]] || [[ -f /usr/lib/libatomic.so.1 ]]; then
    echo "✓ Shared C-library dependency verified (libatomic.so.1)"
  else
    echo "ERROR: libatomic1 package installation failed to populate system linker paths." >&2
    exit 1
  fi
fi

# Self-Healing Homebrew Installation (Cross-Platform Consolidation)
if ! command -v brew &> /dev/null; then
  echo "Homebrew missing. Bootstrapping Homebrew from scratch..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl --proto '=https' -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Configure Brew Shell Environment paths idempotently for current session and profile
if [[ "${OS_TYPE}" == "Linux" ]]; then
  if [[ -d "/home/linuxbrew/.linuxbrew" ]]; then
    eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    TARGET_PROFILE="$HOME/.bashrc"
    if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "linuxbrew" "${TARGET_PROFILE}"; then
      echo "Injecting Linuxbrew shell alignment hook into user profile..."
      echo "" >> "${TARGET_PROFILE}"
      echo '# Homebrew Environment Alignment' >> "${TARGET_PROFILE}"
      echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> "${TARGET_PROFILE}"
    fi
  fi
elif [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
  if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  TARGET_PROFILE="$HOME/.zshrc"
  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "brew shellenv" "${TARGET_PROFILE}"; then
    echo "Injecting Homebrew shell alignment hook into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo '# Homebrew Environment Alignment' >> "${TARGET_PROFILE}"
    echo 'eval "$($(brew --prefix)/bin/brew shellenv)"' >> "${TARGET_PROFILE}"
  fi
fi

echo "✓ Homebrew verified and active ($(brew --version | head -n1))"

# --- STEP 2: SELF-HEALING DOCKER ENGINE GATE ---
echo "Verifying local container engine status..."
if command -v docker &> /dev/null; then
  if docker info &> /dev/null; then
    DOCKER_VER=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo "✓ Docker Engine is ready on this host machine (v${DOCKER_VER})"
  else
    echo "ERROR: Docker CLI is installed, but the Docker daemon is unavailable. Start Docker Desktop or the Docker Engine, then rerun setup.sh." >&2
    exit 1
  fi
else
  echo "Docker Engine missing. Initiating platform-specific installation..."
  if [[ "${OS_TYPE}" == "Linux" ]]; then
    if command -v apt-get &> /dev/null; then
      echo "Executing Ubuntu/Debian native Docker Engine compilation..."
      sudo apt-get update -o Acquire::RaiseOnError=false -y || true
      sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
      curl --proto '=https' -fsSL https://get.docker.com | sudo sh
      sudo systemctl start docker
      sudo systemctl enable docker
      sudo usermod -aG docker "${USER}"
    else
      echo "ERROR: Automated Docker setup for this Linux distribution requires manual execution." >&2
      exit 1
    fi
  elif [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
    echo "Executing macOS Homebrew Docker Desktop installation..."
    brew install --cask docker
    open /Applications/Docker.app
  else
    echo "ERROR: Automated Docker setup requires manual execution." >&2
    exit 1
  fi

  if ! docker info &> /dev/null; then
    echo "ERROR: Docker was installed, but its daemon is not ready. Start Docker, then rerun setup.sh." >&2
    exit 1
  fi
fi

# --- STEP 3: CLUSTER & DEVOPS TOOLING GATE (Kubectl, Helm, K3d, Skaffold) ---
echo "Verifying Kubernetes & DevOps toolchain (kubectl, helm, k3d, skaffold)..."
for tool in kubectl helm k3d skaffold; do
  if ! command -v "${tool}" &> /dev/null; then
    echo "Installing ${tool} via Homebrew..."
    brew install "${tool}"
  else
    echo "✓ ${tool} is already installed."
  fi
done

# --- STEP 4: SELF-HEALING NODE.JS RUNTIME GATE ---
echo "Verifying local Node.js runtime environment..."
REQUIRED_NODE_VER="26.7.0"
NODE_INSTALLED=false

if command -v node &> /dev/null && CURRENT_NODE_VER=$(node -v 2>/dev/null | sed 's/v//'); then
  if [[ "$(printf '%s\n' "${REQUIRED_NODE_VER}" "${CURRENT_NODE_VER}" | sort -V | head -n1)" == "${REQUIRED_NODE_VER}" ]]; then
    echo "✓ Host Node.js runtime environment verified (v${CURRENT_NODE_VER})"
    NODE_INSTALLED=true
  else
    echo "Outdated Node.js version detected (v${CURRENT_NODE_VER}). Upgrading environment..."
  fi
fi

if [[ "${NODE_INSTALLED}" = false ]]; then
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1090
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    source "$NVM_DIR/nvm.sh"
  else
    echo "Bootstrapping Node.js runtime manager (nvm)..."
    curl --proto '=https' -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
    source "$NVM_DIR/nvm.sh"
  fi
  [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh"
  echo "Compiling Node.js target baseline v${REQUIRED_NODE_VER}..."
  nvm install "${REQUIRED_NODE_VER}"
  nvm alias default "${REQUIRED_NODE_VER}"
  nvm use default

  # AUTOMATED PROFILE REMEDIATION: Lock system aliases dynamically based on OS type
  if [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
    TARGET_PROFILE="$HOME/.zshrc"
  else
    TARGET_PROFILE="$HOME/.bashrc"
  fi
  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "nvm use default" "${TARGET_PROFILE}"; then
    echo "Injecting automated NVM runtime shell alignment hooks into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo "# Automated Microservice Runtime Alignment Hook" >> "${TARGET_PROFILE}"
    echo "nvm use default --silent" >> "${TARGET_PROFILE}"
  fi
fi

# --- STEP 5: NATIVE PACKAGE MANAGER PROXY SETUP ---
echo "Configuring native pnpm package manager boundaries..."

if ! command -v pnpm &> /dev/null; then
  echo "Global pnpm runner missing. Bootstrapping standalone pnpm wrapper..."
  npm install -g --ignore-scripts pnpm@11.24.0
fi

if [[ "${OS_TYPE}" == "${OS_DARWIN}" ]] && command -v npm &> /dev/null; then
  GLOBAL_NVM_BIN="$(npm config get prefix)/bin/pnpm"
  SYSTEM_LINK_TARGET="/usr/local/bin/pnpm"
  
  if [[ -f "${GLOBAL_NVM_BIN}" && ! -f "${SYSTEM_LINK_TARGET}" ]]; then
    echo "Injecting cross-platform system symlink wrapper for macOS shell mapping..."
    sudo ln -s "${GLOBAL_NVM_BIN}" "${SYSTEM_LINK_TARGET}"
  fi
fi

pnpm setup --force

# --- STEP 6: WORKSPACE DEPENDENCY LINKING EXECUTION ---
echo "Executing pnpm workspace package compilation loops..."
pnpm install --frozen-lockfile --ignore-scripts
pnpm build

if [[ "${BUILD_DOCKER_BASE:-false}" == "true" ]]; then
    echo "Building shared Docker base image..."
    docker build -f Dockerfile.base -t base-image:local .
fi

echo "${DEPLOYMENT_BANNER}"
echo "✓ ENVIRONMENT SETUP COMPLETE: System tooling and dependencies are configured."
echo "${DEPLOYMENT_BANNER}"

# SELF-HEALING AUTOMATION: If running as a child process, prompt the user for the parent injection
if [[ "$0" == *"setup.sh"* ]]; then
  echo ""
  echo "💡 ACTION REQUIRED: To apply Node v26.7.0 and PATH alignment to this active terminal window instantly, run:"
  if [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
    echo "    source ~/.zshrc"
  else
    echo "    source ~/.bashrc"
  fi
  echo "${DEPLOYMENT_BANNER}"
fi