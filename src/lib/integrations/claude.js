const { probeClaudeHook, upsertClaudeHook, removeClaudeHook } = require("../claude-config");
const { isDir, isFile } = require("./utils");

module.exports = {
  name: "claude",
  summaryLabel: "Claude",
  statusLabel: "Claude hooks",
  async probe(ctx) {
    const hasConfigDir = await isDir(ctx.claude.configDir);
    if (!hasConfigDir) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }

    const hasSettings = await isFile(ctx.claude.settingsPath);
    if (!hasSettings) {
      return baseProbe(this, { status: "drifted", detail: "Run vibeusage init to install hooks" });
    }

    const hookState = await probeClaudeHook({
      settingsPath: ctx.claude.settingsPath,
      hookCommand: ctx.claude.hookCommand,
    });

    if (hookState.configured) {
      return baseProbe(this, {
        status: "ready",
        detail: "Hooks installed",
        configured: true,
        hookState,
      });
    }

    const sessionEndPresent = hookState.eventStates?.SessionEnd === true;
    const stopPresent = hookState.eventStates?.Stop === true;
    const status = hookState.anyPresent && sessionEndPresent && !stopPresent
      ? "unsupported_legacy"
      : "drifted";
    return baseProbe(this, {
      status,
      detail:
        status === "unsupported_legacy"
          ? "Legacy hook config detected; run vibeusage init"
          : "Run vibeusage init to reconcile hooks",
      hookState,
    });
  },
  async install(ctx) {
    if (!(await isDir(ctx.claude.configDir))) {
      return action(this, "skipped", false, "Config not found");
    }
    const result = await upsertClaudeHook({
      settingsPath: ctx.claude.settingsPath,
      hookCommand: ctx.claude.hookCommand,
    });
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Hooks installed" : "Hooks already installed",
    );
  },
  async uninstall(ctx) {
    if (!(await isFile(ctx.claude.settingsPath))) {
      return action(this, "skipped", false, "settings.json not found");
    }
    const result = await removeClaudeHook({
      settingsPath: ctx.claude.settingsPath,
      hookCommand: ctx.claude.hookCommand,
    });
    if (result.removed) {
      return action(this, "removed", true, ctx.claude.settingsPath);
    }
    if (result.skippedReason === "hook-missing") {
      return action(this, "unchanged", false, "no change");
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

function action(descriptor, status, changed, detail) {
  return {
    name: descriptor.name,
    label: descriptor.summaryLabel,
    status,
    changed,
    detail,
  };
}
