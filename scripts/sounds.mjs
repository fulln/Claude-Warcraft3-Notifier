#!/usr/bin/env node
/**
 * sounds.mjs — manage the notifier's sound library and slot mappings.
 *
 * The CLI replacement for the old Raycast sound manager. Operates on the user
 * data dir (~/.claude-notifier by default; override with CLAUDE_NOTIFIER_ROOT).
 *
 *   node scripts/sounds.mjs list
 *   node scripts/sounds.mjs add <file> [label]        import a custom sound
 *   node scripts/sounds.mjs map <slot> <soundId|file> [--off]   point a slot at a sound
 *   node scripts/sounds.mjs enable <slot>
 *   node scripts/sounds.mjs disable <slot>
 *   node scripts/sounds.mjs play <slot|soundId>       preview a sound
 *   node scripts/sounds.mjs remove <soundId>          delete an imported sound
 *
 * Slots: needs_input, failure, done, success, running
 */

import { access } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join, basename, extname } from "node:path";

import {
  SLOTS,
  defaultRootDir,
  notifierPaths,
  ensureUserData,
  importSound,
  readSoundLibrary,
  readSoundMappings,
  writeSoundMappings,
} from "../hooks/lib/sound-config.mjs";
import { previewSound } from "../hooks/lib/playback.mjs";

const rootDir = defaultRootDir();

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function isFile(p) {
  return access(p).then(() => true).catch(() => false);
}

async function findSound(idOrUnique) {
  const { sounds } = await readSoundLibrary(rootDir);
  return (
    sounds.find((s) => s.id === idOrUnique) ??
    sounds.find((s) => s.label === idOrUnique) ??
    null
  );
}

async function cmdList() {
  const { sounds } = await readSoundLibrary(rootDir);
  const mappings = await readSoundMappings(rootDir);
  console.log(`Data dir: ${rootDir}\n`);

  console.log("Slots:");
  for (const slot of SLOTS) {
    const m = mappings.slots?.[slot] ?? {};
    const sound = m.soundId ? sounds.find((s) => s.id === m.soundId) : null;
    const state = m.enabled ? "on " : "off";
    console.log(
      `  [${state}] ${slot.padEnd(12)} → ${sound ? sound.label : "(none)"}` +
        (m.soundId && !sound ? `  ⚠ missing sound ${m.soundId}` : ""),
    );
  }

  console.log("\nSounds:");
  for (const s of sounds) {
    console.log(`  ${s.id.padEnd(40)} ${s.kind.padEnd(9)} ${s.label}`);
  }
}

async function cmdAdd(file, label) {
  if (!file) fail("usage: add <file> [label]");
  if (!(await isFile(file))) fail(`file not found: ${file}`);
  const entry = await importSound(file, label ?? basename(file, extname(file)), {
    rootDir,
  });
  console.log(`✓ imported "${entry.label}" as ${entry.id}`);
  console.log(`  map it to a slot, e.g.:  node scripts/sounds.mjs map done ${entry.id}`);
}

async function resolveToSoundId(soundIdOrFile) {
  if (await isFile(soundIdOrFile)) {
    const entry = await importSound(
      soundIdOrFile,
      basename(soundIdOrFile, extname(soundIdOrFile)),
      { rootDir },
    );
    console.log(`✓ imported "${entry.label}" as ${entry.id}`);
    return entry.id;
  }
  const existing = await findSound(soundIdOrFile);
  if (!existing) fail(`no sound and no such file: ${soundIdOrFile}`);
  return existing.id;
}

async function cmdMap(slot, soundIdOrFile, off) {
  if (!slot || !soundIdOrFile) fail("usage: map <slot> <soundId|file> [--off]");
  if (!SLOTS.includes(slot)) fail(`unknown slot "${slot}". valid: ${SLOTS.join(", ")}`);
  const soundId = await resolveToSoundId(soundIdOrFile);
  const mappings = await readSoundMappings(rootDir);
  mappings.slots ??= {};
  mappings.slots[slot] = { soundId, enabled: !off };
  await writeSoundMappings(rootDir, mappings);
  console.log(`✓ ${slot} → ${soundId} (${off ? "disabled" : "enabled"})`);
}

