const { probeOpenclawHookState, removeOpenclawHookConfig } = require("../openclaw-hook");

module.exports = {
  name: "openclaw-legacy",
  summaryLabel: "OpenClaw Hook (legacy)",
  statusLabel: "OpenClaw hook (legacy)",
  async probe(ctx) {
    const state = await probeOpenclawHookState({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (state?.skippedReason === "openclaw-config-missing") {
      return baseProbe(this, { status: "not_installed", detail: "OpenClaw config not found" });
    }
    if (state?.configured || state?.linked || state?.enabled) {
      return baseProbe(this, {
        status: "unsupported_legacy",
        detail: "Legacy OpenClaw hook detected; run vibeusage init",
        linked: Boolean(state.linked),
        enabled: Boolean(state.enabled),
      });
    }
    return baseProbe(this, { status: "not_installed", detail: "Legacy hook not installed" });
  },
  async install(ctx) {
    const state = await probeOpenclawHookState({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (!(state?.configured || state?.linked || state?.enabled)) {
      return action(this, "unchanged", false, "no change");
    }
    const result = await removeOpenclawHookConfig({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (result?.removed) {
      return action(this, "updated", true, "Removed legacy command hook");
    }
    return action(this, "unchanged", false, "no change");
  },
  async uninstall(ctx) {
    const result = await removeOpenclawHookConfig({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (result?.removed) {
      return action(this, "removed", true, result.openclawConfigPath);
    }
    if (result?.skippedReason === "openclaw-config-missing") {
      return action(this, "skipped", false, "openclaw config not found");
    }
    return action(this, "unchanged", false, "no change");
  },
  renderStatusValue(probe) {
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
