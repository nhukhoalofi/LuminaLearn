$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$rawVideoPath = Join-Path $root "outputs/cloud_raw.mp4"
$audioWavPath = Join-Path $root "outputs/cloud_final_audio_with_bgm.wav"
$finalMp4Path = Join-Path $root "outputs/cloud_exact_clone.mp4"
$webPublicMp4 = Join-Path $root "apps/web/public/demo/storm-cloud.mp4"
$qaDir = Join-Path $root "outputs/cloud_final_qa"

if (!(Test-Path $qaDir)) { New-Item -ItemType Directory -Force -Path $qaDir | Out-Null }
if (!(Test-Path "apps/web/public/demo")) { New-Item -ItemType Directory -Force -Path "apps/web/public/demo" | Out-Null }

Write-Host "=== Step 1: Rendering Raw Video with Remotion ==="
Write-Host "Composition: LuminaExactCloudClone (1380 frames @ 30 FPS = 46.00s, 1080x1920)"

Set-Location "apps/worker"
& npx remotion render src/index.ts LuminaExactCloudClone $rawVideoPath --concurrency=2 '--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe'
Set-Location "../.."

Write-Host "✓ Successfully rendered raw video: $rawVideoPath"

Write-Host "`n=== Step 2: Muxing with DUT AI TTS Voice + Signature BGM ==="
& ffmpeg -y -i $rawVideoPath -i $audioWavPath -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest $finalMp4Path

Write-Host "✓ Successfully created final MP4: $finalMp4Path"

Copy-Item -Force $finalMp4Path $webPublicMp4
Write-Host "✓ Copied to web public demo: $webPublicMp4"

Write-Host "`n=== Step 3: Extracting Keyframe QA Images ==="
& ffmpeg -y -ss 2.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene1_hook.png")
& ffmpeg -y -ss 7.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene2_mie_scattering.png")
& ffmpeg -y -ss 14.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene3_thickness.png")
& ffmpeg -y -ss 23.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene4_multiple_scattering.png")
& ffmpeg -y -ss 32.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene5_airplane_view.png")
& ffmpeg -y -ss 38.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene6_recap.png")
& ffmpeg -y -ss 42.0 -i $finalMp4Path -vframes 1 (Join-Path $qaDir "scene7_question_outro.png")

# Extract 1st frame for thumbnail
& ffmpeg -y -ss 00:00:01.5 -i $finalMp4Path -vframes 1 "apps/web/public/demo/thumb-storm-cloud.png"

Write-Host "✓ Complete Streamlined Cloud Physics Master Render Finished!"
