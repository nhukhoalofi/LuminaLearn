$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$rawVideoPath = Join-Path $root "outputs/projectile_raw.mp4"
$audioWavPath = Join-Path $root "outputs/projectile_final_audio_with_bgm.wav"
$finalMp4Path = Join-Path $root "outputs/projectile_exact_clone.mp4"
$webPublicMp4 = Join-Path $root "apps/web/public/demo/projectile-motion.mp4"
$qaDir = Join-Path $root "outputs/projectile_final_qa"

if (!(Test-Path $qaDir)) { New-Item -ItemType Directory -Force -Path $qaDir | Out-Null }
if (!(Test-Path "apps/web/public/demo")) { New-Item -ItemType Directory -Force -Path "apps/web/public/demo" | Out-Null }

Write-Host "=== Step 1: Rendering Raw Video with Remotion ==="
Write-Host "Composition: LuminaExactProjectileClone (1800 frames @ 30 FPS = 60.0s, 1080x1920)"

Set-Location "apps/worker"
& npx remotion render src/index.ts LuminaExactProjectileClone $rawVideoPath --concurrency=2 '--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe'
Set-Location "../.."

Write-Host "=== Step 2: Muxing with Final Audio with BGM ==="
& ffmpeg -y -i $rawVideoPath -i $audioWavPath -c:v copy -c:a aac -b:a 192k -ar 48000 $finalMp4Path
Copy-Item -Force $finalMp4Path $webPublicMp4

Write-Host "=== Step 3: Extracting Keyframe QA Images ==="
& ffmpeg -y -ss 3 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene1_hook.png")
& ffmpeg -y -ss 11 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene2_galileo.png")
& ffmpeg -y -ss 22 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene3_simultaneous.png")
& ffmpeg -y -ss 35 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene4_parabola.png")
& ffmpeg -y -ss 47 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene5_range.png")
& ffmpeg -y -ss 56 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene6_summary.png")

# Extract 1st frame for thumbnail
& ffmpeg -y -ss 00:00:01 -i $finalMp4Path -vframes 1 "apps/web/public/demo/thumb-projectile-motion.png"

Write-Host "✓ Complete Projectile Motion Master Render Finished!"

