const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("UsagePanel renders status label with Win2K online token", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../dashboard/src/ui/matrix-a/components/UsagePanel.jsx"),
    "utf8",
  );

  assert.match(
    src,
    /style=\{\{ fontSize: 11, color: "var\(--win-green\)" \}\}/,
    "expected statusLabel wrapper to use the Win2K online token",
  );
});
