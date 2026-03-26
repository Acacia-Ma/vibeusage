const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");
const { createClient } = require("@insforge/sdk");
const { logSlowQuery } = require("../insforge-src/shared/logging");
const {
  getUsageMaxDays,
  isWithinInterval,
  normalizeIso,
  resolveUsageDateRangeLocal,
} = require("../insforge-src/shared/date");
const { sha256Hex } = require("../insforge-src/shared/crypto");
const { normalizeUsageModel, applyUsageModelFilter } = require("../insforge-src/shared/model");
const { resolveIdentityAtDate } = require("../insforge-src/shared/model-alias-timeline");
const pricing = require("../insforge-src/shared/pricing");
require("../insforge-src/shared/date-core");
require("../insforge-src/shared/user-identity-core");
require("../insforge-src/shared/leaderboard-core");
const leaderboardCore = globalThis.__vibeusageLeaderboardCore;
require("../insforge-src/shared/runtime-primitives-core");
require("../insforge-src/shared/env-core");
require("../insforge-src/shared/usage-model-core");
require("../insforge-src/shared/pricing-core");
require("../insforge-src/shared/usage-metrics-core");
const usageMetricsCore = globalThis.__vibeusageUsageMetricsCore;
require("../insforge-src/shared/usage-row-core");
const usageRowCore = globalThis.__vibeusageUsageRowCore;
require("../insforge-src/shared/usage-row-collector-core");
const usageRowCollectorCore = globalThis.__vibeusageUsageRowCollectorCore;
require("../insforge-src/shared/usage-aggregate-request-core");
const usageAggregateRequestCore = globalThis.__vibeusageUsageAggregateRequestCore;
require("../insforge-src/shared/usage-range-request-core");
const usageRangeRequestCore = globalThis.__vibeusageUsageRangeRequestCore;
require("../insforge-src/shared/usage-filter-request-core");
const usageFilterRequestCore = globalThis.__vibeusageUsageFilterRequestCore;
require("../insforge-src/shared/usage-hourly-core");
const usageHourlyCore = globalThis.__vibeusageUsageHourlyCore;
require("../insforge-src/shared/usage-heatmap-core");
const usageHeatmapCore = globalThis.__vibeusageUsageHeatmapCore;
require("../insforge-src/shared/usage-response-core");
const usageResponseCore = globalThis.__vibeusageUsageResponseCore;
require("../insforge-src/shared/project-usage-core");
const projectUsageCore = globalThis.__vibeusageProjectUsageCore;
require("../insforge-src/shared/usage-pricing-core");
const usagePricingCore = globalThis.__vibeusageUsagePricingCore;
const usageAggregateCollector = require("../insforge-src/shared/core/usage-aggregate-collector");
const usageAggregateRequest = require("../insforge-src/shared/core/usage-aggregate-request");
const usageRangeRequest = require("../insforge-src/shared/core/usage-range-request");
const usageFilterRequest = require("../insforge-src/shared/core/usage-filter-request");
const usageRowCollector = require("../insforge-src/shared/core/usage-row-collector");
const usageResponse = require("../insforge-src/shared/core/usage-response");

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

function createPricingEdgeClient({ aliasRows = [], profileRows = [] } = {}) {
  return {
    database: {
      from: (table) => {
        const rows =
          table === "vibeusage_model_aliases" || table === "vibeusage_pricing_model_aliases"
            ? aliasRows
            : table === "vibeusage_pricing_profiles"
              ? profileRows
              : [];
        const state = {
          filters: {},
          select() {
            return this;
          },
          eq(field, value) {
            this.filters[field] = value;
            return this;
          },
          in(field, value) {
            this.filters[field] = Array.isArray(value) ? value : [value];
            return this;
          },
          lt(field, value) {
            this.filters.lt = { field, value };
            return this;
          },
          lte(field, value) {
            this.filters.lte = { field, value };
            return this;
          },
          or(value) {
            this.filters.or = value;
            return this;
          },
          order() {
            let data = rows;
            if (this.filters.active !== undefined) {
              data = data.filter((row) => row.active === this.filters.active);
            }
            if (this.filters.source) {
              data = data.filter((row) => row.source === this.filters.source);
            }
            if (this.filters.pricing_source) {
              data = data.filter((row) => row.pricing_source === this.filters.pricing_source);
            }
            if (this.filters.usage_model) {
              const allowed = Array.isArray(this.filters.usage_model)
                ? this.filters.usage_model
                : [this.filters.usage_model];
              data = data.filter((row) => allowed.includes(row.usage_model));
            }
            if (this.filters.model) {
              data = data.filter((row) => row.model === this.filters.model);
            }
            if (this.filters.lt) {
              const { field, value } = this.filters.lt;
              data = data.filter((row) => String(row[field] || "") < String(value));
            }
            if (this.filters.lte) {
              const { field, value } = this.filters.lte;
              data = data.filter((row) => String(row[field] || "") <= String(value));
            }
            this.data = data;
            this.error = null;
            return this;
          },
          limit() {
            const data = Array.isArray(this.data) ? this.data : rows;
            return { data, error: null };
          },
        };
        return state;
      },
    },
  };
}

function createHourlyUsageEdgeClient(rows = []) {
  return {
    database: {
      from: (table) => {
        assert.equal(table, "vibeusage_tracker_hourly");
        const state = {
          filters: {},
          select() {
            return this;
          },
          eq(field, value) {
            this.filters.eq = this.filters.eq || {};
            this.filters.eq[field] = value;
            return this;
          },
          neq(field, value) {
            this.filters.neq = this.filters.neq || {};
            this.filters.neq[field] = value;
            return this;
          },
          gte(field, value) {
            this.filters.gte = { field, value };
            return this;
          },
          lt(field, value) {
            this.filters.lt = { field, value };
            return this;
          },
          order() {
            return this;
          },
          async range(start, end) {
            let data = rows.slice();
            if (this.filters.eq) {
              for (const [field, value] of Object.entries(this.filters.eq)) {
                data = data.filter((row) => row[field] === value);
              }
            }
            if (this.filters.neq) {
              for (const [field, value] of Object.entries(this.filters.neq)) {
                data = data.filter((row) => row[field] !== value);
              }
            }
            if (this.filters.gte) {
              const { field, value } = this.filters.gte;
              data = data.filter((row) => String(row[field] || "") >= String(value));
            }
            if (this.filters.lt) {
              const { field, value } = this.filters.lt;
              data = data.filter((row) => String(row[field] || "") < String(value));
            }
            data.sort((a, b) => String(a.hour_start || "").localeCompare(String(b.hour_start || "")));
            return { data: data.slice(start, end + 1), error: null };
          },
        };
        return state;
      },
    },
  };
}

function createProjectUsageQueryEdgeClient() {
  return {
    database: {
      from: (table) => {
        assert.equal(table, "vibeusage_project_usage_hourly");
        return {
          selectValue: null,
          filters: [],
          orders: [],
          limitValue: null,
          select(value) {
            this.selectValue = value;
            return this;
          },
          eq(field, value) {
            this.filters.push({ op: "eq", field, value });
            return this;
          },
          neq(field, value) {
            this.filters.push({ op: "neq", field, value });
            return this;
          },
          order(field, options) {
            this.orders.push({ field, options: options || null });
            return this;
          },
          limit(value) {
            this.limitValue = value;
            return this;
          },
        };
      },
    },
  };
}

