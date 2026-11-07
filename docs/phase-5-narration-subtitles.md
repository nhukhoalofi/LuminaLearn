# Phase 5 — Narration, subtitles and local reliability

Phase 5 preserves the 720×1280, 24 FPS, 960-frame derivative pipeline and adds a reviewed Vietnamese narration contract, optional audio, segment-level subtitles and disk-backed job metadata.

## Pipeline

```text
Verified lesson + SymPy report
  -> deterministic NarrationAgent mathematical review
  -> narration-script.json
  -> none | provided_audio | google_cloud_tts
  -> FFprobe audio validation
  -> segment-level subtitles.json + UTF-8 subtitles.srt
  -> Remotion audio/caption composition
  -> FFmpeg H.264/AAC normalization
  -> final FFprobe verification
```

The narration agent never changes mathematical values. It checks the derivative, secant slope, limit and value at `x = 1` against the verified report before producing natural Vietnamese wording. Subtitle timing is scene/segment-level; the project does not claim word-level alignment.

## Voiceover modes

- `none`: no audio stream is required. Narration artifacts and optional burned-in subtitles are still generated.
- `provided_audio`: trusted local CLI only. MP3, WAV and M4A are accepted after codec, duration, sample-rate and channel validation. Web upload is deliberately disabled in this phase.
- `google_cloud_tts`: server-side official Google Cloud client, Vietnamese `vi-VN`, configurable with `GOOGLE_TTS_VOICE`. Each scene is synthesized separately, retried at most twice after the first call, cached when valid, and rejected when it exceeds its scene.

Google Cloud uses Application Default Credentials. `GEMINI_API_KEY` is unrelated and is never used for TTS. Do not place service-account JSON in this repository.

## Commands

```powershell
pnpm install --frozen-lockfile

# Offline, silent video with burned-in subtitles
pnpm hybrid:render -- --mode mock --voiceover none

# Trusted local provided audio
pnpm hybrid:render -- --mode mock --voiceover provided_audio --provided-audio "D:\audio\narration.wav"

# Google Cloud TTS after configuring ADC
$env:GOOGLE_APPLICATION_CREDENTIALS="D:\secrets\service-account.json"
$env:GOOGLE_CLOUD_PROJECT="your-project"
$env:GOOGLE_TTS_VOICE="vi-VN-Neural2-A"
pnpm hybrid:render -- --mode mock --voiceover google_cloud_tts

# Website
pnpm dev:web
```

Add `--no-subtitles` to the CLI to omit burned-in subtitles. An SRT file is generated either way so a downstream player can use external captions.

## Reliability

Web job records are atomically stored in `outputs/.jobs/<jobId>.json`. On server startup, non-terminal records become `interrupted`; completed and failed records remain available. Concurrency remains one. Pipeline subprocesses have timeouts, staged public assets are removed on failure, partial raw/final files are cleaned, and failures are classified as `ai`, `tts`, `validation`, `render` or `interrupted`.

This remains a local queue, not a distributed job system. Restarted jobs are not automatically resumed. Output cleanup/retention is manual, and local metadata does not provide multi-host locking.

## Authentication status

The repository contains no Google credentials. Google Cloud TTS must not be described as live-tested until a real ADC configuration successfully synthesizes and renders audio. Mock provider tests never call paid services.
