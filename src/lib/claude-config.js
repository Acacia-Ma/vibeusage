const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir, readJson, writeJson } = require("./fs");

const DEFAULT_EVENTS = ["Stop", "SessionEnd"];

async function upsertClaudeHook({ settingsPath, hookCommand, events = DEFAULT_EVENTS }) {
  const existing = await readJson(settingsPath);
  const settings = normalizeSettings(existing);
  const hooks = normalizeHooks(settings.hooks);
  const targetEvents = normalizeEvents(events);
  let changed = false;
  const nextHooks = { ...hooks };

  for (const event of targetEvents) {
    const entries = normalizeEntries(nextHooks[event]);
    const normalized = normalizeEntriesForCommand(entries, hookCommand);
    if (normalized.changed) {
      nextHooks[event] = normalized.entries;
      changed = true;
      continue;
    }

    if (hasHook(entries, hookCommand)) continue;

    nextHooks[event] = entries.concat([{ hooks: [{ type: "command", command: hookCommand }] }]);
    changed = true;
  }

  if (!changed) return { changed: false, backupPath: null };

  const nextSettings = { ...settings, hooks: nextHooks };
  const backupPath = await writeClaudeSettings({ settingsPath, settings: nextSettings });
  return { changed: true, backupPath };
}

async function removeClaudeHook({ settingsPath, hookCommand, events = DEFAULT_EVENTS }) {
  const existing = await readJson(settingsPath);
  if (!existing) return { removed: false, skippedReason: "settings-missing" };

  const settings = normalizeSettings(existing);
  const hooks = normalizeHooks(settings.hooks);
  const targetEvents = normalizeEvents(events);
  let removed = false;
  const nextHooks = { ...hooks };
  for (const event of targetEvents) {
    const entries = normalizeEntries(hooks[event]);
    if (entries.length === 0) continue;

    const nextEntries = [];
    for (const entry of entries) {
      const res = stripHookFromEntry(entry, hookCommand);
      if (res.removed) removed = true;
      if (res.entry) nextEntries.push(res.entry);
    }

    if (nextEntries.length > 0) nextHooks[event] = nextEntries;
    else delete nextHooks[event];
  }

  if (!removed) return { removed: false, skippedReason: "hook-missing" };

  const nextSettings = { ...settings };
  if (Object.keys(nextHooks).length > 0) nextSettings.hooks = nextHooks;
  else delete nextSettings.hooks;

  const backupPath = await writeClaudeSettings({ settingsPath, settings: nextSettings });
  return { removed: true, skippedReason: null, backupPath };
}

async function isClaudeHookConfigured({ settingsPath, hookCommand, events = DEFAULT_EVENTS }) {
  const probe = await probeClaudeHook({ settingsPath, hookCommand, events });
  return probe.configured;
}

async function probeClaudeHook({ settingsPath, hookCommand, events = DEFAULT_EVENTS }) {
  const settings = await readJson(settingsPath);
  if (!settings || typeof settings !== "object") {
    return { configured: false, anyPresent: false, eventStates: {} };
  }
  const hooks = settings.hooks;
  if (!hooks || typeof hooks !== "object") {
    return { configured: false, anyPresent: false, eventStates: {} };
  }
  const targetEvents = normalizeEvents(events);
  const eventStates = {};
  for (const event of targetEvents) {
    eventStates[event] = hasHook(normalizeEntries(hooks[event]), hookCommand);
  }
  const anyPresent = Object.values(eventStates).some(Boolean);
  return {
    configured: targetEvents.every((event) => eventStates[event] === true),
    anyPresent,
    eventStates,
  };
}

function buildClaudeHookCommand(notifyPath) {
  const cmd = typeof notifyPath === "string" ? notifyPath : "";
  return `/usr/bin/env node ${quoteArg(cmd)} --source=claude`;
}

function normalizeSettings(raw) {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function normalizeHooks(raw) {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function normalizeEntries(raw) {
  return Array.isArray(raw) ? raw.slice() : [];
}

function normalizeEvents(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized || out.includes(normalized)) continue;
    out.push(normalized);
  }
  return out.length > 0 ? out : DEFAULT_EVENTS.slice();
}

function normalizeCommand(cmd) {
  if (Array.isArray(cmd)) return cmd.map((v) => String(v)).join("\u0000");
  if (typeof cmd === "string") {
    const raw = cmd.trim();
    if (!raw) return null;
    const parsed = splitShellCommand(raw);
    if (parsed) return parsed.join("\u0000");
    return raw;
  }
  return null;
}

function hasHook(entries, hookCommand) {
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.command && commandsEqual(entry.command, hookCommand)) return true;
    const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const hook of hooks) {
      if (hook && commandsEqual(hook.command, hookCommand)) return true;
    }
  }
  return false;
}

function stripHookFromEntry(entry, hookCommand) {
  if (!entry || typeof entry !== "object") return { entry, removed: false };

  if (entry.command) {
    if (commandsEqual(entry.command, hookCommand)) return { entry: null, removed: true };
    return { entry, removed: false };
  }

  const hooks = Array.isArray(entry.hooks) ? entry.hooks : null;
  if (!hooks) return { entry, removed: false };

  const nextHooks = hooks.filter((hook) => !commandsEqual(hook?.command, hookCommand));
  if (nextHooks.length === hooks.length) return { entry, removed: false };
  if (nextHooks.length === 0) return { entry: null, removed: true };

  return { entry: { ...entry, hooks: nextHooks }, removed: true };
}

function normalizeEntriesForCommand(entries, hookCommand) {
  let changed = false;
  const nextEntries = entries.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    if (entry.command && commandsEqual(entry.command, hookCommand)) {
      if (entry.type !== "command") {
        changed = true;
        return { ...entry, type: "command" };
      }
      return entry;
    }
    if (!Array.isArray(entry.hooks)) return entry;
    let hooksChanged = false;
    const nextHooks = entry.hooks.map((hook) => {
      if (hook && commandsEqual(hook.command, hookCommand)) {
        if (hook.type !== "command") {
          hooksChanged = true;
          return { ...hook, type: "command" };
        }
      }
      return hook;
    });
    if (!hooksChanged) return entry;
    changed = true;
    return { ...entry, hooks: nextHooks };
  });
  return { entries: nextEntries, changed };
}

function commandsEqual(a, b) {
  const left = normalizeCommand(a);
  const right = normalizeCommand(b);
  return Boolean(left && right && left === right);
}

function quoteArg(value) {
  const v = typeof value === "string" ? value : "";
  if (!v) return '""';
  if (/^[A-Za-z0-9_\-./:@]+$/.test(v)) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

function splitShellCommand(raw) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }

    if (ch === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (escaping || quote) return null;
  if (current) parts.push(current);
  return parts.length > 0 ? parts : null;
}

async function writeClaudeSettings({ settingsPath, settings }) {
  await ensureDir(path.dirname(settingsPath));
  let backupPath = null;
  try {
    const st = await fs.stat(settingsPath);
    if (st && st.isFile()) {
      backupPath = `${settingsPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await fs.copyFile(settingsPath, backupPath);
    }
  } catch (_e) {
    // Ignore missing file.
  }
  await writeJson(settingsPath, settings);
  return backupPath;
}

module.exports = {
  DEFAULT_EVENTS,
  upsertClaudeHook,
  removeClaudeHook,
  isClaudeHookConfigured,
  probeClaudeHook,
  buildClaudeHookCommand,
};
