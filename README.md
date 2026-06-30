# Claude-Warcraft3-Notifier

A tiny, dependency-free notifier for AI coding agents. When a hook fires
(Claude Code, Gemini, Codex, or GitHub Copilot finishing a turn, asking for
input, or hitting an error), it **plays a sound** and shows a **desktop
notification** — on macOS, Windows, and Linux.

This is a stripped-down sibling of `claude-raycast-notifier` — no Raycast
extension, no interactive question hand-off, just sound + notification.

## Quick install

Requires `git` and Node.js 18+. The installer is dependency-free, idempotent,
and copies itself to `~/.claude/bin/claude-notifier`, so the clone can be thrown
away afterwards.

```sh
# macOS / Linux — clone and install
git clone --depth 1 https://github.com/fulln/Claude-Warcraft3-Notifier
node Claude-Warcraft3-Notifier/scripts/install.mjs
```

```powershell
# Windows
git clone --depth 1 https://github.com/fulln/Claude-Warcraft3-Notifier
node Claude-Warcraft3-Notifier\scripts\install.mjs
```

One-liner (clones to a temp dir, installs, cleans up):

```sh
# macOS / Linux
d=$(mktemp -d) && git clone --depth 1 https://github.com/fulln/Claude-Warcraft3-Notifier "$d" && node "$d/scripts/install.mjs"; rm -rf "$d"
```

```powershell
# Windows PowerShell
$d="$env:TEMP\Claude-Warcraft3-Notifier-$(Get-Random)"; git clone --depth 1 https://github.com/fulln/Claude-Warcraft3-Notifier $d; node "$d\scripts\install.mjs"; Remove-Item -Recurse -Force $d
```

This installs the Claude Code hooks automatically. To wire up Codex / Gemini /
Copilot too, the installer prints ready-to-paste snippets (and see `config/`).

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
| `needs_input` | the agent needs your input / attention   | Ready to work!       |
| `failure`     | a command/session failed                 | Peasant: More work?  |
| `done`        | the agent finished the task              | Job's done!          |
| `success`     | a command completed (off by default)     | Bright Success       |
| `running`     | progress event (off by default)          | —                    |

The defaults lean into the Warcraft III theme (peasant/peon voice lines). Swap
any of them — including for plain non-themed tones — with the sounds CLI below.

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

## Manage sounds

Add, swap, and preview sounds from the CLI — no JSON editing required (this
replaces the old Raycast sound manager). Works against the data dir on any OS:

```sh
node scripts/sounds.mjs list                  # show slots + library
node scripts/sounds.mjs add ./my.mp3 "My Sound"   # import a custom sound
node scripts/sounds.mjs map done ./my.mp3     # import + map a file to a slot in one go
node scripts/sounds.mjs map needs_input bright-success   # map an existing sound
node scripts/sounds.mjs play done             # preview a slot or soundId
node scripts/sounds.mjs disable success       # silence a slot
node scripts/sounds.mjs remove <soundId>      # delete an imported sound
```

If installed, run it from the install dir, e.g.
`node ~/.claude/bin/claude-notifier/scripts/sounds.mjs list`. Any audio format
your platform's player supports (`.wav`, `.mp3`, …) can be imported.

Slots: `needs_input`, `failure`, `done`, `success`, `running`.

## Configuration

Environment variables:

- `CLAUDE_NOTIFIER_ROOT` — override the data dir (default `~/.claude-notifier`).
- `CLAUDE_NOTIFIER_STATE_FILE` — override the state file path.
- `CLAUDE_NOTIFIER_MAX_RECENT` — how many recent events to keep (default `10`).

The CLI above writes `~/.claude-notifier/sound-mappings.json` and
`sound-library.json` for you; you can still edit those by hand if you prefer.

## Sound credits

The bundled Warcraft III voice lines (peasant/peon) are © Blizzard
Entertainment and are included here for personal, non-commercial use only. If
you redistribute or use this in a different context, replace them with your own
sounds via the sounds CLI. The non-voice tones (`*.wav`) are generated.
