const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const {
  buildClaudeHookCommand,
  isClaudeHookConfigured,
  upsertClaudeHook,
} = require("./claude-config");
const { resolveTrackerPaths } = require("./tracker-paths");

async function autoHealRuntimeIntegrations({ home = os.homedir() } = {}) {
  const results = [];
  const { binDir } = await resolveTrackerPaths({ home });
  const notifyPath = path.join(binDir, "notify.cjs");
  if (!(await isFile(notifyPath))) return results;

  const claudeDir = path.join(home, ".claude");
  if (await isDir(claudeDir)) {
    const settingsPath = path.join(claudeDir, "settings.json");
    const hookCommand = buildClaudeHookCommand(notifyPath);
    const configured = await isClaudeHookConfigured({ settingsPath, hookCommand });
    if (!configured) {
      const res = await upsertClaudeHook({ settingsPath, hookCommand });
      results.push({ integration: "claude", changed: Boolean(res?.changed) });
    }
  }

  return results;
}

async function tryAutoHealRuntimeIntegrations({ home = os.homedir() } = {}) {
  try {
    return await autoHealRuntimeIntegrations({ home });
  } catch (err) {
    if (process.env.VIBEUSAGE_DEBUG === "1") {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write(`Runtime auto-heal skipped: ${msg}\n`);
    }
    return [];
  }
}

async function isDir(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch (_err) {
    return false;
  }
}

async function isFile(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch (_err) {
    return false;
  }
}

module.exports = {
  autoHealRuntimeIntegrations,
  tryAutoHealRuntimeIntegrations,
};