test("insforge shared logging module exists", () => {
  const loggingPath = path.join(__dirname, "..", "insforge-src", "shared", "logging.js");
  assert.ok(fs.existsSync(loggingPath), "expected insforge-src/shared/logging.js");
});

test("logSlowQuery emits only above threshold (VIBEUSAGE env)", { concurrency: 1 }, () => {
  const prevThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;
  const logs = [];
  const logger = {
    log: (payload) => logs.push(payload),
  };

  try {
    process.env.VIBEUSAGE_SLOW_QUERY_MS = "50";

    logSlowQuery(logger, { query_label: "test", duration_ms: 40, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: "test", duration_ms: 60, row_count: 1 });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].stage, "slow_query");
    assert.equal(logs[0].query_label, "test");
    assert.equal(logs[0].row_count, 1);
    assert.ok(typeof logs[0].duration_ms === "number");
  } finally {
    if (prevThreshold === undefined) delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    else process.env.VIBEUSAGE_SLOW_QUERY_MS = prevThreshold;
  }
});

test("logSlowQuery ignores VIBESCORE env when VIBEUSAGE missing", { concurrency: 1 }, () => {
  const prevNewThreshold = process.env.VIBEUSAGE_SLOW_QUERY_MS;
  const prevLegacyThreshold = process.env.VIBESCORE_SLOW_QUERY_MS;
  const logs = [];
  const logger = {
    log: (payload) => logs.push(payload),
  };

  try {
    delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    process.env.VIBESCORE_SLOW_QUERY_MS = "40";

    logSlowQuery(logger, { query_label: "test", duration_ms: 30, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: "test", duration_ms: 50, row_count: 1 });
    assert.equal(logs.length, 0);

    logSlowQuery(logger, { query_label: "test", duration_ms: 2100, row_count: 1 });
    assert.equal(logs.length, 1);
  } finally {
    if (prevNewThreshold === undefined) delete process.env.VIBEUSAGE_SLOW_QUERY_MS;
    else process.env.VIBEUSAGE_SLOW_QUERY_MS = prevNewThreshold;
    if (prevLegacyThreshold === undefined) delete process.env.VIBESCORE_SLOW_QUERY_MS;
    else process.env.VIBESCORE_SLOW_QUERY_MS = prevLegacyThreshold;
  }
});

test("getUsageMaxDays ignores VIBESCORE env when VIBEUSAGE missing", () => {
  const prevNewMax = process.env.VIBEUSAGE_USAGE_MAX_DAYS;
  const prevLegacyMax = process.env.VIBESCORE_USAGE_MAX_DAYS;

  try {
    process.env.VIBEUSAGE_USAGE_MAX_DAYS = "1200";
    process.env.VIBESCORE_USAGE_MAX_DAYS = "900";
    assert.equal(getUsageMaxDays(), 1200);

    delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    assert.equal(getUsageMaxDays(), 800);
  } finally {
    if (prevNewMax === undefined) delete process.env.VIBEUSAGE_USAGE_MAX_DAYS;
    else process.env.VIBEUSAGE_USAGE_MAX_DAYS = prevNewMax;
    if (prevLegacyMax === undefined) delete process.env.VIBESCORE_USAGE_MAX_DAYS;
    else process.env.VIBESCORE_USAGE_MAX_DAYS = prevLegacyMax;
  }
});

test("date helpers normalize ISO strings through shared core", () => {
  assert.equal(normalizeIso(" 2026-03-25T01:02:03Z "), "2026-03-25T01:02:03.000Z");
  assert.equal(normalizeIso(""), null);
  assert.equal(normalizeIso("nope"), null);
});

test("date helpers resolve sync intervals through shared core", () => {
  assert.equal(
    isWithinInterval("2026-03-25T01:00:00Z", 30, "2026-03-25T01:20:00Z"),
    true,
  );
  assert.equal(
    isWithinInterval("2026-03-25T01:00:00Z", 30, "2026-03-25T01:31:00Z"),
    false,
  );
  assert.equal(isWithinInterval("invalid", 30, "2026-03-25T01:20:00Z"), false);
});

test("date helpers resolve local usage date ranges through shared core", () => {
  const tzContext = { offsetMinutes: 540 };
  const okRange = resolveUsageDateRangeLocal({
    fromRaw: "2026-03-01",
    toRaw: "2026-03-03",
    tzContext,
  });
  assert.equal(okRange.ok, true);
  assert.equal(okRange.from, "2026-03-01");
  assert.equal(okRange.to, "2026-03-03");
  assert.deepEqual(okRange.dayKeys, ["2026-03-01", "2026-03-02", "2026-03-03"]);
  assert.equal(okRange.startIso, "2026-02-28T15:00:00.000Z");
  assert.equal(okRange.endIso, "2026-03-03T15:00:00.000Z");

  const tooLarge = resolveUsageDateRangeLocal({
    fromRaw: "2026-03-01",
    toRaw: "2026-03-03",
    tzContext,
    maxDays: 2,
  });
  assert.deepEqual(tooLarge, {
    ok: false,
    error: "Date range too large (max 2 days)",
  });
});

test("usage range request core resolves source and local date range through shared wrapper", () => {
  assert.equal(
    usageRangeRequest.resolveUsageRangeRequestContext,
    usageRangeRequestCore.resolveUsageRangeRequestContext,
  );

  const context = usageRangeRequest.resolveUsageRangeRequestContext({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-model-breakdown?source=openrouter&from=2025-02-15&to=2025-02-16",
    ),
    tzContext: { offsetMinutes: 540 },
  });

  assert.equal(context.ok, true);
  assert.equal(context.source, "openrouter");
  assert.equal(context.from, "2025-02-15");
  assert.equal(context.to, "2025-02-16");
  assert.deepEqual(context.dayKeys, ["2025-02-15", "2025-02-16"]);
  assert.equal(context.startIso, "2025-02-14T15:00:00.000Z");
  assert.equal(context.endIso, "2025-02-16T15:00:00.000Z");
});

test("usage response helper appends debug payload only when requested", async () => {
  const logs = [];
  const response = usageResponse.createUsageJsonResponder({
    url: "https://example.com/vibeusage-usage-summary?debug=1",
    logger: {
      requestId: "req-debug",
      log: (payload) => logs.push(payload),
    },
  })({ ok: true }, 201, 87);

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.debug.request_id, "req-debug");
  assert.equal(body.debug.status, 201);
  assert.equal(body.debug.query_ms, 87);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].stage, "debug_payload");
});

