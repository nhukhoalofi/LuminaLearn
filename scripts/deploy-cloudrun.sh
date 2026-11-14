#!/usr/bin/env bash
set -e

# ==========================================
#    LuminaLearn - Google Cloud Run Deploy
# ==========================================

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="luminalearn-web"

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    read -p "Nhập Google Cloud Project ID của bạn: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
    echo "[ERROR] Project ID không được để trống."
    exit 1
fi

echo "-> Sử dụng GCP Project: $PROJECT_ID"
echo "-> Region: $REGION"
echo "-> Service: $SERVICE_NAME"

# 1. Kích hoạt APIs
echo -e "\n[1/3] Kích hoạt các dịch vụ GCP..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID"

# 2. Xử lý Secrets
AUTH_TOKEN="${LUMINA_API_AUTH_TOKEN:-$(openssl rand -base64 24 2>/dev/null || echo "lumina_secret_$(date +%s)")}"
SIGNING_KEY="${LUMINA_CONSENT_SIGNING_KEY:-0396b1694514dfca7cf9a5eed0ddf130006d063b679d78014ed8e6ab416d22d2}"

ENV_VARS="LUMINA_PUBLIC_DEPLOYMENT=true,LUMINA_LOCAL_DEMO=false,LUMINA_API_AUTH_TOKEN=$AUTH_TOKEN,LUMINA_CONSENT_SIGNING_KEY=$SIGNING_KEY,REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium,TTS_PROVIDER=gemini,NODE_ENV=production"

if [ -n "$GEMINI_API_KEY" ]; then
    ENV_VARS="$ENV_VARS,GEMINI_API_KEY=$GEMINI_API_KEY"
fi

# 3. Deploy Cloud Run từ source
echo -e "\n[2/3] Build container trên Cloud Build và deploy lên Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 1800 \
    --concurrency 10 \
    --set-env-vars "$ENV_VARS"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format "value(status.url)")

echo -e "\n[3/3] Deploy thành công!"
echo "=========================================="
echo "App URL: $SERVICE_URL"
echo "LUMINA_API_AUTH_TOKEN: $AUTH_TOKEN"
echo "=========================================="
echo -e "\nĐể hoàn tất thiết lập CSRF protection, chạy lệnh sau:"
echo "gcloud run services update $SERVICE_NAME --project $PROJECT_ID --region $REGION --update-env-vars LUMINA_PUBLIC_ORIGIN=$SERVICE_URL"

