#!/bin/sh
# ElevenVoice installer for macOS (Apple Silicon) and Linux.
# Downloads the app, installs what it needs (Bun, uv, Python packages) and starts it.
#
#   curl -fsSL https://raw.githubusercontent.com/Hylanderry/ElevenVoice/main/install.sh | sh
#
# Install somewhere else:   ELEVENVOICE_DIR=~/Apps/ElevenVoice sh install.sh
# Install without starting: ELEVENVOICE_NO_START=1 sh install.sh
set -eu

REPO="https://github.com/Hylanderry/ElevenVoice.git"
DIR="${ELEVENVOICE_DIR:-$HOME/ElevenVoice}"

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'ElevenVoice: %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"

step "Checking tools"
have git || die "Git is missing. Install it (macOS: xcode-select --install; Linux: your package manager) and run this again."
have curl || die "curl is missing. Install it and run this again."
if ! have bun; then
    echo "Installing Bun (JavaScript runtime)..."
    curl -fsSL https://bun.sh/install | bash
fi
if ! have uv; then
    echo "Installing uv (Python manager)..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi
have bun || die "Bun is still not available. Open a new terminal and run this again."
have uv || die "uv is still not available. Open a new terminal and run this again."

step "Downloading ElevenVoice to $DIR"
if [ -d "$DIR/.git" ]; then
    git -C "$DIR" pull --ff-only
else
    git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

step "Installing app dependencies"
bun install

step "Installing the voice engine (Python, PyTorch; detects your GPU automatically)"
bun run setup:api

printf '\nElevenVoice is installed in %s\n' "$DIR"
printf 'Start it later with:  cd "%s" && bun run desktop\n' "$DIR"
if [ "${ELEVENVOICE_NO_START:-}" != "1" ]; then
    step "Starting ElevenVoice"
    exec bun run desktop
fi
