const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

test("NeuralAdaptiveFleet uses Win2K label and accent tokens", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../dashboard/src/ui/matrix-a/components/NeuralAdaptiveFleet.jsx"),
    "utf8",
  );

  assert.match(
    src,
    /<span style=\{\{ fontWeight: "bold", fontSize: 11, color: "var\(--win-text\)" \}\}>\{label\}<\/span>/,
    "expected label to use the Win2K text token",
  );
  assert.match(
    src,
    /<span style=\{\{ fontWeight: "bold", fontSize: 13, color: "var\(--win-navy\)" \}\}>\{totalPercent\}<\/span>/,
    "expected totalPercent to use the Win2K accent token",
  );
});