test("usage response helper keeps non-debug responses unchanged", async () => {
  const response = usageResponseCore.createUsageJsonResponder({
    url: "https://example.com/vibeusage-usage-summary",
    logger: {
      requestId: "req-no-debug",
      log: () => {
        throw new Error("debug logger should not run when debug=0");
      },
    },
  })({ ok: true }, 200, 45);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("usage endpoint helper centralizes preflight and request error responses", async () => {
  const usageEndpoint = await import("../insforge-src/functions-esm/shared/core/usage-endpoint.js");
  const logger = { info() {}, warn() {}, error() {} };

  const missingBearer = usageEndpoint.prepareUsageEndpoint({
    request: new Request("https://example.com/functions/v1/vibeusage-usage-summary"),
    logger,
  });
  assert.equal(missingBearer.ok, false);
  assert.equal(missingBearer.response.status, 401);
  assert.deepEqual(await missingBearer.response.json(), { error: "Missing bearer token" });

  const wrongMethod = usageEndpoint.prepareUsageEndpoint({
    request: new Request("https://example.com/functions/v1/vibeusage-usage-summary", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    }),
    logger,
  });
  assert.equal(wrongMethod.ok, false);
  assert.equal(wrongMethod.response.status, 405);
  assert.deepEqual(await wrongMethod.response.json(), { error: "Method not allowed" });

  const ready = usageEndpoint.prepareUsageEndpoint({
    request: new Request("https://example.com/functions/v1/vibeusage-usage-summary", {
      headers: { Authorization: "Bearer test-token" },
    }),
    logger,
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.bearer, "test-token");
  assert.equal(ready.url.pathname, "/functions/v1/vibeusage-usage-summary");

  const requestErrorResponse = usageEndpoint.respondUsageRequestError(ready.respond, {
    error: "Invalid usage range",
    status: 422,
  });
  assert.equal(requestErrorResponse.status, 422);
  assert.deepEqual(await requestErrorResponse.json(), { error: "Invalid usage range" });
});

test("pricing defaults ignore VIBESCORE env when VIBEUSAGE missing", () => {
  const prevNewModel = process.env.VIBEUSAGE_PRICING_MODEL;
  const prevNewSource = process.env.VIBEUSAGE_PRICING_SOURCE;
  const prevLegacyModel = process.env.VIBESCORE_PRICING_MODEL;
  const prevLegacySource = process.env.VIBESCORE_PRICING_SOURCE;

  try {
    process.env.VIBEUSAGE_PRICING_MODEL = "gpt-5-mini";
    process.env.VIBEUSAGE_PRICING_SOURCE = "openai";
    process.env.VIBESCORE_PRICING_MODEL = "gpt-4o";
    process.env.VIBESCORE_PRICING_SOURCE = "openai";
    assert.deepEqual(pricing._getPricingDefaults(), {
      model: "gpt-5-mini",
      source: "openai",
    });

    delete process.env.VIBEUSAGE_PRICING_MODEL;
    delete process.env.VIBEUSAGE_PRICING_SOURCE;
    assert.deepEqual(pricing._getPricingDefaults(), {
      model: "gpt-5.2-codex",
      source: "openrouter",
    });
  } finally {
    if (prevNewModel === undefined) delete process.env.VIBEUSAGE_PRICING_MODEL;
    else process.env.VIBEUSAGE_PRICING_MODEL = prevNewModel;
    if (prevNewSource === undefined) delete process.env.VIBEUSAGE_PRICING_SOURCE;
    else process.env.VIBEUSAGE_PRICING_SOURCE = prevNewSource;
    if (prevLegacyModel === undefined) delete process.env.VIBESCORE_PRICING_MODEL;
    else process.env.VIBESCORE_PRICING_MODEL = prevLegacyModel;
    if (prevLegacySource === undefined) delete process.env.VIBESCORE_PRICING_SOURCE;
    else process.env.VIBESCORE_PRICING_SOURCE = prevLegacySource;
  }
});

test("resolvePricingProfile falls back for prefixed models without aliases", async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [],
    profileRows: [
      {
        model: "openai/gpt-4o",
        source: "openai",
        effective_from: "2025-01-01",
        active: true,
        input_rate_micro_per_million: 100,
        cached_input_rate_micro_per_million: 10,
        output_rate_micro_per_million: 200,
        reasoning_output_rate_micro_per_million: 200,
      },
    ],
  });

  const profile = await pricing.resolvePricingProfile({
    edgeClient,
    effectiveDate: "2025-01-02",
    model: "aws/gpt-4o",
    source: "openai",
  });

  assert.deepEqual(profile, pricing.getDefaultPricingProfile());
});

test("normalizeUsageModel preserves vendor prefixes", () => {
  assert.equal(normalizeUsageModel(" GPT-4o "), "gpt-4o");
  assert.equal(normalizeUsageModel("openai/GPT-4o"), "openai/gpt-4o");
  assert.equal(normalizeUsageModel("Anthropic/Claude-3.5"), "anthropic/claude-3.5");
  assert.equal(normalizeUsageModel("unknown"), "unknown");
  assert.equal(normalizeUsageModel(""), null);
});

test("applyUsageModelFilter builds strict filters", () => {
  const filters = [];
  const query = {
    or: (value) => {
      filters.push(value);
      return query;
    },
  };

  applyUsageModelFilter(query, ["gpt-4o"]);

  assert.equal(filters.length, 1);
  assert.ok(filters[0].includes("model.ilike.gpt-4o"));
  assert.ok(!filters[0].includes("model.ilike.%/gpt-4o"));
});

test("resolveIdentityAtDate does not infer suffix aliases for prefixed models", () => {
  const timeline = new Map();
  timeline.set("gpt-4o", [{ model_id: "gpt-4o", model: "GPT-4o", effective_from: "2026-01-01" }]);

  const identity = resolveIdentityAtDate({
    rawModel: "aws/gpt-4o",
    dateKey: "2026-01-02",
    timeline,
  });

  assert.equal(identity.model_id, "aws/gpt-4o");
  assert.equal(identity.model, "aws/gpt-4o");
});

test("sha256Hex normalizes nullish inputs to empty string", async () => {
  assert.equal(await sha256Hex(undefined), await sha256Hex(""));
  assert.equal(await sha256Hex(null), await sha256Hex(""));
});

test("leaderboard core normalizes avatar urls and derives other tokens", () => {
  assert.equal(leaderboardCore.normalizeLeaderboardAvatarUrl("https://example.com/avatar.png"), "https://example.com/avatar.png");
  assert.equal(leaderboardCore.normalizeLeaderboardAvatarUrl("javascript:alert(1)"), null);

  assert.equal(
    leaderboardCore.resolveLeaderboardOtherTokens({
      row: { other_tokens: null },
      totalTokens: 20n,
      gptTokens: 7n,
      claudeTokens: 5n,
    }),
    8n,
  );
  assert.equal(
    leaderboardCore.resolveLeaderboardOtherTokens({
      row: { other_tokens: null },
      totalTokens: 10n,
      gptTokens: 7n,
      claudeTokens: 9n,
    }),
    0n,
  );
});

test("usage pricing core resolves implied models and summary pricing mode", () => {
  assert.equal(
    usagePricingCore.resolveImpliedModelId({
      canonicalModel: "gpt-5.2-codex",
      canonicalModels: new Set(["gpt-4o"]),
    }),
    "gpt-5.2-codex",
  );
  assert.equal(
    usagePricingCore.resolveImpliedModelId({
      canonicalModel: null,
      canonicalModels: new Set(["gpt-4o"]),
    }),
    "gpt-4o",
  );
  assert.equal(
    usagePricingCore.resolveImpliedModelId({
      canonicalModel: null,
      canonicalModels: new Set(["gpt-4o", "claude-sonnet-4"]),
    }),
    null,
  );

  assert.equal(
    usagePricingCore.resolveSummaryPricingMode({
      pricingModes: new Set(),
      overallPricingMode: "overlap",
    }),
    "overlap",
  );
  assert.equal(
    usagePricingCore.resolveSummaryPricingMode({
      pricingModes: new Set(["add"]),
      overallPricingMode: "overlap",
    }),
    "add",
  );
  assert.equal(
    usagePricingCore.resolveSummaryPricingMode({
      pricingModes: new Set(["add", "overlap"]),
      overallPricingMode: "add",
    }),
    "mixed",
  );
});

