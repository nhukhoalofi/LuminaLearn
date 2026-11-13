$ErrorActionPreference = "Stop"

$frames = @(
  @{ f = 50; name = "scene_01_intro" },
  @{ f = 200; name = "scene_02_hook" },
  @{ f = 400; name = "scene_03_chain" },
  @{ f = 650; name = "scene_04_micro" },
  @{ f = 880; name = "scene_05_dsp" },
  @{ f = 1150; name = "scene_06_tx_antenna" },
  @{ f = 1400; name = "scene_07_network" },
  @{ f = 1680; name = "scene_08_rx_antenna" },
  @{ f = 1980; name = "scene_09_speaker" },
  @{ f = 2250; name = "scene_10_duplex" },
  @{ f = 2500; name = "scene_11_outro" }
)

New-Item -ItemType Directory -Force -Path "outputs/clone2_qa_frames" | Out-Null

Set-Location "apps/worker"

foreach ($item in $frames) {
  $f = $item.f
  $name = $item.name
  $outPath = "../../outputs/clone2_qa_frames/frame_${f}_${name}.png"
  Write-Host "Rendering frame $f ($name) -> $outPath"
  npx remotion still src/index.ts LuminaExactPhoneCallClone $outPath --frame=$f '--browser-executable=C:\Program Files\Google\Chrome\Application\chrome.exe'
}

Set-Location "../.."
Write-Host "All QA frames rendered successfully!"

