#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="tonal-apex-491821-e9"
REGION="us-central1"
SERVICE="accesslecture"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

echo "==> Building Docker image..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --substitutions="_NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},_NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  .

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --platform managed \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 1Gi \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  --set-env-vars "USE_VERTEX_AI=true" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars "GCP_LOCATION=${REGION}" \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-flash" \
  --set-env-vars "ENABLE_VIDEO_OCR=true" \
  --set-env-vars "COMPLIANCE_MODE=clean"

echo "==> Done! Service URL:"
gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format="value(status.url)"
