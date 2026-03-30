#!/usr/bin/env bash
# All-in-one setup for the AccessLecture GPU VM.
# Before running: place backend/.env and backend/gcp-credentials.json in the repo root.
# Usage: bash scripts/vm-setup.sh
set -euo pipefail

echo "============================================"
echo "  AccessLecture GPU VM Setup"
echo "============================================"

# --- Step 1: Verify GPU ---
echo ""
echo ">>> Step 1/5: Verifying GPU..."
nvidia-smi || { echo "ERROR: nvidia-smi failed. GPU drivers not installed."; exit 1; }

# --- Step 2: Install Docker ---
echo ""
echo ">>> Step 2/5: Installing Docker..."
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

# --- Step 3: Install NVIDIA Container Toolkit ---
echo ""
echo ">>> Step 3/5: Installing NVIDIA Container Toolkit..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update -qq
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
echo "NVIDIA Container Toolkit installed."

echo ""
echo ">>> Verifying GPU inside Docker..."
sudo docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi

# --- Step 4: Check secrets exist ---
echo ""
echo ">>> Step 4/5: Checking secrets..."
if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found. Create it first (see backend/.env.example)."
  exit 1
fi
if [ ! -f backend/gcp-credentials.json ]; then
  echo "ERROR: backend/gcp-credentials.json not found. Create it first."
  exit 1
fi
echo "Secrets found."

# --- Step 5: Enable GCP credential mounts and build ---
echo ""
echo ">>> Step 5/5: Enabling GCP credential mounts and building..."
sed -i 's|    # volumes:|    volumes:|g' docker-compose.prod.yml
sed -i 's|    #   - ./backend/gcp-credentials.json:/app/gcp-credentials.json:ro|      - ./backend/gcp-credentials.json:/app/gcp-credentials.json:ro|g' docker-compose.prod.yml

echo "Starting Docker Compose build (this takes 15-30 min first time)..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "============================================"
echo "  Build started! Monitor with:"
echo "  sudo docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "  Your external IP:"
curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google"
echo ""
echo ""
echo "  Test: curl http://localhost:8000/api/health"
echo "============================================"
