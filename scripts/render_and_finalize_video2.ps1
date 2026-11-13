$ErrorActionPreference = "Continue"

$root = (Get-Location).Path
$rawVideoPath = Join-Path $root "outputs/phone_call_raw.mp4"
$audioWavPath = Join-Path $root "outputs/phone_call_final_audio_with_bgm.wav"
$finalMp4Path = Join-Path $root "outputs/phone_call_exact_clone.mp4"
$webPublicMp4 = Join-Path $root "apps/web/public/demo/phone-call-exact-clone.mp4"
$qaDir = Join-Path $root "outputs/clone2_final_qa"

New-Item -ItemType Directory -Force -Path $qaDir | Out-Null
New-Item -ItemType Directory -Force -Path "apps/web/public/demo" | Out-Null

Write-Host "=== Step 1: Rendering Raw Video with Remotion ==="
Write-Host "Composition: LuminaExactPhoneCallClone (2580 frames @ 30 FPS = 86.000s, 1080x1920)"

if (Test-Path $rawVideoPath) { Remove-Item -Force $rawVideoPath }

Set-Location "apps/worker"
npx remotion render src/index.ts LuminaExactPhoneCallClone "../../outputs/phone_call_raw.mp4" --concurrency=2 '--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe'
Set-Location "../.."

if (-not (Test-Path $rawVideoPath)) {
  Write-Error "Rendering raw video failed!"
  exit 1
}

Write-Host "✓ Successfully rendered raw video to: $rawVideoPath"

Write-Host "`n=== Step 2: Muxing with DUTAI TTS Voice + YouTube BGM Master Audio ==="
ffmpeg -y -i $rawVideoPath -i $audioWavPath -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest $finalMp4Path

Write-Host "✓ Successfully created final MP4: $finalMp4Path"

Copy-Item -Force $finalMp4Path $webPublicMp4
Write-Host "✓ Copied to web public demo: $webPublicMp4"

Write-Host "`n=== Step 3: Probing Final MP4 ==="
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration,size,bit_rate -of json $finalMp4Path

Write-Host "`n=== Step 4: Extracting Final QA Frames from Final MP4 ==="
$checkTimes = @(
  @{ t = "2.0"; name = "01_hook" },
  @{ t = "10.0"; name = "02_chain" },
  @{ t = "18.0"; name = "03_micro" },
  @{ t = "25.5"; name = "04_dsp" },
  @{ t = "34.0"; name = "05_tx_antenna" },
  @{ t = "43.0"; name = "06_network" },
  @{ t = "52.0"; name = "07_rx_antenna" },
  @{ t = "62.0"; name = "08_speaker" },
  @{ t = "71.0"; name = "09_duplex" },
  @{ t = "80.0"; name = "10_outro" }
)

foreach ($item in $checkTimes) {
  $t = $item.t
  $name = $item.name
  $outPng = Join-Path $qaDir "qa_${name}.png"
  ffmpeg -y -ss $t -i $finalMp4Path -vframes 1 $outPng
  Write-Host "✓ Saved frame at $t -> $outPng"
}

Write-Host "`n=== All Operations Completed Successfully! ==="