async function cmdToggle(slot, enabled) {
  if (!slot) fail(`usage: ${enabled ? "enable" : "disable"} <slot>`);
  if (!SLOTS.includes(slot)) fail(`unknown slot "${slot}". valid: ${SLOTS.join(", ")}`);
  const mappings = await readSoundMappings(rootDir);
  mappings.slots ??= {};
  mappings.slots[slot] ??= { soundId: null, enabled };
  mappings.slots[slot].enabled = enabled;
  await writeSoundMappings(rootDir, mappings);
  console.log(`✓ ${slot} ${enabled ? "enabled" : "disabled"}`);
}

async function cmdPlay(target) {
  if (!target) fail("usage: play <slot|soundId>");
  let soundId = target;
  if (SLOTS.includes(target)) {
    const mappings = await readSoundMappings(rootDir);
    soundId = mappings.slots?.[target]?.soundId;
    if (!soundId) fail(`slot "${target}" has no sound mapped`);
  }
  const sound = await findSound(soundId);
  if (!sound?.filename) fail(`no playable sound for "${target}"`);
  const filePath = join(notifierPaths(rootDir).soundsDir, sound.filename);
  if (!(await isFile(filePath))) fail(`sound file missing: ${filePath}`);
  console.log(`▶ ${sound.label}`);
  await previewSound(filePath);
}

async function cmdRemove(soundId) {
  if (!soundId) fail("usage: remove <soundId>");
  const sound = await findSound(soundId);
  if (!sound) fail(`no such sound: ${soundId}`);
  if (sound.kind !== "imported") fail(`refusing to remove bundled sound "${sound.id}"`);

  const lib = await readSoundLibrary(rootDir);
  await writeSoundLibrary(lib.version, lib.sounds.filter((s) => s.id !== sound.id));

  // Unmap any slot pointing at it.
  const mappings = await readSoundMappings(rootDir);
  let unmapped = 0;
  for (const slot of Object.keys(mappings.slots ?? {})) {
    if (mappings.slots[slot]?.soundId === sound.id) {
      mappings.slots[slot] = { soundId: null, enabled: false };
      unmapped++;
    }
  }
  if (unmapped) await writeSoundMappings(rootDir, mappings);

  const filePath = join(notifierPaths(rootDir).soundsDir, sound.filename);
  await rm(filePath, { force: true });
  console.log(`✓ removed "${sound.label}" (${sound.id})${unmapped ? `, unmapped ${unmapped} slot(s)` : ""}`);
}

// Small writer (sound-config has no exported library writer).
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
async function writeSoundLibrary(version, sounds) {
  const { libraryFile } = notifierPaths(rootDir);
  await mkdir(dirname(libraryFile), { recursive: true });
  await writeFile(libraryFile, JSON.stringify({ version, sounds }, null, 2));
}

function usage() {
  console.log(
    [
      "Manage notifier sounds. Commands:",
      "  list                              show slots + sound library",
      "  add <file> [label]                import a custom sound",
      "  map <slot> <soundId|file> [--off] point a slot at a sound (imports a file if given)",
      "  enable <slot> | disable <slot>    toggle a slot",
      "  play <slot|soundId>               preview a sound",
      "  remove <soundId>                  delete an imported sound",
      "",
      `Slots: ${SLOTS.join(", ")}`,
    ].join("\n"),
  );
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const off = rest.includes("--off");
  const pos = rest.filter((a) => !a.startsWith("--"));

  // Make sure the data dir + bundled sounds exist before operating.
  await ensureUserData({ rootDir });

  switch (cmd) {
    case "list":
    case undefined:
      return cmdList();
    case "add":
      return cmdAdd(pos[0], pos.slice(1).join(" ") || undefined);
    case "map":
      return cmdMap(pos[0], pos[1], off);
    case "enable":
      return cmdToggle(pos[0], true);
    case "disable":
      return cmdToggle(pos[0], false);
    case "play":
      return cmdPlay(pos[0]);
    case "remove":
      return cmdRemove(pos[0]);
    case "help":
    case "-h":
    case "--help":
      return usage();
    default:
      console.error(`unknown command: ${cmd}\n`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => fail(err.message));
