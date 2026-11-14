<#
.SYNOPSIS
    Script deploy LuminaLearn lên Google Cloud Run bằng Google Cloud SDK.
.DESCRIPTION
    Script tự động kiểm tra gcloud CLI, project ID, xác nhận cấu hình môi trường
    và triển khai container lên Google Cloud Run với cấu hình tài nguyên tối ưu.
#>

[CmdletBinding()]
param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "luminalearn-web",
    [string]$GeminiApiKey = $env:GEMINI_API_KEY
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   LuminaLearn - Google Cloud Run Deploy  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Kiểm tra gcloud CLI
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Không tìm thấy gcloud CLI trên máy!" -ForegroundColor Red
    Write-Host "Vui lòng cài đặt Google Cloud SDK từ: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# 2. Kiểm tra Project ID
if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    $currentProject = (gcloud config get-value project 2>$null).Trim()
    if (-not [string]::IsNullOrWhiteSpace($currentProject) -and $currentProject -ne "(unset)") {
        $ProjectId = $currentProject
    } else {
        $ProjectId = Read-Host "Nhập Google Cloud Project ID của bạn"
    }
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    Write-Host "[ERROR] Project ID không được để trống." -ForegroundColor Red
    exit 1
}

Write-Host "-> Sử dụng GCP Project: $ProjectId" -ForegroundColor Green
Write-Host "-> Region: $Region" -ForegroundColor Green
Write-Host "-> Service Name: $ServiceName" -ForegroundColor Green

# 3. Kích hoạt các GCP APIs cần thiết
Write-Host "`n[1/3] Đang kiểm tra & kích hoạt các dịch vụ GCP (Cloud Run, Cloud Build, Artifact Registry)..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $ProjectId

# 4. Kiểm tra Gemini API Key
if ([string]::IsNullOrWhiteSpace($GeminiApiKey)) {
    Write-Host "[CẢNH BÁO] Không tìm thấy biến môi trường GEMINI_API_KEY." -ForegroundColor Yellow
    $GeminiApiKey = Read-Host "Nhập GEMINI_API_KEY (hoặc nhấn Enter để bỏ qua nếu đã set trên Cloud Run)"
}

# 5. Sinh ngẫu nhiên LUMINA_API_AUTH_TOKEN và LUMINA_CONSENT_SIGNING_KEY nếu chưa có
$authToken = $env:LUMINA_API_AUTH_TOKEN
if ([string]::IsNullOrWhiteSpace($authToken)) {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $authToken = [Convert]::ToBase64String($bytes)
}

$signingKey = $env:LUMINA_CONSENT_SIGNING_KEY
if ([string]::IsNullOrWhiteSpace($signingKey)) {
    $signingKey = "0396b1694514dfca7cf9a5eed0ddf130006d063b679d78014ed8e6ab416d22d2"
}

# Chuẩn bị danh sách biến môi trường
$envVars = @(
    "LUMINA_PUBLIC_DEPLOYMENT=true",
    "LUMINA_LOCAL_DEMO=false",
    "LUMINA_API_AUTH_TOKEN=$authToken",
    "LUMINA_CONSENT_SIGNING_KEY=$signingKey",
    "REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium",
    "TTS_PROVIDER=gemini",
    "NODE_ENV=production"
)

if (-not [string]::IsNullOrWhiteSpace($GeminiApiKey)) {
    $envVars += "GEMINI_API_KEY=$GeminiApiKey"
}

$envVarsString = $envVars -join ","

# 6. Triển khai lên Google Cloud Run
Write-Host "`n[2/3] Đang build container trên Cloud Build và deploy lên Cloud Run..." -ForegroundColor Yellow
Write-Host "(Quá trình build có thể mất 3-5 phút do đóng gói Chromium, FFmpeg và Monorepo packages)`n" -ForegroundColor DarkGray

gcloud run deploy $ServiceName `
    --source . `
    --project $ProjectId `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --memory 4Gi `
    --cpu 2 `
    --timeout 1800 `
    --concurrency 10 `
    --set-env-vars $envVarsString

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[3/3] Deploy thành công!" -ForegroundColor Green
    $serviceUrl = (gcloud run services describe $ServiceName --project $ProjectId --region $Region --format "value(status.url)").Trim()
    
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "App URL: $serviceUrl" -ForegroundColor Green
    Write-Host "LUMINA_API_AUTH_TOKEN: $authToken" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "`n[GHI CHÚ QUAN TRỌNG] Để kích hoạt đầy đủ CSRF protection:" -ForegroundColor Yellow
    Write-Host "Hãy cập nhật biến LUMINA_PUBLIC_ORIGIN bằng URL trên bằng lệnh:" -ForegroundColor Yellow
    Write-Host "gcloud run services update $ServiceName --project $ProjectId --region $Region --update-env-vars LUMINA_PUBLIC_ORIGIN=$serviceUrl" -ForegroundColor Cyan
} else {
    Write-Host "`n[ERROR] Quá trình deploy thất bại. Vui lòng kiểm tra log lỗi bên trên." -ForegroundColor Red
}

