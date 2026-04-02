const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copyPath = path.join(root, "dashboard", "src", "content", "copy.csv");
const fleetPath = path.join(
  root,
  "dashboard",
  "src",
  "ui",
  "matrix-a",
  "components",
  "NeuralAdaptiveFleet.jsx",
);
const upgradePath = path.join(
  root,
  "dashboard",
  "src",
  "ui",
  "matrix-a",
  "components",
  "UpgradeAlertModal.jsx",
);
const matrixShellPath = path.join(
  root,
  "dashboard",
  "src",
  "ui",
  "foundation",
  "MatrixShell.jsx",
);

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasCopyKey(csv, key) {
  return csv.startsWith(`${key},`) || csv.includes(`\n${key},`);
}

test("dashboard copy registry covers fleet usage and upgrade alert text", () => {
  const csv = read(copyPath);
  const requiredKeys = [
    "dashboard.model_breakdown.usage_label",
    "dashboard.upgrade_alert.title",
    "dashboard.upgrade_alert.subtitle",
    "dashboard.upgrade_alert.subtitle_generic",
    "dashboard.upgrade_alert.copy",
    "dashboard.upgrade_alert.copied",
    "dashboard.upgrade_alert.ignore",
    "dashboard.upgrade_alert.sparkle",
    "dashboard.upgrade_alert.prompt",
    "dashboard.upgrade_alert.install_command",
  ];

  for (const key of requiredKeys) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("copy registry covers MatrixShell menu labels", () => {
  const csv = read(copyPath);
  const requiredKeys = [
    "shell.menu.file",
    "shell.menu.view",
    "shell.menu.tools",
    "shell.menu.help",
  ];

  for (const key of requiredKeys) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("fleet usage and upgrade alert components use copy keys", () => {
  const fleetSource = read(fleetPath);
  assert.ok(
    fleetSource.includes('copy("dashboard.model_breakdown.usage_label"'),
    "expected fleet usage label to use copy key",
  );
  assert.ok(!fleetSource.includes("Usage:"), "expected hardcoded usage label removed");

  const upgradeSource = read(upgradePath);
  const requiredUpgradeKeys = [
    "dashboard.upgrade_alert.title",
    "dashboard.upgrade_alert.subtitle",
    "dashboard.upgrade_alert.subtitle_generic",
    "dashboard.upgrade_alert.copy",
    "dashboard.upgrade_alert.copied",
    "dashboard.upgrade_alert.ignore",
    "dashboard.upgrade_alert.sparkle",
    "dashboard.upgrade_alert.prompt",
    "dashboard.upgrade_alert.install_command",
  ];
  for (const key of requiredUpgradeKeys) {
    assert.ok(
      upgradeSource.includes(`copy(\"${key}\"`),
      `expected UpgradeAlertModal to use copy key ${key}`,
    );
  }

  const bannedLiterals = [
    "System_Upgrade_Pending",
    "Protocol v",
    "[ COPY ]",
    "[ COPIED ]",
    "[ IGNORE_NOTICE ]",
    "✨",
  ];
  for (const literal of bannedLiterals) {
    assert.ok(
      !upgradeSource.includes(literal),
      `expected UpgradeAlertModal to remove hardcoded text: ${literal}`,
    );
  }
});

test("MatrixShell uses copy keys for menu labels and preserves banner offset", () => {
  const shellSource = read(matrixShellPath);
  const requiredShellKeys = [
    "shell.menu.file",
    "shell.menu.view",
    "shell.menu.tools",
    "shell.menu.help",
  ];

  for (const key of requiredShellKeys) {
    assert.ok(
      shellSource.includes(`copy(\"${key}\")`),
      `expected MatrixShell to use copy key ${key}`,
    );
  }

  const bannedLiterals = [">File<", ">View<", ">Tools<", ">Help<"];
  for (const literal of bannedLiterals) {
    assert.ok(
      !shellSource.includes(literal),
      `expected MatrixShell to remove hardcoded menu literal ${literal}`,
    );
  }

  assert.ok(
    shellSource.includes("var(--matrix-banner-offset, 0px)"),
    "expected MatrixShell content wrapper to preserve banner offset spacing",
  );
});
