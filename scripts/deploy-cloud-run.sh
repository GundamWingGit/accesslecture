#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Deploy AccessLecture API to Google Cloud Run
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated (gcloud auth login)
#   2. Project set: gcloud config set project YOUR_PROJECT_ID
#   3. backend/.env populated with real values
#   4. backend/gcp-credentials.json in place (Vertex AI service account key)
#
# Usage:
#   ./scripts/deploy-cloud-run.sh
# ---------------------------------------------------------------------------

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="accesslecture-api"

echo "Deploying $SERVICE_NAME to Cloud Run ($PROJECT_ID / $REGION)..."

# Build and deploy from repository root using the existing Dockerfile
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --dockerfile Dockerfile.backend \
  --allow-unauthenticated \
  --timeout 3600 \
  --cpu 2 \
  --memory 1Gi \
  --no-cpu-throttling \
  --min-instances 0 \
  --max-instances 4 \
  --set-env-vars "SUPABASE_URL=$(grep SUPABASE_URL backend/.env | cut -d= -f2-)" \
  --set-env-vars "SUPABASE_KEY=$(grep SUPABASE_KEY backend/.env | head -1 | cut -d= -f2-)" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY backend/.env | cut -d= -f2-)" \
  --set-env-vars "TRANSCRIPTION_PROVIDER=gemini" \
  --set-env-vars "VISUAL_ANALYSIS_PROVIDER=gemini" \
  --set-env-vars "CLEANUP_PROVIDER=gemini" \
  --set-env-vars "USE_VERTEX_AI=true" \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "GCP_LOCATION=$REGION" \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash" \
  --set-env-vars "ENABLE_VIDEO_OCR=true" \
  --set-env-vars "COMPLIANCE_MODE=clean" \
  --set-env-vars "COMPLIANCE_RUBRIC_PATH=/docs/compliance-rubric.json"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "Deployed successfully!"
echo "  API URL: $SERVICE_URL"
echo "  Health:  $SERVICE_URL/api/health"
echo ""
echo "Next steps:"
echo "  1. Set NEXT_PUBLIC_API_URL=$SERVICE_URL/api in Vercel env vars"
echo "  2. Redeploy frontend on Vercel"
