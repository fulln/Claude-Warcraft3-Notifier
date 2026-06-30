/**
 * platform.mjs
 *
 * Cross-platform sound playback and desktop notifications.
 * Supports macOS (afplay / osascript), Windows (PowerShell), and Linux
 * (paplay / ffplay / aplay / mpg123 and notify-send).
 *
 * File paths and notification text are passed through environment variables
 * rather than interpolated into command strings, so no shell escaping is
 * required and paths with spaces/quotes are safe.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Run a command, treating "command not found" (ENOENT) as a soft failure so
 * callers can fall through to the next candidate player.
 */
async function tryRun(command, args, options = {}) {
  try {
    await execFileAsync(command, args, options);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false; // binary missing
    throw error; // real playback error — surface it
  }
}

// ---------------------------------------------------------------------------
// Sound playback
// ---------------------------------------------------------------------------

const WINDOWS_PLAY_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName presentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([uri]$env:CN_SOUND_FILE)
$tries = 0
while (-not $player.NaturalDuration.HasTimeSpan -and $tries -lt 50) {
  Start-Sleep -Milliseconds 100
  $tries++
}
$player.Play()
if ($player.NaturalDuration.HasTimeSpan) {
  Start-Sleep -Seconds ([math]::Ceiling($player.NaturalDuration.TimeSpan.TotalSeconds))
} else {
  Start-Sleep -Seconds 3
}
$player.Stop()
$player.Close()
`.trim();

/**
 * Play an audio file synchronously (resolves after playback finishes, best
 * effort). Throws only on a genuine playback error, not on a missing player.
 *
 * @param {string} filePath absolute path to a .wav/.mp3/etc file
 */
export async function playFile(filePath) {
  switch (process.platform) {
    case "darwin":
      await execFileAsync("afplay", [filePath]);
      return;

    case "win32":
      await execFileAsync(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_PLAY_SCRIPT],
        { env: { ...process.env, CN_SOUND_FILE: filePath } },
      );
      return;

    default: {
      // Linux / other unix — try common players in order of preference.
      // paplay/aplay handle WAV; ffplay/mpg123/cvlc handle MP3 and more.
      const candidates = [
        ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", filePath]],
        ["paplay", [filePath]],
        ["aplay", ["-q", filePath]],
        ["mpg123", ["-q", filePath]],
        ["cvlc", ["--play-and-exit", "--intf", "dummy", filePath]],
      ];
      for (const [cmd, args] of candidates) {
        if (await tryRun(cmd, args)) return;
      }
      throw new Error(
        "No supported audio player found (tried ffplay, paplay, aplay, mpg123, cvlc).",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Desktop notifications
// ---------------------------------------------------------------------------

const WINDOWS_NOTIFY_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.ShowBalloonTip(5000, $env:CN_TITLE, $env:CN_MESSAGE, [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 5
$notify.Dispose()
`.trim();

/**
 * Show a desktop notification. Best effort — silently no-ops if the platform
 * has no notification mechanism available.
 *
 * @param {string} title
 * @param {string} message
 */
export async function notify(title, message) {
  switch (process.platform) {
    case "darwin": {
      const script = `display notification ${JSON.stringify(
        message,
      )} with title ${JSON.stringify(title)}`;
      await execFileAsync("osascript", ["-e", script]);
      return;
    }

    case "win32":
      await execFileAsync(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_NOTIFY_SCRIPT],
        { env: { ...process.env, CN_TITLE: title, CN_MESSAGE: message } },
      );
      return;

    default:
      // Linux — notify-send if present, otherwise give up quietly.
      await tryRun("notify-send", [title, message]);
      return;
  }
}
