const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("TopModelsPanel renders share column with Win2K accent token", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../dashboard/src/ui/matrix-a/components/TopModelsPanel.jsx"),
    "utf8",
  );

  assert.match(
    src,
    /color: "var\(--win-text-accent\)"/,
    "expected share column to use the Win2K accent token",
  );
});
