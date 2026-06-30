# claude-notifier

A tiny, dependency-free notifier for AI coding agents. When a hook fires
(Claude Code, Gemini, Codex, or GitHub Copilot finishing a turn, asking for
input, or hitting an error), it **plays a sound** and shows a **macOS
notification**.

This is a stripped-down sibling of `claude-raycast-notifier` — no Raycast
extension, no interactive question hand-off, just sound + notification.

## Requirements

- Node.js 18+
- A platform with sound + notification support:
  - **macOS** — `afplay` + `osascript` (built in)
  - **Windows** — PowerShell (built in; uses `System.Windows.Media.MediaPlayer`
    for sound and a tray balloon for notifications)
  - **Linux** — one of `ffplay` / `paplay` / `aplay` / `mpg123` / `cvlc` for
    sound, and `notify-send` for notifications

## How it works

Each supported agent has a small hook bridge under `hooks/`. The bridge
normalizes the incoming hook payload into an event, decides whether the event
deserves attention, plays the mapped sound, and shows a macOS notification.

```
agent hook  ──>  hooks/<agent>-*-bridge.mjs  ──>  hooks/ai-event-bridge.mjs
                                                      ├─ play sound  (hooks/lib/platform.mjs)
                                                      └─ notification (hooks/lib/platform.mjs)
```

Platform-specific playback/notification lives in `hooks/lib/platform.mjs`, so
the rest of the code is OS-agnostic.

User data (sounds + which sound maps to which event) lives in
`~/.claude-notifier/` and is seeded automatically on first run from
`config/default-sound-pack.json` and the bundled `sounds/`.

| Event slot    | Fires when…                              | Default sound        |
| ------------- | ---------------------------------------- | -------------------- |
| `needs_input` | the agent needs your input / attention   | Claude Ready To Work |
| `failure`     | a command/session failed                 | Soft Alert           |
| `done`        | the agent finished the task              | Claude Jobs Done     |
| `success`     | a command completed (off by default)     | Bright Success       |
| `running`     | progress event (off by default)          | —                    |

## Install

The cross-platform installer copies the project to
`~/.claude/bin/claude-notifier` and merges the Claude Code hooks (`Stop` +
`Elicitation`) into `~/.claude/settings.json`. It's idempotent — safe to re-run.

```sh
# macOS / Linux
node scripts/install.mjs
# or: ./scripts/install.sh
```

```powershell
# Windows
node scripts\install.mjs
# or: .\scripts\install.ps1
```

Useful flags: `--dest <dir>` (custom location), `--no-claude` (skip editing
settings.json), `--uninstall` (remove install + the hooks it added).

The installer prints ready-to-paste snippets for the other agents. To wire them
up by hand instead, see the examples in `config/`:

- **Claude Code** — `config/claude-hooks.example.json` (done automatically by the installer)
- **Gemini CLI** — `config/gemini-settings.example.json`
- **Codex** — `config/codex-hooks.example.json`
- **GitHub Copilot** — `config/copilot-hooks.example.json`

## Try it

Fire mock events without any agent (plays sound + shows a notification):

```sh
npm run mock:needs-input
npm run mock:done
npm run mock:failure
npm run mock:success
```

## Configuration

Environment variables:

- `CLAUDE_NOTIFIER_ROOT` — override the data dir (default `~/.claude-notifier`).
- `CLAUDE_NOTIFIER_STATE_FILE` — override the state file path.
- `CLAUDE_NOTIFIER_MAX_RECENT` — how many recent events to keep (default `10`).

To change which sound plays for an event, edit
`~/.claude-notifier/sound-mappings.json`. To add your own sound, drop the file
into `~/.claude-notifier/sounds/` and add an entry to
`~/.claude-notifier/sound-library.json`.
