# Codex, Claude Code, and local MCP

Codex and Claude Code are development-agent clients. Gemini remains LuminaLearn's runtime LLM/TTS provider. Configuring either client does not add a Claude runtime API or authorize external inference.

## Skills

- Codex discovers the project skill from `.agents/skills/luminalearn-video-studio/SKILL.md`.
- Claude Code discovers its compatible copy from `.claude/skills/luminalearn-video-studio/SKILL.md`.
- `AGENTS.md` and `CLAUDE.md` establish repository-wide safety boundaries.

These project locations follow the current documented client conventions. Invoke the skill by name when you want the workflow applied explicitly.

## Read-only MCP server

Install workspace dependencies, then run:

```powershell
pnpm --filter @luminalearn/mcp-server start
```

Claude Code can use the committed project `.mcp.json`. Confirm with `claude mcp list` or `/mcp`.

For Codex CLI/IDE, add the local stdio server to the shared Codex configuration from the repository root:

```powershell
codex mcp add luminalearn -- pnpm --filter @luminalearn/mcp-server start
codex mcp list
```

The server exposes only `list_math_templates`, `list_visual_styles`, `inspect_storyboard`, `validate_math_spec`, and `inspect_render_job`. Job identifiers use a closed safe-ID schema; file names are server constants; all tools are read-only and make no paid calls. There is no shell, arbitrary path, document-content, render-start, mutation, or publishing tool.

Run the real protocol discovery/invocation test with:

```powershell
pnpm --filter @luminalearn/mcp-server test
```

The test uses the official MCP v2 client twice: a linked in-memory transport invokes all five tools against a controlled repository fixture, then `StdioClientTransport` launches the documented `pnpm` command and performs discovery plus a real tool call. This proves the local protocol/launcher, not an actual Codex or Claude Code connection.
