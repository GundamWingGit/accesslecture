#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04+ GPU VM on Google Compute Engine (after drivers + Docker + NVIDIA Container Toolkit).
# Usage: bash scripts/gcp-gpu-vm-bootstrap.sh
set -euo pipefail

echo "=== Install Docker Compose plugin (if missing) ==="
sudo apt-get update -qq
sudo apt-get install -y docker-compose-plugin || true

echo "=== Clone or update repo (set REPO_URL before running, or clone manually) ==="
# export REPO_URL=https://github.com/GundamWingGit/accesslecture.git
# git clone "$REPO_URL" && cd accesslecture

echo "=== Create backend/.env from example and edit secrets ==="
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env — edit with Supabase, Redis URL (redis://redis:6379/0), GCP, HF_TOKEN"
fi

echo "=== Add gcp-credentials.json to backend/ (or use Workload Identity in GCP) ==="

echo "=== Open firewall for API (optional; prefer HTTPS reverse proxy) ==="
echo "gcloud compute firewall-rules create allow-accesslecture-api --allow=tcp:8000 --target-tags=accesslecture --direction=INGRESS"
echo "(Or use Cloud Load Balancing + managed SSL.)"

echo "=== Start stack ==="
echo "docker compose -f docker-compose.prod.yml up -d --build"
