const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", relPath), "utf8");
}

function stripModulePrelude(content) {
  return content
    .split("\n")
    .filter((line) => !line.startsWith('require("./') && !line.startsWith('import "./'))
    .join("\n");
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
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /matchesCanonicalModelAtDate = usageModelCore\.matchesCanonicalModelAtDate/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /resolveUsageFilterContext = usageModelCore\.resolveUsageFilterContext/,
  );
  assert.match(read("insforge-src/shared/model-identity.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /resolveUsageFilterContext/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /resolveUsageFilterContext/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-hourly.js"),
    /matchesCanonicalModelAtDate/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"),
    /matchesCanonicalModelAtDate/,
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

test("backend canary debug and crypto helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/canary-core.js"),
    read("insforge-src/shared/canary-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/debug-core.js"),
    read("insforge-src/shared/debug-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/crypto-core.js"),
    read("insforge-src/shared/crypto-core.mjs"),
  );
  assert.match(read("insforge-src/shared/canary.js"), /canary-core/);
  assert.match(read("insforge-src/functions-esm/shared/canary.js"), /shared\/canary-core\.mjs/);
  assert.match(read("insforge-src/shared/debug.js"), /debug-core/);
  assert.match(read("insforge-src/functions-esm/shared/debug.js"), /shared\/debug-core\.mjs/);
  assert.match(read("insforge-src/shared/crypto.js"), /crypto-core/);
  assert.match(read("insforge-src/functions-esm/shared/crypto.js"), /shared\/crypto-core\.mjs/);
});

test("backend date and logging helpers flow through shared cores", () => {
  assert.equal(read("insforge-src/shared/date-core.js"), read("insforge-src/shared/date-core.mjs"));
  assert.equal(
    read("insforge-src/shared/logging-core.js"),
    read("insforge-src/shared/logging-core.mjs"),
  );
  assert.match(read("insforge-src/shared/date.js"), /date-core/);
  assert.match(read("insforge-src/functions-esm/shared/date.js"), /shared\/date-core\.mjs/);
  assert.match(read("insforge-src/shared/logging.js"), /logging-core/);
  assert.match(read("insforge-src/functions-esm/shared/logging.js"), /shared\/logging-core\.mjs/);
});

test("backend usage rollup and bucket helpers flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/pagination-core.js"),
    read("insforge-src/shared/pagination-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-rollup-core.js"),
    read("insforge-src/shared/usage-rollup-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-daily-core.js"),
    read("insforge-src/shared/usage-daily-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-filter-core.js"),
    read("insforge-src/shared/usage-filter-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-monthly-core.js"),
    read("insforge-src/shared/usage-monthly-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/usage-hourly-query-core.js"),
    read("insforge-src/shared/usage-hourly-query-core.mjs"),
  );
  assert.match(read("insforge-src/shared/pagination.js"), /pagination-core/);
  assert.match(read("insforge-src/shared/usage-rollup.js"), /usage-rollup-core/);
  assert.match(read("insforge-src/shared/core/usage-daily.js"), /usage-daily-core/);
  assert.match(read("insforge-src/shared/core/usage-filter.js"), /usage-filter-core/);
  assert.match(read("insforge-src/shared/core/usage-monthly.js"), /usage-monthly-core/);
  assert.match(read("insforge-src/shared/db/usage-hourly.js"), /usage-hourly-query-core/);
  assert.match(
    read("insforge-src/functions-esm/shared/usage-summary-support.js"),
    /shared\/pagination-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-daily.js"),
    /shared\/usage-daily-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-filter.js"),
    /shared\/usage-filter-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/core/usage-monthly.js"),
    /shared\/usage-monthly-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/shared/db/usage-hourly.js"),
    /shared\/usage-hourly-query-core\.mjs/,
  );
  assert.match(read("insforge-src/shared/usage-filter-core.js"), /matchesCanonicalModelAtDate/);
  assert.match(read("insforge-src/shared/usage-monthly-core.js"), /shouldIncludeUsageRow/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /shouldIncludeUsageRow/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /buildHourlyUsageQuery/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /buildHourlyUsageQuery/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-monthly.js"), /buildHourlyUsageQuery/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-hourly.js"), /buildHourlyUsageQuery/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-heatmap.js"), /buildHourlyUsageQuery/);
  assert.match(read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"), /buildHourlyUsageQuery/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /usage-rollup-core/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/shared/usage-summary-support.js"), /isRollupEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-summary.js"), /isRollupEnabled/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /fetchRollupRows/);
  assert.doesNotMatch(read("insforge-src/functions-esm/vibeusage-usage-daily.js"), /isRollupEnabled/);
});

test("backend leaderboard and user identity semantics flow through shared cores", () => {
  assert.equal(
    read("insforge-src/shared/user-identity-core.js"),
    read("insforge-src/shared/user-identity-core.mjs"),
  );
  assert.equal(
    read("insforge-src/shared/leaderboard-core.js"),
    read("insforge-src/shared/leaderboard-core.mjs"),
  );
  assert.match(read("insforge-src/shared/user-identity.js"), /user-identity-core/);
  assert.match(read("insforge-src/functions/vibeusage-leaderboard-refresh.js"), /leaderboard-core/);
  assert.match(read("insforge-src/functions/vibeusage-leaderboard-profile.js"), /leaderboard-core/);
  assert.match(
    read("insforge-src/functions-esm/vibeusage-leaderboard.js"),
    /shared\/leaderboard-core\.mjs/,
  );
});

test("backend usage pricing semantics flow through shared cores", () => {
  const usagePricingCoreJs = read("insforge-src/shared/usage-pricing-core.js");
  const usagePricingCoreMjs = read("insforge-src/shared/usage-pricing-core.mjs");
  assert.equal(stripModulePrelude(usagePricingCoreJs), stripModulePrelude(usagePricingCoreMjs));
  for (const dependency of [
    "runtime-primitives-core",
    "usage-model-core",
    "env-core",
    "pricing-core",
    "usage-metrics-core",
  ]) {
    assert.match(usagePricingCoreJs, new RegExp(`require\\(\\\"\\./${dependency}\\\"\\)`));
    assert.match(
      usagePricingCoreMjs,
      new RegExp(`import \\\"\\./${dependency}\\.mjs\\\"`),
    );
  }
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/usage-pricing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /resolveAggregateUsagePricing/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /shared\/usage-pricing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-daily.js"),
    /resolveAggregateUsagePricing/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js"),
    /shared\/usage-pricing-core\.mjs/,
  );
  assert.match(
    read("insforge-src/functions-esm/vibeusage-usage-summary.js"),
    /shared\/source\.js/,
  );
});
