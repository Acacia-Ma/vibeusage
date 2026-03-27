const test = require("node:test");
const assert = require("node:assert/strict");

const pricingSync = require("../insforge-src/functions/vibeusage-pricing-sync.js");

const {
  buildAliasRows,
  buildExistingAliasMap,
} = pricingSync._private;

test("buildAliasRows creates alias for a single high-confidence family match", () => {
  const existingAliasMap = buildExistingAliasMap([]);
  const rows = buildAliasRows({
    usageModels: ["minimax-m2.5-highspeed"],
    pricingModelIds: new Set(["minimax/minimax-m2.5"]),
    pricingMeta: [
      { id: "minimax/minimax-m2.1", created: 1, context_length: 1 },
      { id: "minimax/minimax-m2.5", created: 2, context_length: 2 },
      { id: "minimax/minimax-m2.5:free", created: 3, context_length: 3 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap,
  });

  assert.deepEqual(rows, [
    {
      usage_model: "minimax-m2.5-highspeed",
      pricing_model: "minimax/minimax-m2.5",
      pricing_source: "openrouter",
      effective_from: "2026-03-27",
      active: true,
    },
  ]);
});

test("buildAliasRows skips ambiguous family matches", () => {
  const rows = buildAliasRows({
    usageModels: ["gpt-5.4-high"],
    pricingModelIds: new Set(),
    pricingMeta: [
      { id: "openai/gpt-5.4", created: 1, context_length: 1 },
      { id: "openai/gpt-5.4-mini", created: 2, context_length: 2 },
      { id: "openai/gpt-5.4-pro", created: 3, context_length: 3 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows skips unrecognized vendors", () => {
  const rows = buildAliasRows({
    usageModels: ["coder-model"],
    pricingModelIds: new Set(),
    pricingMeta: [{ id: "openai/gpt-5.2-codex", created: 1, context_length: 1 }],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows keeps existing conflicting aliases untouched", () => {
  const rows = buildAliasRows({
    usageModels: ["minimax-m2.5-highspeed"],
    pricingModelIds: new Set(),
    pricingMeta: [{ id: "minimax/minimax-m2.5", created: 1, context_length: 1 }],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([
      {
        usage_model: "minimax-m2.5-highspeed",
        pricing_model: "minimax/minimax-m2.1",
        pricing_source: "openrouter",
        effective_from: "2026-03-26",
        active: true,
      },
    ]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows creates alias for kimi shorthand usage models", () => {
  const rows = buildAliasRows({
    usageModels: ["k2p5"],
    pricingModelIds: new Set(["moonshotai/kimi-k2.5"]),
    pricingMeta: [
      { id: "moonshotai/kimi-k2", created: 1, context_length: 1 },
      { id: "moonshotai/kimi-k2.5", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, [
    {
      usage_model: "k2p5",
      pricing_model: "moonshotai/kimi-k2.5",
      pricing_source: "openrouter",
      effective_from: "2026-03-27",
      active: true,
    },
  ]);
});

test("buildAliasRows creates alias for deepseek family matches", () => {
  const rows = buildAliasRows({
    usageModels: ["deepseek-v3.1"],
    pricingModelIds: new Set(["deepseek/deepseek-chat-v3.1"]),
    pricingMeta: [
      { id: "deepseek/deepseek-r1", created: 1, context_length: 1 },
      { id: "deepseek/deepseek-chat-v3.1", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, [
    {
      usage_model: "deepseek-v3.1",
      pricing_model: "deepseek/deepseek-chat-v3.1",
      pricing_source: "openrouter",
      effective_from: "2026-03-27",
      active: true,
    },
  ]);
});
