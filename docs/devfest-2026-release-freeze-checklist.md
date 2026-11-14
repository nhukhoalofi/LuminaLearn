# DevFest 2026 Release Freeze Checklist — Sprint B.4.2

## Candidate identity

- [x] Branch: `feat/v3-quality-sprint-b-verified-motion`
- [x] Local HEAD / baseline: `97fdaef67b93c05cd7cd6259022dc1a6a8aedf4a`
- [x] Scope frozen to exactly three compositions.
- [ ] Working-tree patch committed and reviewed.
- [ ] Candidate CI green. Run `42969978962` is red at `Run Multi-Agent Supervisor tests` and predates the local patch.

## Scientific and authorization gates

- [x] Algebra identity, four steps, and `9+6+6+4=25` visually checked.
- [x] Derivative uses `f(x)=x^2`, `P=(1,1)`, tangent slope `2`; motion completes.
- [x] Gradient trace uses the approved loss, learning rate, loss/gradient values, and parameter updates.
- [x] Numeric validation is not presented as formal SymPy proof.
- [x] Summary scenes contain no unconditional SymPy badge.
- [x] Trusted proof authority is derived only on the authorized artifact render path.
- [x] Mock Derivative flow passes semantic review, approval, integrity, and authorization.
- [x] Post-approval narration edit revokes old artifact authorization.

## Accepted media

| Composition | Local file | SHA-256 | Status |
| --- | --- | --- | --- |
| `DevFestAlgebraIdentityV3` | `artifacts/quality-sprint-b/devfest-algebra-identity.mp4` | `7f7c71fb65e54f3b6c38c55aa944d410d86163ad18668e6304135cd3f1d35934` | 48s, H.264, 720×1280, 24fps, `SUBTITLE_ONLY` |
| `DevFestDerivativeTangentV3` | `artifacts/quality-sprint-b/devfest-derivative-tangent.mp4` | `c43c204393f61b6791ba818dbb17e43868052792d1a76ae98d41db0f06adef28` | 52s, H.264, 720×1280, 24fps, `SUBTITLE_ONLY` |
| `DevFestGradientDescentV3` | `artifacts/quality-sprint-b/devfest-gradient-descent.mp4` | `3c62bbbf0050e6ab93f2b2e1a65dac6e951cf43da1f567234e8f49518955284b` | 52s, H.264, 720×1280, 24fps, `SUBTITLE_ONLY` |

Integrity manifest: `docs/devfest-2026-media.sha256`.

## Contact sheets

- `artifacts/quality-sprint-b/devfest-algebra-acceptance-contact-sheet.png`
- `artifacts/quality-sprint-b/devfest-derivative-acceptance-contact-sheet.png`
- `artifacts/quality-sprint-b/devfest-gradient-acceptance-contact-sheet.png`

Each sheet samples the beginning, scene boundaries, middle/late motion, and final frame of the accepted file.

## Reproduction commands

Run from `apps/worker` with Chrome installed at the shown path:

```powershell
pnpm exec remotion render src/index.ts DevFestAlgebraIdentityV3 '../../artifacts/quality-sprint-b/devfest-algebra-identity.mp4' --browser-executable='C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm exec remotion render src/index.ts DevFestDerivativeTangentV3 '../../artifacts/quality-sprint-b/devfest-derivative-tangent.mp4' --browser-executable='C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm exec remotion render src/index.ts DevFestGradientDescentV3 '../../artifacts/quality-sprint-b/devfest-gradient-descent.mp4' --browser-executable='C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Verify one output:

```powershell
ffprobe -v error -show_entries format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate -of json artifacts/quality-sprint-b/devfest-algebra-identity.mp4
Get-FileHash -Algorithm SHA256 artifacts/quality-sprint-b/devfest-algebra-identity.mp4
```

## Presenter checklist

- [ ] Copy all three MP4s and this SHA manifest to the offline presentation machine and verify hashes again.
- [ ] Open each MP4 before the session and confirm vertical playback.
- [ ] State clearly that the files are prerecorded fixtures and `SUBTITLE_ONLY`.
- [ ] Do not claim Gemini TTS, remote publication, production readiness, or passing candidate CI.
- [ ] Describe Gradient Descent as numeric validation, not a SymPy proof.
- [ ] Use Teacher Studio only to demonstrate draft/review/approval concepts; do not claim its preset automatically recreates these MP4s.
- [ ] Keep the three contact sheets available as playback fallback.

## Known limitations

- CI run `42969978962` failed and the local fix has no candidate run yet.
- Remotion render emits the existing Zod version-alignment warning.
- No audio stream and no separate subtitle stream are present.
- No paid Gemini/TTS request was made.
- Temporary duplicate renders may remain in `.b42-new`; only the three accepted paths above belong in the demo package.

## Freeze decision

`CONDITIONAL_GO`: usable for the controlled offline showcase. Do not freeze as a production release until the patch is reviewed and candidate CI passes.
