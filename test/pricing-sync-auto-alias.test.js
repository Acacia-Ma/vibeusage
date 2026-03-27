const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadPrivate() {
  const mod = await import(
    pathToFileURL(
      path.join(__dirname, "..", "insforge-src", "functions-esm", "vibeusage-pricing-sync.js"),
    ).href
  );
  return mod._private;
}

test("buildCanonicalAliasRows creates canonical aliases for deterministic families", async () => {
  const { buildCanonicalAliasRows, buildExistingModelAliasMap } = await loadPrivate();
  const rows = buildCanonicalAliasRows({
    usageModels: [
      "claude-opus-4-5-20251101",
      "minimax-m2.5-highspeed",
      "qwen3.5-plus",
      "deepseek-v3.1",
      "zai-org/glm-4.6",
      "mimo-v2-pro-free",
      "k2p5",
      "kimi-for-coding",
      "coder-model",
    ],
    effectiveFrom: "2026-03-28",
    existingAliasMap: buildExistingModelAliasMap([]),
  });

  assert.deepEqual(rows, [
    {
      usage_model: "claude-opus-4-5-20251101",
      canonical_model: "anthropic/claude-opus-4.5",
      display_name: "anthropic/claude-opus-4.5",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "minimax-m2.5-highspeed",
      canonical_model: "minimax/minimax-m2.5",
      display_name: "minimax/minimax-m2.5",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "qwen3.5-plus",
      canonical_model: "qwen/qwen3.5-plus",
      display_name: "qwen/qwen3.5-plus",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "deepseek-v3.1",
      canonical_model: "deepseek/deepseek-v3.1",
      display_name: "deepseek/deepseek-v3.1",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "zai-org/glm-4.6",
      canonical_model: "z-ai/glm-4.6",
      display_name: "z-ai/glm-4.6",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "mimo-v2-pro-free",
      canonical_model: "xiaomi/mimo-v2-pro",
      display_name: "xiaomi/mimo-v2-pro",
      effective_from: "2026-03-28",
      active: true,
    },
    {
      usage_model: "k2p5",
      canonical_model: "moonshotai/kimi-k2.5",
      display_name: "moonshotai/kimi-k2.5",
      effective_from: "2026-03-28",
      active: true,
    },
  ]);
});

test("buildCanonicalAliasRows skips ambiguous model names", async () => {
  const { buildCanonicalAliasRows, buildExistingModelAliasMap } = await loadPrivate();
  const rows = buildCanonicalAliasRows({
    usageModels: ["kimi-for-coding", "gemini-3-pro", "coder-model"],
    effectiveFrom: "2026-03-28",
    existingAliasMap: buildExistingModelAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows creates pricing alias for canonical qwen models", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["qwen/qwen3.5-plus"],
    pricingModelIds: new Set(["qwen/qwen3.5-plus-02-15"]),
    pricingMeta: [
      { id: "qwen/qwen3.5-plus-02-15", created: 1, context_length: 1 },
      { id: "qwen/qwen-plus-2025-07-28", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-28",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, [
    {
      usage_model: "qwen/qwen3.5-plus",
      pricing_model: "qwen/qwen3.5-plus-02-15",
      pricing_source: "openrouter",
      effective_from: "2026-03-28",
      active: true,
    },
  ]);
});

test("buildAliasRows skips ambiguous family matches", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["openai/gpt-5.4-high"],
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

test("buildAliasRows skips unrecognized vendors", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
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

test("buildAliasRows keeps existing conflicting aliases untouched", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["minimax/minimax-m2.5"],
    pricingModelIds: new Set(),
    pricingMeta: [{ id: "minimax/minimax-m2.5", created: 1, context_length: 1 }],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([
      {
        usage_model: "minimax/minimax-m2.5",
        pricing_model: "minimax/minimax-m2.1",
        pricing_source: "openrouter",
        effective_from: "2026-03-26",
        active: true,
      },
    ]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows creates alias for kimi shorthand usage models", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["moonshotai/kimi-k2.5"],
    pricingModelIds: new Set(["moonshotai/kimi-k2.5"]),
    pricingMeta: [
      { id: "moonshotai/kimi-k2", created: 1, context_length: 1 },
      { id: "moonshotai/kimi-k2.5", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows creates alias for deepseek family matches", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["deepseek/deepseek-v3.1"],
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
      usage_model: "deepseek/deepseek-v3.1",
      pricing_model: "deepseek/deepseek-chat-v3.1",
      pricing_source: "openrouter",
      effective_from: "2026-03-27",
      active: true,
    },
  ]);
});

test("buildAliasRows keeps glm vision variants from colliding with plain glm aliases", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["z-ai/glm-4.6"],
    pricingModelIds: new Set(["z-ai/glm-4.6", "z-ai/glm-4.6v"]),
    pricingMeta: [
      { id: "z-ai/glm-4.6", created: 1, context_length: 1 },
      { id: "z-ai/glm-4.6v", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows creates alias for mimo free usage models", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["xiaomi/mimo-v2-pro"],
    pricingModelIds: new Set(["xiaomi/mimo-v2-pro"]),
    pricingMeta: [
      { id: "xiaomi/mimo-v2-flash", created: 1, context_length: 1 },
      { id: "xiaomi/mimo-v2-pro", created: 2, context_length: 2 },
    ],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});

test("buildAliasRows keeps preview-only gemini models on fallback", async () => {
  const { buildAliasRows, buildExistingAliasMap } = await loadPrivate();
  const rows = buildAliasRows({
    usageModels: ["gemini-3-pro"],
    pricingModelIds: new Set(["google/gemini-3-pro-preview"]),
    pricingMeta: [{ id: "google/gemini-3-pro-preview", created: 1, context_length: 1 }],
    pricingSource: "openrouter",
    effectiveFrom: "2026-03-27",
    existingAliasMap: buildExistingAliasMap([]),
  });

  assert.deepEqual(rows, []);
});
