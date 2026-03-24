const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readFile(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function normalize(content) {
  return content.replace(/\s+/g, "").replace(/"/g, "'");
}

test("usage pagination uses deterministic ordering", () => {
  const hourlyOrder =
    "order('hour_start',{ascending:true}).order('device_id',{ascending:true}).order('source',{ascending:true}).order('model',{ascending:true})";
  const rollupOrder =
    "order('day',{ascending:true}).order('source',{ascending:true}).order('model',{ascending:true})";
  const adminOrder =
    "order('hour_start',{ascending:true}).order('user_id',{ascending:true}).order('device_id',{ascending:true}).order('source',{ascending:true}).order('model',{ascending:true})";
  const hourlyBuilderCall = "buildHourlyUsageQuery(";

  assert.ok(
    normalize(readFile("insforge-src/shared/usage-rollup-core.js")).includes(rollupOrder),
  );
  assert.ok(
    normalize(readFile("insforge-src/shared/usage-hourly-query-core.js")).includes(hourlyOrder),
  );
  assert.equal(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-summary.js")),
      hourlyBuilderCall,
    ),
    2,
  );
  assert.equal(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-daily.js")),
      hourlyBuilderCall,
    ),
    1,
  );
  assert.equal(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-model-breakdown.js")),
      hourlyBuilderCall,
    ),
    1,
  );
  assert.ok(
    normalize(readFile("insforge-src/shared/db/usage-hourly.js")).includes(
      "require('../usage-hourly-query-core')",
    ),
  );
  assert.ok(
    normalize(readFile("insforge-src/functions-esm/shared/db/usage-hourly.js")).includes(
      "import'../../../shared/usage-hourly-query-core.mjs'",
    ),
  );
  assert.ok(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-monthly.js")),
      hourlyBuilderCall,
    ) === 1,
  );
  assert.equal(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-heatmap.js")),
      hourlyBuilderCall,
    ),
    2,
  );
  assert.equal(
    countOccurrences(
      normalize(readFile("insforge-src/functions-esm/vibeusage-usage-hourly.js")),
      hourlyBuilderCall,
    ),
    2,
  );
  assert.ok(
    normalize(readFile("insforge-src/functions/vibeusage-pricing-sync.js")).includes(adminOrder),
  );
});