test("usage metrics core formats usage totals and bucket payloads", () => {
  assert.deepEqual(
    usageMetricsCore.buildUsageTotalsPayload({
      total_tokens: 12n,
      billable_total_tokens: 9n,
      input_tokens: 5n,
      cached_input_tokens: 1n,
      output_tokens: 4n,
      reasoning_output_tokens: 2n,
    }),
    {
      total_tokens: "12",
      billable_total_tokens: "9",
      input_tokens: "5",
      cached_input_tokens: "1",
      output_tokens: "4",
      reasoning_output_tokens: "2",
    },
  );
  assert.deepEqual(
    usageMetricsCore.buildUsageBucketPayload(
      {
        total: 20n,
        billable: 18n,
        input: 7n,
        cached: 2n,
        output: 9n,
        reasoning: 3n,
      },
      { day: "2026-03-25" },
    ),
    {
      day: "2026-03-25",
      total_tokens: "20",
      billable_total_tokens: "18",
      input_tokens: "7",
      cached_input_tokens: "2",
      output_tokens: "9",
      reasoning_output_tokens: "3",
    },
  );
});

test("usage pricing core prices bucketed usage with callback attribution", async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-02-01",
        active: true,
      },
    ],
    profileRows: [
      {
        model: "alpha",
        source: "openrouter",
        effective_from: "2025-02-01",
        active: true,
        input_rate_micro_per_million: 1000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 1000000,
        reasoning_output_rate_micro_per_million: 1000000,
      },
    ],
  });

  const pricingBuckets = new Map([
    [
      usageMetricsCore.buildPricingBucketKey("codex", "gpt-foo", "2025-02-15"),
      {
        source: "codex",
        totals: {
          total_tokens: 2000000n,
          billable_total_tokens: 2000000n,
          input_tokens: 1000000n,
          cached_input_tokens: 0n,
          output_tokens: 1000000n,
          reasoning_output_tokens: 0n,
        },
      },
    ],
  ]);
  const attributed = [];

  const result = await usagePricingCore.resolveBucketedUsagePricing({
    edgeClient,
    pricingBuckets,
    usageModels: ["gpt-foo"],
    effectiveDate: "2025-02-15",
    onBucketCost: ({ bucket, identity, cost }) => {
      attributed.push({
        source: bucket?.source,
        model_id: identity?.model_id,
        pricing_mode: cost?.pricing_mode,
        cost_micros: cost?.cost_micros,
      });
    },
  });

  assert.equal(result.totalCostMicros, 2000000n);
  assert.deepEqual(Array.from(result.canonicalModels.values()), ["alpha"]);
  assert.equal(attributed.length, 1);
  assert.deepEqual(attributed[0], {
    source: "codex",
    model_id: "alpha",
    pricing_mode: "overlap",
    cost_micros: 2000000n,
  });
});

test("usage pricing core resolves aggregate pricing summary state", async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-02-01",
        active: true,
      },
    ],
    profileRows: [
      {
        model: "alpha",
        source: "openrouter",
        effective_from: "2025-02-01",
        active: true,
        input_rate_micro_per_million: 1000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 1000000,
        reasoning_output_rate_micro_per_million: 1000000,
      },
    ],
  });

  const totals = usageMetricsCore.createTotals();
  usageMetricsCore.addRowTotals(totals, {
    total_tokens: 2000000,
    billable_total_tokens: 2000000,
    input_tokens: 1000000,
    cached_input_tokens: 0,
    output_tokens: 1000000,
    reasoning_output_tokens: 0,
  });
  const sourcesMap = new Map([
    [
      "codex",
      {
        source: "codex",
        totals,
      },
    ],
  ]);
  const pricingBuckets = new Map([
    [
      usageMetricsCore.buildPricingBucketKey("codex", "gpt-foo", "2025-02-15"),
      {
        source: "codex",
        totals,
      },
    ],
  ]);

  const summaryState = await usagePricingCore.resolveAggregateUsagePricing({
    edgeClient,
    canonicalModel: null,
    distinctModels: new Set(["gpt-foo"]),
    distinctUsageModels: new Set(["gpt-foo"]),
    pricingBuckets,
    effectiveDate: "2025-02-15",
    sourcesMap,
    totals,
  });

  assert.equal(summaryState.impliedModelId, "alpha");
  assert.equal(summaryState.impliedModelDisplay, "Alpha");
  assert.equal(summaryState.totalCostMicros, 2000000n);
  assert.equal(summaryState.summaryPricingMode, "overlap");
  assert.deepEqual(Array.from(summaryState.canonicalModels.values()), ["alpha"]);
});

test("usage pricing core builds aggregate payload from shared pricing summary", () => {
  const totals = usageMetricsCore.createTotals();
  usageMetricsCore.addRowTotals(totals, {
    total_tokens: 2000000,
    billable_total_tokens: 2000000,
    input_tokens: 1000000,
    cached_input_tokens: 0,
    output_tokens: 1000000,
    reasoning_output_tokens: 0,
  });

  const payload = usagePricingCore.buildAggregateUsagePayload({
    totals,
    hasModelParam: true,
    pricingSummary: {
      impliedModelId: "alpha",
      impliedModelDisplay: "Alpha",
      overallCost: {
        profile: {
          model: "alpha",
          source: "openrouter",
          effective_from: "2025-02-01",
          rates_micro_per_million: {
            input: 1000000,
            cached_input: 0,
            output: 1000000,
            reasoning_output: 1000000,
          },
        },
        pricing_mode: "overlap",
      },
      summaryPricingMode: "overlap",
      totalCostMicros: 2000000n,
    },
  });

  assert.deepEqual(payload.selection, {
    model_id: "alpha",
    model: "Alpha",
  });
  assert.deepEqual(payload.summary, {
    totals: {
      total_tokens: "2000000",
      billable_total_tokens: "2000000",
      input_tokens: "1000000",
      cached_input_tokens: "0",
      output_tokens: "1000000",
      reasoning_output_tokens: "0",
      total_cost_usd: "2.000000",
    },
    pricing: {
      model: "alpha",
      pricing_mode: "overlap",
      source: "openrouter",
      effective_from: "2025-02-01",
      rates_per_million_usd: {
        input: "1.000000",
        cached_input: "0.000000",
        output: "1.000000",
        reasoning_output: "1.000000",
      },
    },
  });
});

