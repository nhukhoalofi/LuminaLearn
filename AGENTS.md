# LuminaLearn agent guidance

For math-video treatment, storyboard, preview, or visual-QA work, use the repository skill at `.agents/skills/luminalearn-video-studio/SKILL.md`.

Gemini is the runtime content and speech provider. Codex and Claude Code are development clients; their presence does not authorize a runtime Claude dependency or any external API call.

Never bypass SymPy verification, human approval, artifact version authorization, or content-hash checks. Do not run the opt-in Gemini TTS smoke test without explicit user approval.
