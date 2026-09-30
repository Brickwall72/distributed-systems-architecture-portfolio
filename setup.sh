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

# Centralized Shell Profile Selection
if [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
  readonly TARGET_PROFILE="$HOME/.zshrc"
else
  readonly TARGET_PROFILE="$HOME/.bashrc"
fi
echo "Target Shell Profile: ${TARGET_PROFILE}"

# --- STEP 1: SYSTEM PREREQUISITES & PACKAGE MANAGER BOOTSTRAP ---
echo "Auditing system dependencies and package manager..."

if [[ "${OS_TYPE}" == "Linux" ]]; then
  echo "Auditing shared system libraries and Linuxbrew build dependencies..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update -o Acquire::RaiseOnError=false -y || true
    sudo apt-get install -y libatomic1 build-essential procps curl file git
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y libatomic procps curl file git make automake gcc gcc-c++
  elif command -v yum &> /dev/null; then
    sudo yum install -y libatomic procps curl file git make automake gcc gcc-c++
  else
    echo "ERROR: Unsupported Linux package manager." >&2
    exit 1
  fi
  
  # Verify libatomic dependency (Linux only)
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
  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "brew shellenv" "${TARGET_PROFILE}"; then
    echo "Injecting Homebrew shell alignment hook into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo '# Homebrew Environment Alignment' >> "${TARGET_PROFILE}"
    echo 'eval "$($(brew --prefix)/bin/brew shellenv)"' >> "${TARGET_PROFILE}"
  fi
fi

echo "✓ Homebrew verified and active ($(brew --version | head -n1))"

# --- STEP 2: CROSS-PLATFORM BROWSER SETUP (Puppeteer Gate) ---
echo "Verifying system browser for Puppeteer test suites..."
if [[ "${OS_TYPE}" == "Linux" ]]; then
  if command -v apt-get &> /dev/null; then
    sudo apt-get install -y chromium-browser
  elif command -v dnf &> /dev/null; then
    sudo dnf install -y chromium
  elif command -v yum &> /dev/null; then
    sudo yum install -y chromium
  fi
  
  export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "PUPPETEER_EXECUTABLE_PATH" "${TARGET_PROFILE}"; then
    echo "Injecting Puppeteer system executable path into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo '# Puppeteer System Browser Binding' >> "${TARGET_PROFILE}"
    echo 'export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"' >> "${TARGET_PROFILE}"
  fi
elif [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
  if [[ -d "/Applications/Google Chrome.app" ]]; then
    echo "✓ Google Chrome application bundle already present in /Applications."
  elif brew list --cask google-chrome &>/dev/null || command -v google-chrome &>/dev/null; then
    echo "✓ Google Chrome cask already registered."
  else
    echo "Installing Google Chrome cask via Homebrew..."
    brew install --cask google-chrome
  fi

  # Self-Healing: Strip macOS quarantine attribute to prevent headless test startup hangs
  if [[ -d "/Applications/Google Chrome.app" ]]; then
    echo "Clearing macOS Gatekeeper quarantine flags for Puppeteer compatibility..."
    sudo xattr -rd com.apple.quarantine "/Applications/Google Chrome.app" 2>/dev/null || true
  fi
  
  export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "PUPPETEER_EXECUTABLE_PATH" "${TARGET_PROFILE}"; then
    echo "Injecting Puppeteer system executable path into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo '# Puppeteer System Browser Binding' >> "${TARGET_PROFILE}"
    echo 'export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"' >> "${TARGET_PROFILE}"
  fi
fi

# --- STEP 3: SELF-HEALING DOCKER ENGINE GATE ---
echo "Verifying local container engine status..."
if command -v docker &> /dev/null; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | sed 's/,//')
  echo "✓ Docker Engine is already active on this host machine (v${DOCKER_VER})"
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
fi

# --- STEP 4: CLUSTER & DEVOPS TOOLING GATE (Kubectl, K3d, Skaffold) ---
echo "Verifying Kubernetes & DevOps toolchain (kubectl, k3d, skaffold)..."
for tool in kubectl k3d skaffold; do
  if ! command -v "${tool}" &> /dev/null; then
    echo "Installing ${tool} via Homebrew..."
    brew install "${tool}"
  else
    echo "✓ ${tool} is already installed."
  fi
done

# --- STEP 5: SELF-HEALING NODE.JS RUNTIME GATE ---
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

  if [[ -f "${TARGET_PROFILE}" ]] && ! grep -q "nvm use default" "${TARGET_PROFILE}"; then
    echo "Injecting automated NVM runtime shell alignment hooks into user profile..."
    echo "" >> "${TARGET_PROFILE}"
    echo "# Automated Microservice Runtime Alignment Hook" >> "${TARGET_PROFILE}"
    echo "nvm use default --silent" >> "${TARGET_PROFILE}"
  fi
fi

# --- STEP 6: NATIVE PACKAGE MANAGER PROXY SETUP ---
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

# --- STEP 7: WORKSPACE DEPENDENCY LINKING EXECUTION ---
echo "Executing pnpm workspace package compilation loops..."
pnpm install --frozen-lockfile --ignore-scripts
pnpm build

if [[ "${BUILD_DOCKER_BASE:-false}" == "true" ]]; then
    echo "Building shared Docker base image..."
    docker build -f Dockerfile.base -t base-image:local .
fi

echo "${DEPLOYMENT_BANNER}"
echo "✓ ENVIRONMENT SETUP COMPLETE: System is completely compilation-ready."
echo "${DEPLOYMENT_BANNER}"

# SELF-HEALING AUTOMATION: Prompt user to source the correct profile based on OS detected
if [[ "$0" == *"setup.sh"* ]]; then
  echo ""
  echo "💡 ACTION REQUIRED: To apply runtime paths to this active terminal window instantly, run:"
  if [[ "${OS_TYPE}" == "${OS_DARWIN}" ]]; then
    echo "    source ~/.zshrc"
  else
    echo "    source ~/.bashrc"
  fi
  echo "${DEPLOYMENT_BANNER}"
fi