test("usage pricing core resolves aggregate payload from shared state", async () => {
  const totals = usageMetricsCore.createTotals();
  usageMetricsCore.addRowTotals(totals, {
    total_tokens: 2000000,
    billable_total_tokens: 2000000,
    input_tokens: 1000000,
    cached_input_tokens: 0,
    output_tokens: 1000000,
    reasoning_output_tokens: 0,
  });
  const state = usagePricingCore.createAggregateUsageState({
    hasModelParam: true,
    defaultModel: "unknown",
  });
  state.totals = totals;
  state.distinctModels.add("gpt-foo");
  state.distinctUsageModels.add("gpt-foo");
  state.sourcesMap.set("codex", { source: "codex", totals });
  state.pricingBuckets = new Map([
    [
      usageMetricsCore.buildPricingBucketKey("codex", "gpt-foo", "2025-02-15"),
      {
        source: "codex",
        totals,
      },
    ],
  ]);

  const edgeClient = createPricingEdgeClient({
    aliasRows: [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-02-01",
        active: true,
      },
    ],
    profileRows: [
      {
        model: "alpha",
        source: "openrouter",
        effective_from: "2025-02-01",
        active: true,
        input_rate_micro_per_million: 1000000,
        cached_input_rate_micro_per_million: 0,
        output_rate_micro_per_million: 1000000,
        reasoning_output_rate_micro_per_million: 1000000,
      },
    ],
  });

  const { pricingSummary, aggregatePayload } = await usagePricingCore.resolveAggregateUsagePayload({
    edgeClient,
    canonicalModel: null,
    effectiveDate: "2025-02-15",
    state,
    hasModelParam: true,
    defaultModel: "unknown",
  });

  assert.equal(pricingSummary.impliedModelId, "alpha");
  assert.equal(aggregatePayload.selection.model_id, "alpha");
  assert.equal(aggregatePayload.selection.model, "Alpha");
  assert.equal(aggregatePayload.summary.totals.total_cost_usd, "2.000000");
});

test("usage pricing core builds model breakdown sources from shared state", () => {
  const state = usagePricingCore.createModelBreakdownState();

  usagePricingCore.accumulateModelBreakdownRow({
    state,
    row: {
      source: "codex",
      total_tokens: 10,
      billable_total_tokens: 7,
      input_tokens: 6,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
    },
    identity: {
      model_id: "alpha",
      model: "Alpha",
    },
  });
  usagePricingCore.accumulateModelBreakdownRow({
    state,
    row: {
      source: "codex",
      total_tokens: 12,
      billable_total_tokens: 9,
      input_tokens: 8,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
    },
    identity: {
      model_id: "beta",
      model: "Beta",
    },
  });

  usagePricingCore.attributeModelBreakdownBucketCost({
    state,
    source: "codex",
    identity: { model_id: "alpha", model: "Alpha" },
    costMicros: 1000000n,
  });
  usagePricingCore.attributeModelBreakdownBucketCost({
    state,
    source: "codex",
    identity: { model_id: "beta", model: "Beta" },
    costMicros: 2000000n,
  });

  const sources = usagePricingCore.buildModelBreakdownSources({
    state,
    pricingProfile: pricing.getDefaultPricingProfile(),
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].source, "codex");
  assert.equal(sources[0].totals.total_tokens, "22");
  assert.equal(sources[0].totals.billable_total_tokens, "16");
  assert.equal(sources[0].totals.total_cost_usd, "3.000000");
  assert.equal(sources[0].models.length, 2);
  assert.equal(sources[0].models[0].model_id, "beta");
  assert.equal(sources[0].models[0].totals.total_cost_usd, "2.000000");
  assert.equal(sources[0].models[1].model_id, "alpha");
  assert.equal(sources[0].models[1].totals.total_cost_usd, "1.000000");
});

test("usage pricing core accumulates aggregate usage rows into shared state", () => {
  const state = usagePricingCore.createAggregateUsageState({
    hasModelParam: false,
    defaultModel: "unknown",
  });

  const accumulation = usagePricingCore.accumulateAggregateUsageRow({
    state,
    row: {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: "codex",
      model: " GPT-Foo ",
      total_tokens: 10,
      input_tokens: 6,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
    },
    effectiveDate: "2025-02-15",
  });

  assert.equal(accumulation.sourceKey, "codex");
  assert.equal(accumulation.normalizedModel, "gpt-foo");
  assert.equal(accumulation.billable, 10n);
  assert.equal(state.totals.total_tokens, 10n);
  assert.equal(state.totals.billable_total_tokens, 10n);
  assert.equal(state.sourcesMap.get("codex")?.totals?.total_tokens, 10n);
  assert.deepEqual(Array.from(state.distinctModels.values()), ["gpt-foo"]);
  assert.deepEqual(Array.from(state.distinctUsageModels.values()), ["gpt-foo"]);
  assert.equal(state.pricingBuckets.size, 1);
});

test("usage aggregate collector core collects aggregate usage ranges through shared hourly scan", async () => {
  const state = usagePricingCore.createAggregateUsageState({
    hasModelParam: true,
    defaultModel: "unknown",
  });
  const accumulated = [];

  const result = await usageAggregateCollector.collectAggregateUsageRange({
    edgeClient: createHourlyUsageEdgeClient([
      {
        user_id: "user-1",
        hour_start: "2025-02-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 10,
        input_tokens: 6,
        cached_input_tokens: 0,
        output_tokens: 4,
        reasoning_output_tokens: 0,
      },
      {
        user_id: "user-1",
        hour_start: "invalid",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 5,
        input_tokens: 2,
        cached_input_tokens: 0,
        output_tokens: 3,
        reasoning_output_tokens: 0,
      },
      {
        user_id: "user-1",
        hour_start: "2025-02-15T01:00:00.000Z",
        source: "codex",
        model: "gpt-bar",
        total_tokens: 7,
        input_tokens: 3,
        cached_input_tokens: 0,
        output_tokens: 4,
        reasoning_output_tokens: 0,
      },
    ]),
    userId: "user-1",
    canonicalModel: "gpt-foo",
    hasModelFilter: true,
    aliasTimeline: new Map(),
    effectiveDate: "2025-02-15",
    startIso: "2025-02-15T00:00:00.000Z",
    endIso: "2025-02-16T00:00:00.000Z",
    state,
    shouldAccumulateRow: (row) => Number.isFinite(new Date(row.hour_start).getTime()),
    onAccumulatedRow: ({ accumulation }) => {
      accumulated.push(accumulation.billable.toString());
    },
  });

  assert.equal(result.error, null);
  assert.equal(result.rowCount, 2);
  assert.equal(result.state, state);
  assert.equal(state.totals.total_tokens, 10n);
  assert.equal(state.totals.billable_total_tokens, 10n);
  assert.deepEqual(accumulated, ["10"]);
});

test("usage aggregate request core resolves local range and filter context", async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-02-01T00:00:00Z",
        active: true,
      },
    ],
  });

  const context = await usageAggregateRequest.resolveAggregateUsageRequestContext({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-summary?source=openrouter&model=gpt-foo&from=2025-02-15&to=2025-02-16",
    ),
    tzContext: { offsetMinutes: 540 },
    edgeClient,
    auth: { userId: "user-1" },
  });

  assert.equal(context.ok, true);
  assert.equal(context.source, "openrouter");
  assert.equal(context.model, "gpt-foo");
  assert.equal(context.hasModelParam, true);
  assert.equal(context.from, "2025-02-15");
  assert.equal(context.to, "2025-02-16");
  assert.deepEqual(context.dayKeys, ["2025-02-15", "2025-02-16"]);
  assert.equal(context.startIso, "2025-02-14T15:00:00.000Z");
  assert.equal(context.endIso, "2025-02-16T15:00:00.000Z");
  assert.equal(context.canonicalModel, "gpt-foo");
  assert.deepEqual(context.usageModels, ["gpt-foo"]);
  assert.equal(context.hasModelFilter, true);
  assert.equal(context.auth.userId, "user-1");
  assert.deepEqual(context.aliasTimeline.get("gpt-foo"), [
    {
      model_id: "alpha",
      model: "Alpha",
      effective_from: "2025-02-01",
    },
  ]);
});

