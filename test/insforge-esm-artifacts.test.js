const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = process.cwd();
const FUNCTION_SLUGS = [
  "vibeusage-usage-daily",
  "vibeusage-link-code-init",
  "vibeusage-public-visibility",
  "vibeusage-user-status",
  "vibeusage-usage-model-breakdown",
  "vibeusage-usage-heatmap",
];

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("migrated authed functions use esm sources", () => {
  const loaderSrc = readFile("scripts/lib/load-edge-function.cjs");
  for (const slug of FUNCTION_SLUGS) {
    assert.match(
      loaderSrc,
      new RegExp(`"${slug}"[\\s\\S]*?"insforge-src/functions-esm/${slug}\\.js"`),
    );
  }
});

test("migrated authed function artifacts do not include CommonJS wrappers", () => {
  for (const slug of FUNCTION_SLUGS) {
    const artifact = readFile(`insforge-functions/${slug}.js`);
    assert.doesNotMatch(artifact, /__commonJS/);
    assert.doesNotMatch(artifact, /\bmodule\.exports\b/);
    assert.doesNotMatch(artifact, /\brequire\(/);
  }
});
