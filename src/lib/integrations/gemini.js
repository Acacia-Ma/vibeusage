const {
  isGeminiHookConfigured,
  upsertGeminiHook,
  removeGeminiHook,
} = require("../gemini-config");
const { isDir, isFile } = require("./utils");

module.exports = {
  name: "gemini",
  summaryLabel: "Gemini",
  statusLabel: "Gemini hooks",
  async probe(ctx) {
    const hasConfigDir = await isDir(ctx.gemini.configDir);
    if (!hasConfigDir) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }
    const configured = await isGeminiHookConfigured({
      settingsPath: ctx.gemini.settingsPath,
      hookCommand: ctx.gemini.hookCommand,
    });
    return baseProbe(this, {
      status: configured ? "ready" : "drifted",
      detail: configured ? "Hooks installed" : "Run vibeusage init to reconcile hooks",
      configured,
    });
  },
  async install(ctx) {
    if (!(await isDir(ctx.gemini.configDir))) {
      return action(this, "skipped", false, "Config not found");
    }
    const result = await upsertGeminiHook({
      settingsPath: ctx.gemini.settingsPath,
      hookCommand: ctx.gemini.hookCommand,
    });
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Hooks installed" : "Hooks already installed",
    );
  },
  async uninstall(ctx) {
    if (!(await isDir(ctx.gemini.configDir))) {
      return action(this, "skipped", false, "config dir not found");
    }
    const result = await removeGeminiHook({
      settingsPath: ctx.gemini.settingsPath,
      hookCommand: ctx.gemini.hookCommand,
    });
    if (result.removed) {
      return action(this, "removed", true, ctx.gemini.settingsPath);
    }
    if (result.skippedReason === "hook-missing") {
      return action(this, "unchanged", false, "no change", {
        skippedReason: result.skippedReason,
      });
    }
    return action(this, "skipped", false, "settings.json not found");
  },
  renderStatusValue(probe) {
    if (probe.status === "ready") return "set";
    if (probe.status === "not_installed") return "unset";
    return probe.status;
  },
};

function baseProbe(descriptor, values) {
  return {
    name: descriptor.name,
    summaryLabel: descriptor.summaryLabel,
    statusLabel: descriptor.statusLabel,
    configured: false,
    ...values,
  };
}

function action(descriptor, status, changed, detail, extras = {}) {
  return {
    name: descriptor.name,
    label: descriptor.summaryLabel,
    status,
    changed,
    detail,
    ...extras,
  };
}