test("usage filter request core resolves source/model params and filter context", async () => {
  const edgeClient = createPricingEdgeClient({
    aliasRows: [
      {
        usage_model: "gpt-foo",
        canonical_model: "alpha",
        display_name: "Alpha",
        effective_from: "2025-02-01T00:00:00Z",
        active: true,
      },
    ],
  });

  const modelParams = usageFilterRequest.resolveUsageModelRequestParams({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-monthly?source=openrouter&model=gpt-foo",
    ),
  });

  assert.equal(modelParams.ok, true);
  assert.equal(modelParams.model, "gpt-foo");
  assert.equal(modelParams.hasModelParam, true);

  const params = usageFilterRequest.resolveUsageFilterRequestParams({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-monthly?source=openrouter&model=gpt-foo",
    ),
  });

  assert.equal(params.ok, true);
  assert.equal(params.source, "openrouter");
  assert.equal(params.model, "gpt-foo");
  assert.equal(params.hasModelParam, true);

  const context = await usageFilterRequest.resolveUsageFilterRequestContext({
    edgeClient,
    model: params.model,
    effectiveDate: "2025-02-16",
  });

  assert.equal(context.canonicalModel, "gpt-foo");
  assert.deepEqual(context.usageModels, ["gpt-foo"]);
  assert.equal(context.hasModelFilter, true);
  assert.deepEqual(context.aliasTimeline.get("gpt-foo"), [
    {
      model_id: "alpha",
      model: "Alpha",
      effective_from: "2025-02-01",
    },
  ]);

  const snapshot = await usageFilterRequest.resolveUsageFilterRequestSnapshot({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-monthly?source=openrouter&model=gpt-foo",
    ),
    edgeClient,
    effectiveDate: "2025-02-16",
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.source, "openrouter");
  assert.equal(snapshot.model, "gpt-foo");
  assert.equal(snapshot.hasModelParam, true);
  assert.equal(snapshot.canonicalModel, "gpt-foo");
  assert.deepEqual(snapshot.usageModels, ["gpt-foo"]);
  assert.equal(snapshot.hasModelFilter, true);
  assert.deepEqual(snapshot.aliasTimeline.get("gpt-foo"), [
    {
      model_id: "alpha",
      model: "Alpha",
      effective_from: "2025-02-01",
    },
  ]);
});

test("usage row collector core scans hourly rows through shared normalization and filtering", async () => {
  const collected = [];
  const result = await usageRowCollector.collectHourlyUsageRows({
    edgeClient: createHourlyUsageEdgeClient([
      {
        user_id: "user-1",
        hour_start: "2025-02-15T00:00:00.000Z",
        source: "codex",
        model: "gpt-foo",
        total_tokens: 10,
      },
      {
        user_id: "user-1",
        hour_start: "2025-02-15T01:00:00.000Z",
        source: "codex",
        model: "gpt-bar",
        total_tokens: 12,
      },
    ]),
    userId: "user-1",
    canonicalModel: "gpt-foo",
    hasModelFilter: true,
    aliasTimeline: new Map(),
    effectiveDate: "2025-02-15",
    startIso: "2025-02-15T00:00:00.000Z",
    endIso: "2025-02-16T00:00:00.000Z",
    select: "hour_start,source,model,total_tokens",
    onUsageRow: ({ usageRow }) => {
      collected.push({
        usageKey: usageRow.usageKey,
        dateKey: usageRow.dateKey,
      });
    },
  });

  assert.equal(result.error, null);
  assert.equal(result.rowCount, 2);
  assert.deepEqual(collected, [{ usageKey: "gpt-foo", dateKey: "2025-02-15" }]);
});

test("usage row collector core supports missing timestamps through rowStateOptions", async () => {
  const collected = [];
  const result = await usageRowCollectorCore.collectHourlyUsageRows({
    edgeClient: createHourlyUsageEdgeClient([
      {
        user_id: "user-1",
        hour_start: null,
        source: null,
        model: null,
        total_tokens: 9,
      },
    ]),
    userId: "user-1",
    effectiveDate: "2025-02-15",
    select: "hour_start,source,model,total_tokens",
    rowStateOptions: {
      allowMissingTimestamp: true,
      defaultSource: "codex",
      defaultModel: "unknown",
    },
    onUsageRow: ({ usageRow }) => {
      collected.push({
        sourceKey: usageRow.sourceKey,
        usageKey: usageRow.usageKey,
        dateKey: usageRow.dateKey,
        timestamp: usageRow.timestamp,
      });
    },
  });

  assert.equal(result.error, null);
  assert.equal(result.rowCount, 1);
  assert.deepEqual(collected, [
    {
      sourceKey: "codex",
      usageKey: "unknown",
      dateKey: "2025-02-15",
      timestamp: null,
    },
  ]);
});

test("usage row core resolves hourly usage row state", () => {
  const resolved = usageRowCore.resolveHourlyUsageRowState({
    row: {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: " Codex ",
      model: " GPT-Foo ",
      total_tokens: 10,
      input_tokens: 6,
      cached_input_tokens: 0,
      output_tokens: 4,
      reasoning_output_tokens: 0,
    },
    effectiveDate: "2025-02-15",
  });

  assert.ok(resolved);
  assert.equal(resolved.sourceKey, "codex");
  assert.equal(resolved.normalizedModel, "gpt-foo");
  assert.equal(resolved.usageKey, "gpt-foo");
  assert.equal(resolved.dateKey, "2025-02-15");
  assert.equal(resolved.billable, 10n);
  assert.equal(resolved.hasStoredBillable, false);
  assert.equal(resolved.timestamp, "2025-02-15T00:00:00.000Z");
  assert.ok(resolved.date instanceof Date);
});

test("usage row core falls back to effectiveDate for rows without timestamps when allowed", () => {
  const resolved = usageRowCore.resolveHourlyUsageRowState({
    row: {
      source: "codex",
      model: "gpt-foo",
      total_tokens: 10,
      billable_total_tokens: 7,
    },
    effectiveDate: "2025-02-15",
    allowMissingTimestamp: true,
  });

  assert.ok(resolved);
  assert.equal(resolved.date, null);
  assert.equal(resolved.dateKey, "2025-02-15");
  assert.equal(resolved.timestamp, null);
  assert.equal(resolved.billable, 7n);
});

test("usage row core preserves total-based billable fallback when source is missing", () => {
  const resolved = usageRowCore.resolveHourlyUsageRowState({
    row: {
      hour_start: "2025-02-15T00:00:00.000Z",
      total_tokens: 10,
    },
    effectiveDate: "2025-02-15",
  });

  assert.ok(resolved);
  assert.equal(resolved.sourceKey, "codex");
  assert.equal(resolved.billable, 10n);
});

test("usage row core can opt into default-source billing rules", () => {
  const resolved = usageRowCore.resolveHourlyUsageRowState({
    row: {
      hour_start: "2025-02-15T00:00:00.000Z",
      total_tokens: 15,
      input_tokens: 10,
      cached_input_tokens: 2,
      output_tokens: 5,
      reasoning_output_tokens: 1,
    },
    effectiveDate: "2025-02-15",
    useDefaultSourceForBilling: true,
  });

  assert.ok(resolved);
  assert.equal(resolved.billable, 16n);
});

