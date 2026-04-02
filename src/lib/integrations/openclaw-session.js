const {
  installOpenclawSessionPlugin,
  probeOpenclawSessionPluginState,
  removeOpenclawSessionPluginConfig,
} = require("../openclaw-session-plugin");

module.exports = {
  name: "openclaw-session",
  summaryLabel: "OpenClaw Session Plugin",
  statusLabel: "OpenClaw session plugin",
  async probe(ctx) {
    const state = await probeOpenclawSessionPluginState({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (state?.skippedReason === "openclaw-config-missing") {
      return baseProbe(this, { status: "not_installed", detail: "OpenClaw config not found" });
    }
    if (state?.configured) {
      return baseProbe(this, {
        status: "ready",
        detail: "Session plugin linked",
        configured: true,
        linked: Boolean(state.linked),
        enabled: Boolean(state.enabled),
      });
    }
    return baseProbe(this, {
      status: "drifted",
      detail: "Run vibeusage init to reconcile session plugin",
      linked: Boolean(state?.linked),
      enabled: Boolean(state?.enabled),
    });
  },
  async install(ctx) {
    const before = await probeOpenclawSessionPluginState({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    const result = await installOpenclawSessionPlugin({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      packageName: "vibeusage",
      env: ctx.env,
    });
    if (result?.skippedReason === "openclaw-cli-missing") {
      return action(this, "skipped", false, "OpenClaw CLI not found");
    }
    if (result?.skippedReason === "openclaw-plugins-install-failed") {
      return action(this, "skipped", false, `Install failed: ${result.error || "unknown error"}`);
    }
    if (result?.skippedReason === "openclaw-config-unreadable") {
      return action(
        this,
        "skipped",
        false,
        result.error ? `OpenClaw config unreadable: ${result.error}` : "OpenClaw config unreadable",
      );
    }
    return action(
      this,
      before?.configured ? "set" : "installed",
      Boolean(!before?.configured && result?.configured),
      before?.configured
        ? "Session plugin already linked"
        : "Session plugin linked (restart OpenClaw gateway to activate)",
    );
  },
  async uninstall(ctx) {
    const result = await removeOpenclawSessionPluginConfig({
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
