"use strict";

/**
 * Manage the `plugins.enabled` allow-list inside Hermes' config.yaml.
 *
 * Hermes (>= the v20→v21 migration) loads user plugins on an opt-in basis:
 * a plugin in `~/.hermes/plugins/<name>/` only fires its hooks if its name
 * appears in `plugins.enabled` of `~/.hermes/config.yaml` (see
 * `hermes_cli/plugins.py:_get_enabled_plugins` and the discovery loop at
 * `hermes_cli/plugins.py:641`).
 *
 * `installHermesPlugin` therefore must do TWO things to actually wire up the
 * vibeusage hook:
 *   1. Drop the plugin files into `~/.hermes/plugins/vibeusage/` (handled by
 *      `hermes-config.js`).
 *   2. Make sure `vibeusage` is listed under `plugins.enabled` here.
 *
 * Implementation notes:
 *   - We use the `yaml` package's `parseDocument` to preserve user comments,
 *     anchors, and key order. Plain `yaml.parse` + `yaml.stringify` would lose
 *     all of that.
 *   - All operations are idempotent. An already-enabled plugin stays as-is and
 *     the function reports `changed: false`.
 *   - The file is written atomically via writeFileAtomic to avoid leaving the
 *     user with a half-written config.yaml on crash.
 */

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const YAML = require("yaml");
const { writeFileAtomic } = require("./fs");

const HERMES_CONFIG_FILENAME = "config.yaml";

function resolveHermesConfigPath({ home = os.homedir(), env = process.env } = {}) {
  const explicit = typeof env.HERMES_HOME === "string" ? env.HERMES_HOME.trim() : "";
  const hermesHome = explicit ? path.resolve(explicit) : path.join(home, ".hermes");
  return path.join(hermesHome, HERMES_CONFIG_FILENAME);
}

/**
 * Probe whether a plugin name is currently enabled in `plugins.enabled`.
 *
 * Returns one of:
 *   - { state: "enabled" } — name appears in plugins.enabled
 *   - { state: "missing-key" } — config exists but plugins.enabled key is absent
 *   - { state: "missing-name" } — plugins.enabled exists but does not contain the name
 *   - { state: "config-missing" } — config.yaml does not exist
 *   - { state: "config-unreadable", error } — read or parse error
 */
async function probeEnabledPlugin({ home, env, name } = {}) {
  if (!name || typeof name !== "string") {
    throw new Error("name is required");
  }
  const configPath = resolveHermesConfigPath({ home, env });

  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return { state: "config-missing", configPath };
    }
    return {
      state: "config-unreadable",
      error: err && err.message ? err.message : String(err),
      configPath,
    };
  }

  let doc;
  try {
    doc = YAML.parseDocument(raw);
  } catch (err) {
    return {
      state: "config-unreadable",
      error: err && err.message ? err.message : String(err),
      configPath,
    };
  }
  if (doc.errors && doc.errors.length > 0) {
    return {
      state: "config-unreadable",
      error: doc.errors[0].message || "config.yaml has YAML errors",
      configPath,
    };
  }

  const enabled = doc.getIn(["plugins", "enabled"], true);
  if (enabled === undefined) {
    return { state: "missing-key", configPath };
  }
  const list = enabled && typeof enabled.toJSON === "function" ? enabled.toJSON() : enabled;
  if (!Array.isArray(list)) {
    return { state: "missing-key", configPath };
  }
  if (list.includes(name)) {
    return { state: "enabled", configPath };
  }
  return { state: "missing-name", configPath };
}

/**
 * Idempotently add `name` to plugins.enabled. Creates the `plugins:` map and
 * `enabled` sequence if either is missing. Preserves comments and surrounding
 * keys via parseDocument.
 *
 * Returns { changed, configPath, configCreated, alreadyEnabled }.
 */
