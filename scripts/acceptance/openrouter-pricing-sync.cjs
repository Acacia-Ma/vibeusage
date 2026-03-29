#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { loadEdgeFunction } = require("../lib/load-edge-function.cjs");

class DatabaseStub {
  constructor() {
    this._table = null;
    this._select = null;
    this._filters = [];
    this._updateValues = null;
    this._eq = [];
    this._in = null;
    this._lte = null;
    this._orders = [];
    this.upserts = [];
    this.modelAliasUpserts = [];
    this.aliasUpserts = [];
    this.upsertCalls = 0;
    this.modelAliasUpsertCalls = 0;
    this.aliasUpsertCalls = 0;
    this.retention = null;
    this.modelAliasRetention = null;
    this.aliasRetention = null;
    this.usageRows = [];
    this.existingModelAliasRows = [];
    this.existingAliasRows = [];
  }

  from(table) {
    this._table = table;
    this._select = null;
    this._filters = [];
    return this;
  }

  select(columns) {
    this._select = columns;
    return this;
  }

  in(column, value) {
    this._in = { column, value: Array.isArray(value) ? value.slice() : [value] };
    return this;
  }

  gte(column, value) {
    this._filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column, value) {
    this._lte = { column, value };
    return this;
  }

  order(column, options) {
    this._orders.push({ column, options: options || null });
    return this;
  }

  upsert(rows) {
    if (this._table === "vibeusage_pricing_profiles") {
      this.upserts.push(...rows);
      this.upsertCalls += 1;
    } else if (this._table === "vibeusage_model_aliases") {
      this.modelAliasUpserts.push(...rows);
      this.modelAliasUpsertCalls += 1;
    } else if (this._table === "vibeusage_pricing_model_aliases") {
      this.aliasUpserts.push(...rows);
      this.aliasUpsertCalls += 1;
    }
    return { error: null };
  }

  update(values) {
    this._updateValues = values;
    return this;
  }

  eq(column, value) {
    this._eq.push({ column, value });
    return this;
  }

  lt(column, value) {
    const target = {
      update: this._updateValues,
      eq: this._eq[this._eq.length - 1],
      lt: { column, value },
    };
    if (this._table === "vibeusage_model_aliases") {
      this.modelAliasRetention = target;
    } else if (this._table === "vibeusage_pricing_model_aliases") {
      this.aliasRetention = target;
    } else {
      this.retention = target;
    }
    return { error: null };
  }

  range() {
    if (this._table === "vibeusage_tracker_hourly") {
      return { data: this.usageRows, error: null };
    }
    return { data: [], error: null };
  }

