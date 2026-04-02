const {
  readEveryCodeNotify,
  upsertEveryCodeNotify,
  restoreEveryCodeNotify,
} = require("../codex-config");
const { arraysEqual, isFile } = require("./utils");

module.exports = {
  name: "every-code",
  summaryLabel: "Every Code",
  statusLabel: "Every Code notify",
  async probe(ctx) {
    const installed = await isFile(ctx.everyCode.configPath);
    if (!installed) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }

    const currentNotify = await readEveryCodeNotify(ctx.everyCode.configPath);
    const ready = arraysEqual(currentNotify, ctx.everyCode.notifyCmd);
    return baseProbe(this, {
      status: ready ? "ready" : "drifted",
      detail: ready ? "Config already set" : "Run vibeusage init to reconcile notify",
      configured: ready,
      currentNotify,
    });
  },
  async install(ctx) {
    if (!(await isFile(ctx.everyCode.configPath))) {
      return action(this, "skipped", false, "Config not found");
    }
    const result = await upsertEveryCodeNotify({
      codeConfigPath: ctx.everyCode.configPath,
      notifyCmd: ctx.everyCode.notifyCmd,
      notifyOriginalPath: ctx.everyCode.notifyOriginalPath,
    });
    return action(
      this,
      result.changed ? "updated" : "set",
      Boolean(result.changed),
      result.changed ? "Updated config" : "Config already set",
    );
  },
  async uninstall(ctx) {
    if (!(await isFile(ctx.everyCode.configPath))) {
      return action(this, "skipped", false, "config.toml not found");
    }
    const result = await restoreEveryCodeNotify({
      codeConfigPath: ctx.everyCode.configPath,
      notifyOriginalPath: ctx.everyCode.notifyOriginalPath,
      notifyCmd: ctx.everyCode.notifyCmd,
    });
    if (result.restored) {
      return action(this, "restored", true, ctx.everyCode.configPath);
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