async function addEnabledPlugin({ home, env, name } = {}) {
  if (!name || typeof name !== "string") {
    throw new Error("name is required");
  }
  const configPath = resolveHermesConfigPath({ home, env });

  let raw = "";
  let configCreated = false;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      configCreated = true;
    } else {
      throw err;
    }
  }

  const doc = raw ? YAML.parseDocument(raw) : new YAML.Document({});
  if (doc.errors && doc.errors.length > 0) {
    const err = new Error(`config.yaml has YAML errors: ${doc.errors[0].message}`);
    err.code = "HERMES_CONFIG_INVALID";
    throw err;
  }

  // Ensure plugins is a Map.
  let pluginsNode = doc.get("plugins", true);
  if (pluginsNode === undefined || pluginsNode === null) {
    doc.set("plugins", new YAML.YAMLMap());
    pluginsNode = doc.get("plugins", true);
  } else if (!(pluginsNode instanceof YAML.YAMLMap)) {
    // Existing non-map value (string, list, scalar). Refuse so we never silently
    // clobber user content. Caller should escalate to the user.
    const err = new Error(
      "plugins key in config.yaml is not a mapping; refusing to modify",
    );
    err.code = "HERMES_PLUGINS_NOT_MAP";
    throw err;
  }

  // Ensure plugins.enabled is a Seq.
  let enabledNode = pluginsNode.get("enabled", true);
  if (enabledNode === undefined || enabledNode === null) {
    pluginsNode.set("enabled", new YAML.YAMLSeq());
    enabledNode = pluginsNode.get("enabled", true);
  } else if (!(enabledNode instanceof YAML.YAMLSeq)) {
    const err = new Error(
      "plugins.enabled in config.yaml is not a sequence; refusing to modify",
    );
    err.code = "HERMES_PLUGINS_ENABLED_NOT_SEQ";
    throw err;
  }

  // Idempotent add.
  const current = enabledNode.toJSON() || [];
  if (Array.isArray(current) && current.includes(name)) {
    return {
      changed: false,
      configPath,
      configCreated: false,
      alreadyEnabled: true,
    };
  }
  enabledNode.add(name);

  const out = String(doc);
  await writeFileAtomic(configPath, out);

  return {
    changed: true,
    configPath,
    configCreated,
    alreadyEnabled: false,
  };
}

/**
 * Idempotently remove `name` from plugins.enabled. Cleans up empty container
 * keys (`plugins.enabled` if it becomes [], and `plugins` if it becomes {}).
 *
 * Returns { changed, configPath, wasEnabled }.
 */
async function removeEnabledPlugin({ home, env, name } = {}) {
  if (!name || typeof name !== "string") {
    throw new Error("name is required");
  }
  const configPath = resolveHermesConfigPath({ home, env });

  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return { changed: false, configPath, wasEnabled: false };
    }
    throw err;
  }

  const doc = YAML.parseDocument(raw);
  if (doc.errors && doc.errors.length > 0) {
    const err = new Error(`config.yaml has YAML errors: ${doc.errors[0].message}`);
    err.code = "HERMES_CONFIG_INVALID";
    throw err;
  }

  const pluginsNode = doc.get("plugins", true);
  if (!(pluginsNode instanceof YAML.YAMLMap)) {
    return { changed: false, configPath, wasEnabled: false };
  }
  const enabledNode = pluginsNode.get("enabled", true);
  if (!(enabledNode instanceof YAML.YAMLSeq)) {
    return { changed: false, configPath, wasEnabled: false };
  }

  // Find the index, since YAMLSeq.delete by name doesn't match by string value
  // reliably across all node shapes. Iterating and matching the JSON value is
  // the safe path.
  const items = enabledNode.items;
  let foundIndex = -1;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const value = item && typeof item === "object" && "value" in item ? item.value : item;
    if (value === name) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex < 0) {
    return { changed: false, configPath, wasEnabled: false };
  }

  enabledNode.delete(foundIndex);

  // Clean up empty containers so we don't leave noise in user config.
  if (enabledNode.items.length === 0) {
    pluginsNode.delete("enabled");
  }
  if (pluginsNode.items.length === 0) {
    doc.delete("plugins");
  }

  const out = String(doc);
  await writeFileAtomic(configPath, out);

  return { changed: true, configPath, wasEnabled: true };
}

module.exports = {
  HERMES_CONFIG_FILENAME,
  resolveHermesConfigPath,
  probeEnabledPlugin,
  addEnabledPlugin,
  removeEnabledPlugin,
};
