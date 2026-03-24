const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

test("copy registry runtime and tooling reuse the shared parser", () => {
  assert.match(read("dashboard/src/lib/copy.ts"), /src\/shared\/copy-registry\.js/);
  assert.match(read("scripts/validate-copy-registry.cjs"), /src\/shared\/copy-registry/);
  assert.match(read("dashboard/vite.config.js"), /src\/shared\/copy-registry\.js/);
});

test("runtime defaults are imported from a shared module", () => {
  assert.match(read("src/lib/runtime-config.js"), /shared\/runtime-defaults/);
  assert.match(read("dashboard/src/lib/config.ts"), /shared\/runtime-defaults\.js/);
  assert.match(read("scripts\/acceptance\/usage-cost-consistency.cjs"), /shared\/runtime-defaults/);
});

test("dashboard and cli API clients reuse the shared function contract", () => {
  assert.match(read("dashboard/src/lib/vibeusage-api.ts"), /shared\/vibeusage-function-contract\.js/);
  assert.match(read("src/lib/vibeusage-api.js"), /shared\/vibeusage-function-contract/);
});