test("usage hourly core builds half-hour buckets and response payload", () => {
  const { hourKeys, buckets, bucketMap } = usageHourlyCore.createHourlyBuckets("2025-12-21");
  assert.equal(hourKeys.length, 48);
  assert.equal(hourKeys[0], "2025-12-21T00:00:00");
  assert.equal(hourKeys[47], "2025-12-21T23:30:00");
  assert.equal(bucketMap.get("2025-12-21T01:00:00"), buckets[2]);

  usageHourlyCore.addHourlyBucketTotals({
    bucket: buckets[2],
    totalTokens: "12",
    billableTokens: 11n,
    inputTokens: "5",
    cachedInputTokens: "1",
    outputTokens: "4",
    reasoningOutputTokens: "2",
  });

  const response = usageHourlyCore.buildHourlyResponse(hourKeys, bucketMap, 1);
  assert.equal(response[2].total_tokens, "12");
  assert.equal(response[2].billable_total_tokens, "11");
  assert.equal(response[2].reasoning_output_tokens, "2");
  assert.equal(response[2].missing, true);
  assert.equal(response[1].missing, undefined);
});

test("usage hourly core normalizes hour keys and slots", () => {
  assert.equal(
    usageHourlyCore.formatHourKeyFromValue("2025-12-21T01:30:00.000Z"),
    "2025-12-21T01:30:00",
  );
  assert.equal(
    usageHourlyCore.formatHourKeyFromValue(new Date("2025-12-21T01:44:00.000Z")),
    "2025-12-21T01:30:00",
  );
  assert.equal(usageHourlyCore.resolveHalfHourSlot({ hour: 1, minute: 0 }), 2);
  assert.equal(usageHourlyCore.resolveHalfHourSlot({ hour: 1, minute: 44 }), 3);
  assert.equal(usageHourlyCore.parseHalfHourSlotFromKey("2025-12-21T01:30:00"), 3);
});

test("usage hourly core resolves request windows and row slots through shared context", () => {
  const utcContext = usageHourlyCore.resolveUsageHourlyRequestContext({
    url: new URL("https://example.com/functions/v1/vibeusage-usage-hourly?day=2025-12-21"),
    tzContext: { offsetMinutes: 0 },
  });
  assert.deepEqual(utcContext, {
    ok: true,
    timeMode: "utc",
    dayKey: "2025-12-21",
    startUtc: new Date("2025-12-21T00:00:00.000Z"),
    endUtc: new Date("2025-12-22T00:00:00.000Z"),
    startIso: "2025-12-21T00:00:00.000Z",
    endIso: "2025-12-22T00:00:00.000Z",
  });

  const localContext = usageHourlyCore.resolveUsageHourlyRequestContext({
    url: new URL("https://example.com/functions/v1/vibeusage-usage-hourly?day=2025-12-21"),
    tzContext: { offsetMinutes: 540 },
  });
  assert.deepEqual(localContext, {
    ok: true,
    timeMode: "local",
    dayKey: "2025-12-21",
    startUtc: new Date("2025-12-20T15:00:00.000Z"),
    endUtc: new Date("2025-12-21T15:00:00.000Z"),
    startIso: "2025-12-20T15:00:00.000Z",
    endIso: "2025-12-21T15:00:00.000Z",
  });

  assert.deepEqual(
    usageHourlyCore.resolveUsageHourlyRequestContext({
      url: new URL("https://example.com/functions/v1/vibeusage-usage-hourly?day=2025-99-21"),
      tzContext: { offsetMinutes: 0 },
    }),
    { ok: false, status: 400, error: "Invalid day" },
  );

  assert.equal(
    usageHourlyCore.resolveUsageHourlyRowSlot({
      usageDate: new Date("2025-12-21T01:44:00.000Z"),
      timeMode: "utc",
      dayKey: "2025-12-21",
      tzContext: { offsetMinutes: 0 },
    }),
    3,
  );
  assert.equal(
    usageHourlyCore.resolveUsageHourlyRowSlot({
      usageDate: new Date("2025-12-20T15:10:00.000Z"),
      timeMode: "local",
      dayKey: "2025-12-21",
      tzContext: { offsetMinutes: 540 },
    }),
    0,
  );
  assert.equal(
    usageHourlyCore.resolveUsageHourlyRowSlot({
      usageDate: new Date("2025-12-21T15:10:00.000Z"),
      timeMode: "local",
      dayKey: "2025-12-21",
      tzContext: { offsetMinutes: 540 },
    }),
    null,
  );
});

test("usage pricing core accumulates rolling usage rows into shared state", () => {
  const state = usagePricingCore.createRollingUsageState();

  const stored = usagePricingCore.accumulateRollingUsageRow({
    state,
    row: {
      hour_start: "2025-02-15T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      billable_total_tokens: 7,
      total_tokens: 9,
      input_tokens: 4,
      cached_input_tokens: 0,
      output_tokens: 3,
      reasoning_output_tokens: 0,
    },
    tzContext: { offsetMinutes: 0 },
  });
  const computed = usagePricingCore.accumulateRollingUsageRow({
    state,
    row: {
      hour_start: "2025-02-16T00:00:00.000Z",
      source: "codex",
      model: "gpt-foo",
      total_tokens: 5,
      input_tokens: 3,
      cached_input_tokens: 0,
      output_tokens: 2,
      reasoning_output_tokens: 0,
    },
    tzContext: { offsetMinutes: 0 },
  });

  assert.equal(stored.billable, 7n);
  assert.equal(stored.dayKey, "2025-02-15");
  assert.equal(computed.billable, 5n);
  assert.equal(computed.dayKey, "2025-02-16");
  assert.equal(state.totals.billable_total_tokens, 12n);

  const payload = usagePricingCore.buildRollingUsagePayload({
    state,
    fromDay: "2025-02-10",
    toDay: "2025-02-16",
  });
  assert.deepEqual(payload, {
    from: "2025-02-10",
    to: "2025-02-16",
    window_days: 7,
    totals: { billable_total_tokens: "12" },
    active_days: 2,
    avg_per_active_day: "6",
    avg_per_day: "1",
  });
});

test("usage heatmap core builds thresholds, streak, and grid from shared values", () => {
  const valuesByDay = new Map([
    ["2025-02-09", 5n],
    ["2025-02-11", 10n],
    ["2025-02-12", 50n],
    ["2025-02-15", 100n],
  ]);

  const payload = usageHeatmapCore.buildUsageHeatmapPayload({
    valuesByDay,
    gridStart: new Date("2025-02-09T00:00:00.000Z"),
    end: new Date("2025-02-15T00:00:00.000Z"),
    weeks: 1,
    from: "2025-02-09",
    to: "2025-02-15",
    weekStartsOn: "sun",
    getDayKey: (dt) => dt.toISOString().slice(0, 10),
    renderDay: (dt) => dt.toISOString().slice(0, 10),
  });

  assert.deepEqual(payload.thresholds, { t1: "10", t2: "50", t3: "50" });
  assert.equal(payload.active_days, 4);
  assert.equal(payload.streak_days, 1);
  assert.equal(payload.weeks.length, 1);
  assert.deepEqual(payload.weeks[0][0], { day: "2025-02-09", value: "5", level: 1 });
  assert.deepEqual(payload.weeks[0][6], { day: "2025-02-15", value: "100", level: 4 });
});

