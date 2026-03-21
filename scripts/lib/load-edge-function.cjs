"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MIGRATED_FUNCTION_SOURCES = new Map([
  ["vibeusage-link-code-init", "insforge-src/functions-esm/vibeusage-link-code-init.js"],
  ["vibeusage-leaderboard", "insforge-src/functions-esm/vibeusage-leaderboard.js"],
  ["vibeusage-public-visibility", "insforge-src/functions-esm/vibeusage-public-visibility.js"],
  ["vibeusage-usage-daily", "insforge-src/functions-esm/vibeusage-usage-daily.js"],
  ["vibeusage-usage-hourly", "insforge-src/functions-esm/vibeusage-usage-hourly.js"],
  ["vibeusage-usage-monthly", "insforge-src/functions-esm/vibeusage-usage-monthly.js"],
  [
    "vibeusage-usage-model-breakdown",
    "insforge-src/functions-esm/vibeusage-usage-model-breakdown.js",
  ],
  ["vibeusage-usage-heatmap", "insforge-src/functions-esm/vibeusage-usage-heatmap.js"],
  ["vibeusage-usage-summary", "insforge-src/functions-esm/vibeusage-usage-summary.js"],
  ["vibeusage-user-status", "insforge-src/functions-esm/vibeusage-user-status.js"],
  [
    "vibeusage-project-usage-summary",
    "insforge-src/functions-esm/vibeusage-project-usage-summary.js",
  ],
]);

async function loadEdgeFunction(slug) {
  const sourcePath = MIGRATED_FUNCTION_SOURCES.get(slug);
  if (sourcePath) {
    const href = pathToFileURL(path.join(__dirname, "..", "..", sourcePath)).href;
    const mod = await import(href);
    return mod.default;
  }
  return require(path.join(__dirname, "..", "..", "insforge-functions", slug));
}

module.exports = {
  loadEdgeFunction,
};
