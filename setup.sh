#!/usr/bin/env bash

# =========================================================================
# SYSTEM INFRASTRUCTURE BOOTSTRAP SCRIPT (Self-Healing IaC Environment Gate)
# Target Environment: Node >=26.7.0 | pnpm 11.22.0 | Docker Engine Active
# Prerequisites: Git | SonarQube Audit Class: Clean A-Rating Compliance
# =========================================================================

# Strict Mode Error Handling: Terminate script if any subcommand fails or drifts
set -euo pipefail

# CONSTANT DEFINITION: Centralized string literal to satisfy duplication gates
readonly DEPLOYMENT_BANNER="================================================================="

echo "${DEPLOYMENT_BANNER}"
echo "Initializing Distributed Systems Architecture Environment Mesh..."
echo "${DEPLOYMENT_BANNER}"

# Detect the underlying host Operating System
OS_TYPE="$(uname -s)"
echo "Host Operating System Detected: ${OS_TYPE}"

# --- STEP 1: SELF-HEALING LINUX SYSTEM PREREQUISITES (libatomic Gate) ---
if [[ "${OS_TYPE}" == "Linux" ]]; then
    echo "Auditing shared system libraries for Node 25+ compatibility..."
    if ldconfig -p | grep -q "libatomic.so.1"; then
        echo "✓ Shared C-library dependency verified (libatomic.so.1)"
    else
        echo "libatomic.so.1 missing. Injecting required system package..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update -o Acquire::RaiseOnError=false -y || true
            sudo apt-get install -y libatomic1
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y libatomic
        elif command -v yum &> /dev/null; then
            sudo yum install -y libatomic
        else
            echo "ERROR: Unsupported package manager. Please install libatomic1 manually." >&2
            exit 1
        fi
        
        # FIXED: Enforced double brackets and combined the fallback file checks cleanly
        if ldconfig -p | grep -q "libatomic.so.1" || [[ -f /usr/lib/x86_64-linux-gnu/libatomic.so.1 ]] || [[ -f /usr/lib/libatomic.so.1 ]]; then
            echo "✓ System library package injected successfully."
        else
            echo "ERROR: libatomic1 package installation failed to populate system linker paths." >&2
            exit 1
        fi
    fi
fi

# --- STEP 2: SELF-HEALING DOCKER ENGINE GATE ---
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
            # FIXED: Added --proto '=https' security gate to prevent malicious network protocol degradation
            curl --proto '=https' -fsSL https://docker.com | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg || true
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker "${USER}"
        else
            echo "ERROR: Unsupported Linux distribution." >&2
            exit 1
        fi
    elif [[ "${OS_TYPE}" == "Darwin" ]]; then
        echo "Executing macOS Homebrew Docker Desktop installation..."
        if ! command -v brew &> /dev/null; then
            # FIXED: Hardened protocol boundaries targeting Homebrew installation domains
            /bin/bash -c "$(curl --proto '=https' -fsSL https://githubusercontent.com)"
        fi
        brew install --cask docker
        open /Applications/Docker.app
    else
        echo "ERROR: Automated Docker setup requires manual execution." >&2
        exit 1
    fi
fi

# --- STEP 3: SELF-HEALING NODE.JS RUNTIME GATE ---
echo "Verifying local Node.js runtime environment..."
REQUIRED_NODE_VER="26.7.0"
NODE_INSTALLED=false

# FIXED: Nested conditionals merged into a single execution stream using the short-circuit operator
if command -v node &> /dev/null && CURRENT_NODE_VER=$(node -v 2>/dev/null | sed 's/v//'); then
    if [[ "$(printf '%s\n' "${REQUIRED_NODE_VER}" "${CURRENT_NODE_VER}" | sort -V | head -n1)" == "${REQUIRED_NODE_VER}" ]]; then
        echo "✓ Host Node.js runtime environment verified (v${CURRENT_NODE_VER})"
        NODE_INSTALLED=true
    else
        echo "Outdated Node.js version detected (v${CURRENT_NODE_VER}). Upgrading environment..."
    fi
fi

if [[ "${NODE_INSTALLED}" = false ]]; then
    echo "Bootstrapping Node.js runtime manager (nvm)..."
    # FIXED: Hardened raw github protocol connections against downgrade injection redirects
    curl --proto '=https' -fsSL https://githubusercontent.com | bash
    
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1090
    [[ -s "${NVM_DIR}/nvm.sh" ]] && \. "${NVM_DIR}/nvm.sh"
    echo "Compiling Node.js target baseline v${REQUIRED_NODE_VER}..."
    nvm install "${REQUIRED_NODE_VER}"
    nvm use "${REQUIRED_NODE_VER}"
    nvm alias default "${REQUIRED_NODE_VER}"
fi

# --- STEP 4: NATIVE PACKAGE MANAGER PROXY SETUP ---
echo "Configuring native pnpm package manager boundaries..."
if ! command -v pnpm &> /dev/null; then
    echo "Global pnpm runner missing. Bootstrapping standalone pnpm wrapper..."
    # FIXED: Restored security protection flag blocking third-party package script hooks
    npm install -g --ignore-scripts pnpm@11.22.0
fi

pnpm setup

# --- STEP 5: WORKSPACE DEPENDENCY LINKING EXECUTION ---
echo "Executing pnpm workspace package compilation loops..."
# FIXED: Enforced absolute supply chain validation alongside script injection blocks
pnpm install --frozen-lockfile --ignore-scripts

echo "${DEPLOYMENT_BANNER}"
echo "✓ ENVIRONMENT SETUP COMPLETE: System is completely compilation-ready."
echo "${DEPLOYMENT_BANNER}"
