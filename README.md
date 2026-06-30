# claude-notifier

A tiny, dependency-free notifier for AI coding agents. When a hook fires
(Claude Code, Gemini, Codex, or GitHub Copilot finishing a turn, asking for
input, or hitting an error), it **plays a sound** and shows a **macOS
notification**.

This is a stripped-down sibling of `claude-raycast-notifier` — no Raycast
extension, no interactive question hand-off, just sound + notification.

## Requirements

- macOS (uses `afplay` for sound and `osascript` for notifications)
- Node.js 18+

## How it works

Each supported agent has a small hook bridge under `hooks/`. The bridge
normalizes the incoming hook payload into an event, decides whether the event
deserves attention, plays the mapped sound, and shows a macOS notification.

```
agent hook  ──>  hooks/<agent>-*-bridge.mjs  ──>  hooks/ai-event-bridge.mjs
                                                      ├─ play sound (afplay)
                                                      └─ macOS notification (osascript)
```

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

Copy (or symlink) this project somewhere stable and point your agent's hooks at
the bridge scripts. The examples assume `~/.claude/bin/claude-notifier`:

```sh
mkdir -p ~/.claude/bin
cp -R /path/to/claude-notifier ~/.claude/bin/claude-notifier
```

Then wire up the hooks for whichever agents you use (see `config/`):

- **Claude Code** — merge `config/claude-hooks.example.json` into
  `~/.claude/settings.json`.
- **Gemini CLI** — merge `config/gemini-settings.example.json` into your Gemini
  settings.
- **Codex** — merge `config/codex-hooks.example.json` into your Codex hooks.
- **GitHub Copilot** — merge `config/copilot-hooks.example.json`.

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
