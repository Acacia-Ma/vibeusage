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

test("backend model semantics flow through a single shared core", () => {
  assert.equal(
    read("insforge-src/shared/usage-model-core.js"),
    read("insforge-src/shared/usage-model-core.mjs"),
  );
  assert.match(read("insforge-src/shared/model.js"), /usage-model-core/);
  assert.match(read("insforge-src/shared/model-identity.js"), /usage-model-core/);
  assert.match(read("insforge-src/shared/model-alias-timeline.js"), /usage-model-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/usage-model-core\.mjs/,
  );
});

test("backend pricing and usage metrics semantics flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/runtime-primitives-core.js"),
    read("insforge-src/shared/runtime-primitives-core.mjs"),
  );
  assert.equal(read("insforge-src/shared/env-core.js"), read("insforge-src/shared/env-core.mjs"));
  assert.equal(
    read("insforge-src/shared/pricing-core.js"),
    read("insforge-src/shared/pricing-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-metrics-core.js"),
    read("insforge-src/shared/usage-metrics-core.mjs"),
  );
  assert.match(read("insforge-src/shared/numbers.js"), /runtime-primitives-core/);
  assert.match(read("insforge-src/shared/source.js"), /runtime-primitives-core/);
  assert.match(read("insforge-src/functions-esm/shared/numbers.js"), /runtime-primitives-core\.mjs/);
  assert.match(read("insforge-src/functions-esm/shared/source.js"), /runtime-primitives-core\.mjs/);
  assert.match(read("insforge-src/shared/env.js"), /env-core/);
  assert.match(read("insforge-src/functions-esm/shared/env.js"), /env-core\.mjs/);
  assert.match(read("insforge-src/shared/date.js"), /require\("\.\/env"\)/);
  assert.match(read("insforge-src/shared/logging.js"), /require\("\.\/env"\)/);
  assert.match(read("insforge-src/shared/pricing.js"), /pricing-core/);
  assert.match(read("insforge-src/shared/usage-billable.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/usage-aggregate.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/usage-rollup.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/shared/core/usage-summary.js"), /usage-metrics-core/);
  assert.match(read("insforge-src/functions-esm/shared/pricing.js"), /shared\/pricing-core\.mjs/);
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/usage-metrics-core\.mjs/,
  );
});

test("backend auth and public sharing semantics flow through shared cores", () => {
  assert.equal(read("insforge-src/shared/auth-core.js"), read("insforge-src/shared/auth-core.mjs"));
  assert.equal(
    read("insforge-src/shared/public-sharing-core.js"),
    read("insforge-src/shared/public-sharing-core.mjs"),
  );
  assert.match(read("insforge-src/shared/auth.js"), /auth-core/);
  assert.match(read("insforge-src/shared/public-view.js"), /public-sharing-core/);
  assert.match(read("insforge-src/shared/public-visibility.js"), /public-sharing-core/);
  assert.match(read("insforge-src/functions-esm/shared/auth.js"), /shared\/auth-core\.mjs/);
  assert.match(
    read("insforge-src/functions-esm/shared/public-view.js"),
    /shared\/public-sharing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/public-visibility.js"),
    /shared\/public-sharing-core\.mjs/,
  );
});

test("backend pro status and http helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/pro-status-core.js"),
    read("insforge-src/shared/pro-status-core.mjs"),
  );
  assert.equal(read("insforge-src/shared/http-core.js"), read("insforge-src/shared/http-core.mjs"));
  assert.match(read("insforge-src/shared/pro-status.js"), /pro-status-core/);
  assert.match(read("insforge-src/functions-esm/shared/pro-status.js"), /shared\/pro-status-core\.mjs/);
  assert.match(read("insforge-src/shared/http.js"), /http-core/);
  assert.match(read("insforge-src/functions-esm/shared/http.js"), /shared\/http-core\.mjs/);
});
