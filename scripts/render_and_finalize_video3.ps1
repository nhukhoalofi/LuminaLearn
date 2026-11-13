$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$rawVideoPath = Join-Path $root "outputs/condensation_raw.mp4"
$audioWavPath = Join-Path $root "outputs/condensation_final_audio_with_bgm.wav"
$finalMp4Path = Join-Path $root "outputs/condensation_exact_clone.mp4"
$webPublicMp4 = Join-Path $root "apps/web/public/demo/condensation-exact-clone.mp4"
$qaDir = Join-Path $root "outputs/clone3_final_qa"

if (!(Test-Path $qaDir)) { New-Item -ItemType Directory -Force -Path $qaDir | Out-Null }
if (!(Test-Path "apps/web/public/demo")) { New-Item -ItemType Directory -Force -Path "apps/web/public/demo" | Out-Null }

Write-Host "=== Step 1: Rendering Raw Video with Remotion ==="
Write-Host "Composition: LuminaExactCondensationClone (1920 frames @ 30 FPS = 64.0s, 1080x1920)"

Set-Location "apps/worker"
& npx remotion render src/index.ts LuminaExactCondensationClone $rawVideoPath '--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe'
Set-Location "../.."

Write-Host "✓ Successfully rendered raw video to: $rawVideoPath"

Write-Host "`n=== Step 2: Muxing with DUT AI TTS Voice + YouTube Signature BGM Master Audio ==="
& ffmpeg -y -i $rawVideoPath -i $audioWavPath -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest $finalMp4Path

Write-Host "✓ Successfully created final MP4: $finalMp4Path"

Copy-Item -Force $finalMp4Path $webPublicMp4
Write-Host "✓ Copied to web public demo: $webPublicMp4"

Write-Host "`n=== Step 3: Probing Final MP4 ==="
& ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration,size,bit_rate -of json $finalMp4Path

Write-Host "`n=== Step 4: Extracting Final QA Frames from Final MP4 ==="
$checkTimes = @(
  @{ t = "00:00:02.000"; name = "01_hook_can" };
  @{ t = "00:00:06.000"; name = "02_misconception_can_left" };
  @{ t = "00:00:10.000"; name = "03_sai_cross_card" };
  @{ t = "00:00:16.000"; name = "04_invisible_vapor" };
  @{ t = "00:00:22.000"; name = "05_droplets_condensing" };
  @{ t = "00:00:30.000"; name = "06_capacity_30c" };
  @{ t = "00:00:38.000"; name = "07_capacity_5c_dripping" };
  @{ t = "00:00:44.000"; name = "08_nom_wind_wall" };
  @{ t = "00:00:49.000"; name = "09_nom_wet_floor" };
  @{ t = "00:00:54.000"; name = "10_nho_nhe_card" };
  @{ t = "00:00:59.000"; name = "11_outro_question_mascot" }
)

for ($i = 0; $i -lt $checkTimes.Length; $i++) {
  $item = $checkTimes[$i]
  $timeSec = $item.t
  $frameName = $item.name
  $outPng = Join-Path $qaDir "qa_${frameName}.png"
  & ffmpeg -y -ss $timeSec -i $finalMp4Path -vframes 1 $outPng
  Write-Host "✓ Saved QA frame at $timeSec -> $outPng"
}

Write-Host "`n=== All Operations Completed Successfully! ==="
