const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadDashboardModule } = require("./helpers/load-dashboard-module");

test("buildFleetData keeps usage tokens for fleet rows", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "gpt-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 },
          },
        ],
      },
      {
        source: "api",
        totals: { total_tokens: 0, total_cost_usd: 0 },
        models: [],
      },
    ],
  };

  assert.equal(typeof buildFleetData, "function");

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData.length, 1);
  assert.equal(fleetData[0].label, "CLI");
  assert.equal(fleetData[0].usage, 1200);
  assert.equal(fleetData[0].totalPercent, "100.0");
});

test("buildFleetData returns model ids for stable keys", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "GPT-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 },
          },
        ],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].models[0].id, "gpt-4o");
});

test("buildFleetData prefers display_model over vendor-prefixed model names", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "claude",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "anthropic/claude-sonnet-4.6",
            display_model: "claude-sonnet-4.6",
            model_id: "anthropic/claude-sonnet-4.6",
            totals: { total_tokens: 1200 },
          },
        ],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].models[0].name, "claude-sonnet-4.6");
  assert.equal(fleetData[0].models[0].id, "anthropic/claude-sonnet-4.6");
});

test("buildFleetData strips vendor prefixes even when display_model is absent", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "claude",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "anthropic/claude-haiku-4.5",
            model_id: "anthropic/claude-haiku-4.5",
            totals: { total_tokens: 1200 },
          },
        ],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].models[0].name, "claude-haiku-4.5");
});

test("buildTopModels aggregates by canonical model_id across sources", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [{ model: "GPT-4o", model_id: "gpt-4o", totals: { billable_total_tokens: 70 } }],
      },
      {
        source: "api",
        models: [
          { model: "GPT-4o Omni", model_id: "gpt-4o", totals: { billable_total_tokens: 50 } },
          { model: "GPT-4o-mini", model_id: "gpt-4o-mini", totals: { billable_total_tokens: 30 } },
        ],
      },
    ],
  };

  assert.equal(typeof buildTopModels, "function");

  const topModels = buildTopModels(modelBreakdown, { limit: 3 });

  assert.equal(topModels.length, 2);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].name, "GPT-4o");
  assert.equal(topModels[0].percent, "80.0");
  assert.equal(topModels[1].id, "gpt-4o-mini");
  assert.equal(topModels[1].percent, "20.0");
});

test("buildTopModels computes percent using billable tokens across all models", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [
          {
            model: "legacy-model",
            model_id: "legacy-model",
            totals: { billable_total_tokens: 20, total_tokens: 999 },
          },
        ],
      },
      {
        source: "api",
        models: [
          {
            model: "GPT-4o",
            model_id: "gpt-4o",
            totals: { billable_total_tokens: 80, total_tokens: 999 },
          },
        ],
      },
    ],
  };

  const topModels = buildTopModels(modelBreakdown, { limit: 1 });

  assert.equal(topModels.length, 1);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].percent, "80.0");
});

test("buildTopModels prefers display_model for presentation", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "claude",
        models: [
          {
            model: "anthropic/claude-sonnet-4.6",
            display_model: "claude-sonnet-4.6",
            model_id: "anthropic/claude-sonnet-4.6",
            totals: { billable_total_tokens: 80 },
          },
        ],
      },
    ],
  };

  const topModels = buildTopModels(modelBreakdown, { limit: 1 });

  assert.equal(topModels[0].name, "claude-sonnet-4.6");
  assert.equal(topModels[0].id, "anthropic/claude-sonnet-4.6");
});

test("buildTopModels strips vendor prefixes when display_model is absent", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "claude",
        models: [
          {
            model: "anthropic/claude-opus-4.6",
            model_id: "anthropic/claude-opus-4.6",
            totals: { billable_total_tokens: 80 },
          },
        ],
      },
    ],
  };

  const topModels = buildTopModels(modelBreakdown, { limit: 1 });

  assert.equal(topModels[0].name, "claude-opus-4.6");
});

test("hydrateModelBreakdownDisplayModels derives display_model for cached vendor-prefixed entries", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const hydrateModelBreakdownDisplayModels = mod.hydrateModelBreakdownDisplayModels;

  const modelBreakdown = {
    sources: [
      {
        source: "claude",
        models: [
          {
            model: "anthropic/claude-opus-4.6",
            model_id: "anthropic/claude-opus-4.6",
            totals: { billable_total_tokens: 80 },
          },
        ],
      },
    ],
  };

  const hydrated = hydrateModelBreakdownDisplayModels(modelBreakdown);

  assert.equal(hydrated.sources[0].models[0].display_model, "claude-opus-4.6");
  assert.equal(hydrated.sources[0].models[0].model_id, "anthropic/claude-opus-4.6");
});

test("resolveModelDisplayName falls back to model_id when display fields are absent", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const resolveModelDisplayName = mod.resolveModelDisplayName;

  const name = resolveModelDisplayName(
    {
      model_id: "anthropic/claude-opus-4.6",
    },
    "-",
  );

  assert.equal(name, "claude-opus-4.6");
});

test("resolveModelDisplayName returns fallback when model fields are all absent", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const resolveModelDisplayName = mod.resolveModelDisplayName;

  const name = resolveModelDisplayName({}, "fallback");

  assert.equal(name, "fallback");
});
