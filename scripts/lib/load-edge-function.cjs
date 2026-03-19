"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MIGRATED_FUNCTION_SOURCES = new Map([
  ["vibeusage-leaderboard", "insforge-src/functions-esm/vibeusage-leaderboard.js"],
  ["vibeusage-usage-summary", "insforge-src/functions-esm/vibeusage-usage-summary.js"],
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
