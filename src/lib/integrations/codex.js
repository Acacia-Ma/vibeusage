const {
  readCodexNotify,
  upsertCodexNotify,
  restoreCodexNotify,
} = require("../codex-config");
const { arraysEqual, isFile } = require("./utils");

module.exports = {
  name: "codex",
  summaryLabel: "Codex CLI",
  statusLabel: "Codex notify",
  async probe(ctx) {
    const installed = await isFile(ctx.codex.configPath);
    if (!installed) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }

    const currentNotify = await readCodexNotify(ctx.codex.configPath);
    const ready = arraysEqual(currentNotify, ctx.codex.notifyCmd);
    return baseProbe(this, {
      status: ready ? "ready" : "drifted",
      detail: ready ? "Config already set" : "Run vibeusage init to reconcile notify",
      configured: ready,
      currentNotify,
    });
  },
  async install(ctx) {
    if (!(await isFile(ctx.codex.configPath))) {
      return action(this, "skipped", false, "Config not found");
    }
    const result = await upsertCodexNotify({
      codexConfigPath: ctx.codex.configPath,
      notifyCmd: ctx.codex.notifyCmd,
      notifyOriginalPath: ctx.codex.notifyOriginalPath,
    });
    return action(
      this,
      result.changed ? "updated" : "set",
      Boolean(result.changed),
      result.changed ? "Updated config" : "Config already set",
    );
  },
  async uninstall(ctx) {
    if (!(await isFile(ctx.codex.configPath))) {
      return action(this, "skipped", false, "config.toml not found");
    }
    const result = await restoreCodexNotify({
      codexConfigPath: ctx.codex.configPath,
      notifyOriginalPath: ctx.codex.notifyOriginalPath,
      notifyCmd: ctx.codex.notifyCmd,
    });
    if (result.restored) {
      return action(this, "restored", true, ctx.codex.configPath);
    }
    if (result.skippedReason === "no-backup-not-installed") {
      return action(this, "skipped", false, "no backup; not installed");
    }
    return action(this, "unchanged", false, "no change");
  },
  renderStatusValue(probe) {
    if (probe.status === "ready") return JSON.stringify(probe.currentNotify || []);
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
