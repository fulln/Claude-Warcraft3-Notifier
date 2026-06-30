# AGENTS.md

Instructions for an AI agent asked to install this project from its GitHub URL.

## What this is

**Claude Notifier** plays a sound + shows a desktop notification when an AI
coding agent's hooks fire (Claude Code / Gemini / Codex / Copilot). Pure Node,
no npm dependencies. Works on macOS, Windows, and Linux.

## Install (deterministic, non-interactive)

Requirements: `git` and Node.js 18+.

1. Clone the repo (anywhere — a temp dir is fine):
   ```sh
   git clone --depth 1 https://github.com/fulln/claude-notifier
   ```
2. Run the installer:
   ```sh
   node claude-notifier/scripts/install.mjs
   ```
   - It copies the project to `~/.claude/bin/claude-notifier` and merges the
     Claude Code `Stop` + `Elicitation` hooks into `~/.claude/settings.json`.
   - It is idempotent; re-running does not duplicate hooks.
   - The clone can be deleted afterwards; the install is self-contained.

Flags: `--dest <dir>`, `--no-claude` (skip settings.json), `--uninstall`.

## Verify

```sh
node ~/.claude/bin/claude-notifier/hooks/mock-event.mjs done | node ~/.claude/bin/claude-notifier/hooks/claude-event-bridge.mjs
```

Expect a sound to play and a notification to appear. The JSON printed to stdout
should contain `"played": true`.

## Do not

- Do not run `npm install` expecting dependencies — there are none.
- Do not hand-edit `~/.claude/settings.json` for the Claude hooks; the installer
  does it idempotently.