  limit() {
    if (this._table === "vibeusage_model_aliases") {
      let rows = this.existingModelAliasRows.slice();
      for (const filter of this._eq) {
        if (!filter?.column) continue;
        rows = rows.filter((row) => row[filter.column] === filter.value);
      }
      if (this._in?.column === "usage_model") {
        const allowed = new Set(this._in.value);
        rows = rows.filter((row) => allowed.has(row.usage_model));
      }
      if (this._lte?.column) {
        rows = rows.filter((row) => String(row[this._lte.column] || "") <= String(this._lte.value));
      }
      rows.sort((left, right) =>
        String(right.effective_from || "").localeCompare(String(left.effective_from || "")),
      );
      return { data: rows, error: null };
    }
    if (this._table === "vibeusage_pricing_model_aliases") {
      let rows = this.existingAliasRows.slice();
      for (const filter of this._eq) {
        if (!filter?.column) continue;
        rows = rows.filter((row) => row[filter.column] === filter.value);
      }
      if (this._in?.column === "usage_model") {
        const allowed = new Set(this._in.value);
        rows = rows.filter((row) => allowed.has(row.usage_model));
      }
      if (this._lte?.column) {
        rows = rows.filter((row) => String(row[this._lte.column] || "") <= String(this._lte.value));
      }
      rows.sort((left, right) =>
        String(right.effective_from || "").localeCompare(String(left.effective_from || "")),
      );
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  }
}

function createClientStub(db) {
  return {
    database: db,
  };
}

function buildOpenRouterPayload() {
  return {
    data: [
      {
        id: "anthropic/claude-opus-4.5",
        created: 10,
        pricing: {
          prompt: "0.000001",
          completion: "0.000002",
          input_cache_read: "0.0000001",
          internal_reasoning: "0.000002",
        },
      },
      {
        id: "anthropic/claude-opus-4.1",
        created: 5,
        pricing: {
          prompt: 0.0000015,
          completion: 0.000003,
        },
      },
      {
        id: "openai/gpt-4o-mini",
        created: 8,
        pricing: {
          prompt: 0.0000015,
          completion: 0.000003,
        },
      },
      {
        id: "minimax/minimax-m2.5",
        created: 9,
        pricing: {
          prompt: 0.0000011,
          completion: 0.0000022,
        },
      },
      {
        id: "google/gemini-3-pro-preview",
        created: 11,
        pricing: {
          prompt: 0.0000012,
          completion: 0.0000024,
        },
      },
      {
        id: "google/gemini-3-pro-image-preview",
        created: 12,
        pricing: {
          prompt: 0.0000012,
          completion: 0.0000024,
        },
      },
      {
        id: "z-ai/glm-4.7",
        created: 13,
        pricing: {
          prompt: 0.0000009,
          completion: 0.0000018,
        },
      },
      {
        id: "z-ai/glm-4.6",
        created: 13,
        pricing: {
          prompt: 0.0000009,
          completion: 0.0000018,
        },
      },
      {
        id: "z-ai/glm-4.6v",
        created: 13,
        pricing: {
          prompt: 0.0000014,
          completion: 0.0000028,
        },
      },
      {
        id: "moonshotai/kimi-k2.5",
        created: 14,
        pricing: {
          prompt: 0.0000013,
          completion: 0.0000026,
        },
      },
      {
        id: "qwen/qwen3.5-plus-02-15",
        created: 14,
        pricing: {
          prompt: 0.0000014,
          completion: 0.0000028,
        },
      },
      {
        id: "deepseek/deepseek-chat-v3.1",
        created: 15,
        pricing: {
          prompt: 0.0000011,
          completion: 0.0000021,
        },
      },
      {
        id: "xiaomi/mimo-v2-pro",
        created: 16,
        pricing: {
          prompt: 0.0000006,
          completion: 0.0000012,
        },
      },
      {
        id: "openai/no-pricing",
      },
    ],
  };
}

async function main() {
  process.env.INSFORGE_INTERNAL_URL = "http://insforge:7130";
  process.env.INSFORGE_ANON_KEY = "anon";
  process.env.INSFORGE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.OPENROUTER_API_KEY = "openrouter-key";
  process.env.VIBEUSAGE_PRICING_SOURCE = "openrouter";

  global.Deno = {
    env: {
      get(key) {
        const v = process.env[key];
        return v == null || v === "" ? null : v;
      },
    },
  };

  const db = new DatabaseStub();
  db.usageRows = [
    { model: "claude-opus-4-5-20251101", hour_start: "2026-03-12T00:00:00.000Z" },
    { model: "openai/gpt-4o-mini", hour_start: "2026-03-13T00:00:00.000Z" },
    { model: "minimax-m2.5-highspeed", hour_start: "2026-03-14T00:00:00.000Z" },
    { model: "gemini-3-pro", hour_start: "2026-03-15T00:00:00.000Z" },
    { model: "zai/glm-4.7", hour_start: "2026-03-16T00:00:00.000Z" },
    { model: "zai-org/glm-4.6", hour_start: "2026-03-17T00:00:00.000Z" },
    { model: "k2p5", hour_start: "2026-03-18T00:00:00.000Z" },
    { model: "deepseek-v3.1", hour_start: "2026-03-19T00:00:00.000Z" },
    { model: "qwen3.5-plus", hour_start: "2026-03-20T00:00:00.000Z" },
    { model: "mimo-v2-pro-free", hour_start: "2026-03-21T00:00:00.000Z" },
    { model: "coder-model", hour_start: "2026-03-22T00:00:00.000Z" },
    { model: "unknown", hour_start: "2026-03-23T00:00:00.000Z" },
  ];
  db.existingModelAliasRows = [
    {
      usage_model: "claude-opus-4-5-20251101",
      canonical_model: "anthropic/claude-opus-4.5",
      display_name: "anthropic/claude-opus-4.5",
      effective_from: "2026-03-27",
      active: true,
    },
  ];
  db.existingAliasRows = [
    {
      usage_model: "claude-opus-4-5-20251101",
      pricing_model: "anthropic/claude-opus-4.5",
      pricing_source: "openrouter",
      effective_from: "2026-03-26",
      active: true,
    },
  ];
  global.createClient = () => createClientStub(db);

  const payload = buildOpenRouterPayload();
  global.fetch = async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/models");
    assert.equal(options?.headers?.Authorization, "Bearer openrouter-key");
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const sync = await loadEdgeFunction("vibeusage-pricing-sync");

  const req = new Request("http://local/functions/vibeusage-pricing-sync", {
    method: "POST",
    headers: {
      Authorization: "Bearer service-role-key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ retention_days: 90 }),
  });

  const res = await sync(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.models_total, 14);
  assert.equal(body.models_processed, 13);
  assert.equal(body.rows_upserted, 13);
  assert.equal(body.usage_models_total, 11);
  assert.equal(body.canonical_aliases_generated, 8);
  assert.equal(body.canonical_aliases_upserted, 8);
  assert.equal(body.aliases_generated, 2);
  assert.equal(body.aliases_upserted, 2);
  assert.equal(db.upsertCalls, 1);
  assert.equal(db.upserts.length, 13);

  const first = db.upserts.find((row) => row.model === "anthropic/claude-opus-4.5");
  const second = db.upserts.find((row) => row.model === "openai/gpt-4o-mini");

  assert.equal(first.input_rate_micro_per_million, 1000000);
  assert.equal(first.cached_input_rate_micro_per_million, 100000);
  assert.equal(first.output_rate_micro_per_million, 2000000);
  assert.equal(first.reasoning_output_rate_micro_per_million, 2000000);

  assert.equal(second.input_rate_micro_per_million, 1500000);
  assert.equal(second.cached_input_rate_micro_per_million, 1500000);
  assert.equal(second.output_rate_micro_per_million, 3000000);
  assert.equal(second.reasoning_output_rate_micro_per_million, 3000000);

  assert.equal(db.retention.eq.column, "source");
  assert.equal(db.retention.eq.value, "openrouter");
  assert.equal(db.retention.update.active, false);
  assert.equal(db.modelAliasUpsertCalls, 1);
  assert.equal(db.modelAliasUpserts.length, 8);
  assert.equal(db.aliasUpsertCalls, 1);
  assert.equal(db.aliasUpserts.length, 2);
  const claudeCanonicalBackfill = db.modelAliasUpserts.find(
    (row) => row.usage_model === "claude-opus-4-5-20251101",
  );
  assert.equal(claudeCanonicalBackfill?.effective_from, "2026-03-12");
  assert.deepEqual(
    db.modelAliasUpserts.map((row) => ({
      usage_model: row.usage_model,
      canonical_model: row.canonical_model,
      effective_from: row.effective_from,
    })),
    [
      {
        usage_model: "claude-opus-4-5-20251101",
        canonical_model: "anthropic/claude-opus-4.5",
        effective_from: "2026-03-12",
      },
      {
        usage_model: "minimax-m2.5-highspeed",
        canonical_model: "minimax/minimax-m2.5",
        effective_from: "2026-03-14",
      },
      { usage_model: "zai/glm-4.7", canonical_model: "z-ai/glm-4.7", effective_from: "2026-03-16" },
      { usage_model: "zai-org/glm-4.6", canonical_model: "z-ai/glm-4.6", effective_from: "2026-03-17" },
      { usage_model: "k2p5", canonical_model: "moonshotai/kimi-k2.5", effective_from: "2026-03-18" },
      {
        usage_model: "deepseek-v3.1",
        canonical_model: "deepseek/deepseek-v3.1",
        effective_from: "2026-03-19",
      },
      {
        usage_model: "qwen3.5-plus",
        canonical_model: "qwen/qwen3.5-plus",
        effective_from: "2026-03-20",
      },
      {
        usage_model: "mimo-v2-pro-free",
        canonical_model: "xiaomi/mimo-v2-pro",
        effective_from: "2026-03-21",
      },
    ],
  );
  assert.deepEqual(
    db.aliasUpserts.map((row) => ({ usage_model: row.usage_model, pricing_model: row.pricing_model })),
    [
      { usage_model: "deepseek/deepseek-v3.1", pricing_model: "deepseek/deepseek-chat-v3.1" },
      { usage_model: "qwen/qwen3.5-plus", pricing_model: "qwen/qwen3.5-plus-02-15" },
    ],
  );

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        upserts: db.upserts.length,
        canonical_alias_upserts: db.modelAliasUpserts.length,
        alias_upserts: db.aliasUpserts.length,
        retention: db.retention,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
