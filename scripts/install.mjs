#!/usr/bin/env node
/**
 * Cross-platform installer for claude-notifier.
 *
 * - Copies the project to a stable location (default: ~/.claude/bin/claude-notifier)
 * - Merges the Claude Code hooks (Stop + Elicitation) into ~/.claude/settings.json
 *   (idempotent — running twice does not duplicate entries)
 * - Prints the snippets needed to wire up Codex / Gemini / Copilot
 *
 * Works on macOS, Windows, and Linux. Run with:  node scripts/install.mjs
 *
 * Flags:
 *   --dest <dir>   Install location (overrides CLAUDE_NOTIFIER_HOME / default)
 *   --no-claude    Do not touch ~/.claude/settings.json
 *   --uninstall    Remove the install + the Claude hooks this installer added
 */

import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
};

const HOME = homedir();
const DEST =
  opt("--dest") ??
  process.env.CLAUDE_NOTIFIER_HOME ??
  join(HOME, ".claude", "bin", "claude-notifier");
const CLAUDE_SETTINGS = join(HOME, ".claude", "settings.json");
const BRIDGE = join(DEST, "hooks", "claude-event-bridge.mjs");

// On POSIX shells we can swallow errors; cmd.exe (Windows) cannot parse that.
const hookCommand =
  process.platform === "win32"
    ? `node "${BRIDGE}"`
    : `node '${BRIDGE}' 2>/dev/null || true`;

async function exists(p) {
  return access(p).then(() => true).catch(() => false);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function copyProject() {
  await mkdir(DEST, { recursive: true });
  for (const item of ["hooks", "scripts", "config", "sounds", "package.json", "README.md"]) {
    const src = join(PROJECT_ROOT, item);
    if (await exists(src)) {
      await cp(src, join(DEST, item), { recursive: true });
    }
  }
  console.log(`✓ Installed claude-notifier to ${DEST}`);
}

function eventHasOurHook(eventArr) {
  return (
    Array.isArray(eventArr) &&
    eventArr.some((group) =>
      (group.hooks ?? []).some((h) =>
        typeof h.command === "string" && h.command.includes("claude-notifier"),
      ),
    )
  );
}

async function mergeClaudeHooks() {
  const settings = await readJson(CLAUDE_SETTINGS, {});
  settings.hooks ??= {};

  let changed = false;
  for (const event of ["Stop", "Elicitation"]) {
    settings.hooks[event] ??= [];
    if (eventHasOurHook(settings.hooks[event])) {
      console.log(`• ${event}: claude-notifier hook already present — skipped`);
      continue;
    }
    settings.hooks[event].push({
      matcher: "",
      hooks: [{ type: "command", command: hookCommand }],
    });
    changed = true;
    console.log(`✓ ${event}: added claude-notifier hook`);
  }

  if (changed) {
    await mkdir(dirname(CLAUDE_SETTINGS), { recursive: true });
    await writeFile(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n");
    console.log(`✓ Updated ${CLAUDE_SETTINGS}`);
  }
}

async function uninstallClaudeHooks() {
  const settings = await readJson(CLAUDE_SETTINGS, null);
  if (!settings?.hooks) return;
  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event];
    if (!Array.isArray(before)) continue;
    const after = before
      .map((group) => ({
        ...group,
        hooks: (group.hooks ?? []).filter(
          (h) => !(typeof h.command === "string" && h.command.includes("claude-notifier")),
        ),
      }))
      .filter((group) => (group.hooks ?? []).length > 0);
    if (after.length !== before.length || after.some((g, i) => g.hooks.length !== before[i]?.hooks?.length)) {
      changed = true;
    }
    if (after.length > 0) settings.hooks[event] = after;
    else delete settings.hooks[event];
  }
  if (changed) {
    await writeFile(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n");
    console.log(`✓ Removed claude-notifier hooks from ${CLAUDE_SETTINGS}`);
  }
}

function printAgentSnippets() {
  const codexStop = join(DEST, "hooks", "codex-stop-bridge.mjs");
  const geminiNotif = join(DEST, "hooks", "gemini-notification-bridge.mjs");
  const geminiAfter = join(DEST, "hooks", "gemini-after-agent-bridge.mjs");
  const copilotEnd = join(DEST, "hooks", "copilot-session-end-bridge.mjs");
  console.log("\nOptional — wire up other agents (see config/ for full examples):");
  console.log(`  Codex   (~/.codex/hooks.json, Stop)     node "${codexStop}"`);
  console.log(`  Gemini  (settings.json, Notification)   node "${geminiNotif}"`);
  console.log(`  Gemini  (settings.json, AfterAgent)     node "${geminiAfter}"`);
  console.log(`  Copilot (sessionEnd)                    node "${copilotEnd}"`);
}

async function main() {
  console.log(`claude-notifier installer (${process.platform})\n`);

  if (flag("--uninstall")) {
    if (!flag("--no-claude")) await uninstallClaudeHooks();
    if (await exists(DEST)) {
      await rm(DEST, { recursive: true, force: true });
      console.log(`✓ Removed ${DEST}`);
    }
    console.log("\nUninstalled. (Your data dir ~/.claude-notifier was left intact.)");
    return;
  }

  await copyProject();
  if (!flag("--no-claude")) await mergeClaudeHooks();
  printAgentSnippets();

  console.log("\nDone. Test it with:");
  console.log(`  node "${join(DEST, "hooks", "mock-event.mjs")}" done | node "${BRIDGE}"`);
}

main().catch((err) => {
  console.error("Install failed:", err.message);
  process.exit(1);
});
