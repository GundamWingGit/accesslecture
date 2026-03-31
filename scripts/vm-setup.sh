#!/usr/bin/env bash
# All-in-one setup for the AccessLecture backend (CPU-only).
# Works on any Linux VM — no GPU required.
# Before running: place backend/.env and backend/gcp-credentials.json in the repo root.
# Usage: bash scripts/vm-setup.sh
set -euo pipefail

echo "============================================"
echo "  AccessLecture Backend Setup (CPU-only)"
echo "============================================"

# --- Step 1: Install Docker ---
echo ""
echo ">>> Step 1/3: Installing Docker..."
sudo apt-get update -qq
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
echo "Docker installed."

# --- Step 2: Check secrets exist ---
echo ""
echo ">>> Step 2/3: Checking secrets..."
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found. Create it first (see backend/.env.example)."
  exit 1
fi
if [ ! -f backend/gcp-credentials.json ]; then
  echo "ERROR: backend/gcp-credentials.json not found. Create it first."
  exit 1
fi
echo "Secrets found."

# --- Step 3: Build and run ---
echo ""
echo ">>> Step 3/3: Building and starting services..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "============================================"
echo "  Build started! Monitor with:"
echo "  sudo docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "  Test: curl http://localhost:8000/api/health"
echo "============================================"