test("usage heatmap core normalizes request params, resolves request context, and accumulates day values", () => {
  const valuesByDay = new Map();

  usageHeatmapCore.accumulateHeatmapDayValue({
    valuesByDay,
    dayKey: "2025-03-01",
    billable: 7n,
  });
  usageHeatmapCore.accumulateHeatmapDayValue({
    valuesByDay,
    dayKey: "2025-03-01",
    billable: 5n,
  });

  assert.equal(valuesByDay.get("2025-03-01"), 12n);
  assert.equal(usageHeatmapCore.normalizeHeatmapWeeks(undefined), 52);
  assert.equal(usageHeatmapCore.normalizeHeatmapWeeks("8"), 8);
  assert.equal(usageHeatmapCore.normalizeHeatmapWeeks("0"), null);
  assert.equal(usageHeatmapCore.normalizeHeatmapWeekStartsOn(undefined), "sun");
  assert.equal(usageHeatmapCore.normalizeHeatmapWeekStartsOn("MON"), "mon");
  assert.equal(usageHeatmapCore.normalizeHeatmapWeekStartsOn("fri"), null);
  assert.equal(usageHeatmapCore.normalizeHeatmapToDate("2025-03-01"), "2025-03-01");
  assert.equal(usageHeatmapCore.normalizeHeatmapToDate("2025-03-40"), null);

  const utcContext = usageHeatmapCore.resolveUsageHeatmapRequestContext({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-heatmap?weeks=2&week_starts_on=mon&to=2025-03-06",
    ),
    tzContext: { offsetMinutes: 0 },
  });
  assert.deepEqual(utcContext, {
    ok: true,
    timeMode: "utc",
    weeks: 2,
    weekStartsOn: "mon",
    from: "2025-02-24",
    to: "2025-03-06",
    gridStart: new Date("2025-02-24T00:00:00.000Z"),
    end: new Date("2025-03-06T00:00:00.000Z"),
    startIso: "2025-02-24T00:00:00.000Z",
    endIso: "2025-03-07T00:00:00.000Z",
  });

  const localContext = usageHeatmapCore.resolveUsageHeatmapRequestContext({
    url: new URL(
      "https://example.com/functions/v1/vibeusage-usage-heatmap?weeks=1&week_starts_on=sun&to=2025-03-06",
    ),
    tzContext: { offsetMinutes: 540 },
  });
  assert.deepEqual(localContext, {
    ok: true,
    timeMode: "local",
    weeks: 1,
    weekStartsOn: "sun",
    from: "2025-03-02",
    to: "2025-03-06",
    gridStart: new Date("2025-03-02T00:00:00.000Z"),
    end: new Date("2025-03-06T00:00:00.000Z"),
    startIso: "2025-03-01T15:00:00.000Z",
    endIso: "2025-03-06T15:00:00.000Z",
  });

  assert.deepEqual(
    usageHeatmapCore.resolveUsageHeatmapRequestContext({
      url: new URL("https://example.com/functions/v1/vibeusage-usage-heatmap?weeks=0"),
      tzContext: { offsetMinutes: 0 },
    }),
    {
      ok: false,
      status: 400,
      error: "Invalid weeks",
    },
  );
});

test("project usage core normalizes aggregate rows and fallback detection", () => {
  assert.equal(projectUsageCore.normalizeProjectUsageLimit(undefined), 3);
  assert.equal(projectUsageCore.normalizeProjectUsageLimit("12"), 10);
  assert.equal(projectUsageCore.normalizeProjectUsageLimit("2"), 2);

  assert.deepEqual(
    projectUsageCore.normalizeProjectUsageRows([
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        sum_total_tokens: 17,
        sum_billable_total_tokens: null,
      },
      {
        project_key: "",
        project_ref: "https://github.com/acme/missing",
        sum_total_tokens: 5,
        sum_billable_total_tokens: 5,
      },
    ]),
    [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "17",
        billable_total_tokens: "17",
      },
    ],
  );

  assert.equal(
    projectUsageCore.shouldFallbackProjectUsageAggregate(
      "Could not find a relationship between 'vibeusage_project_usage_hourly' and 'sum' in the schema cache",
    ),
    true,
  );
  assert.equal(
    projectUsageCore.shouldFallbackProjectUsageAggregate(
      "Use of aggregate functions is not allowed",
    ),
    true,
  );
  assert.equal(projectUsageCore.shouldFallbackProjectUsageAggregate("boom"), false);
});

test("project usage core aggregates and sorts fallback rows", () => {
  assert.deepEqual(
    projectUsageCore.aggregateProjectUsageRows(
      [
        {
          project_key: "acme/alpha",
          project_ref: "https://github.com/acme/alpha",
          total_tokens: "10",
          billable_total_tokens: "5",
        },
        {
          project_key: "acme/bravo",
          project_ref: "https://github.com/acme/bravo",
          total_tokens: "7",
        },
        {
          project_key: "acme/alpha",
          project_ref: "https://github.com/acme/alpha",
          total_tokens: "4",
          billable_total_tokens: "4",
        },
      ],
      2,
    ),
    [
      {
        project_key: "acme/alpha",
        project_ref: "https://github.com/acme/alpha",
        total_tokens: "14",
        billable_total_tokens: "9",
      },
      {
        project_key: "acme/bravo",
        project_ref: "https://github.com/acme/bravo",
        total_tokens: "7",
        billable_total_tokens: "7",
      },
    ],
  );
});

test("project usage core builds aggregate and fallback queries through shared filters", () => {
  const aggregateQuery = projectUsageCore.buildProjectUsageAggregateQuery({
    edgeClient: createProjectUsageQueryEdgeClient(),
    userId: "user-1",
    source: "openrouter",
    limit: 3,
  });
  assert.equal(
    aggregateQuery.selectValue,
    "project_key,project_ref,sum_total_tokens:sum(total_tokens),sum_billable_total_tokens:sum(billable_total_tokens)",
  );
  assert.deepEqual(aggregateQuery.filters, [
    { op: "eq", field: "user_id", value: "user-1" },
    { op: "eq", field: "source", value: "openrouter" },
    { op: "neq", field: "source", value: "canary" },
  ]);
  assert.deepEqual(aggregateQuery.orders, [
    { field: "sum_billable_total_tokens", options: { ascending: false } },
    { field: "sum_total_tokens", options: { ascending: false } },
  ]);
  assert.equal(aggregateQuery.limitValue, 3);

  const fallbackQuery = projectUsageCore.buildProjectUsageFallbackQuery({
    edgeClient: createProjectUsageQueryEdgeClient(),
    userId: "user-2",
    source: "canary",
  });
  assert.equal(
    fallbackQuery.selectValue,
    "project_key,project_ref,total_tokens,billable_total_tokens",
  );
  assert.deepEqual(fallbackQuery.filters, [
    { op: "eq", field: "user_id", value: "user-2" },
    { op: "eq", field: "source", value: "canary" },
  ]);
});

test("project usage core keeps insforge database instance binding intact", () => {
  const edgeClient = createClient({
    baseUrl: "https://example.com",
    edgeFunctionToken: "token-123",
  });

  const detachedFrom = edgeClient.database.from;
  assert.throws(() => detachedFrom("demo_table"), /postgrest/);

  const query = projectUsageCore.buildProjectUsageFallbackQuery({
    edgeClient,
    userId: "user-1",
    source: "openrouter",
  });

  assert.equal(typeof query, "object");
  assert.equal(typeof query.eq, "function");
  assert.equal(typeof query.then, "function");
});
