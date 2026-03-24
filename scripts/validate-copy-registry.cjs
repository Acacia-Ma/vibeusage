const fs = require("fs");
const path = require("path");
const { buildCopyRegistry, REQUIRED_COPY_COLUMNS } = require("../src/shared/copy-registry");

const ROOT = path.resolve(__dirname, "..");
const COPY_PATH = path.join(ROOT, "dashboard", "src", "content", "copy.csv");
const SRC_ROOT = path.join(ROOT, "dashboard", "src");

function readRegistry() {
  const raw = fs.readFileSync(COPY_PATH, "utf8");
  const registry = buildCopyRegistry(raw || "");
  if (!registry.header.length) {
    throw new Error(`Copy registry is empty: ${COPY_PATH}`);
  }
  if (registry.missingColumns.length) {
    throw new Error(`Copy registry missing columns: ${registry.missingColumns.join(", ")}`);
  }
  return registry;
}

function walkFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkFiles(fullPath, results);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/[.](js|jsx|ts|tsx)$/.test(entry.name)) continue;
    results.push(fullPath);
  }
  return results;
}

function extractKeys(source) {
  const keys = [];
  const regex = /\bcopy\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source))) {
    keys.push(match[1]);
  }
  return keys;
}

function main() {
  const errors = [];
  const warnings = [];

  let registry = null;
  try {
    registry = readRegistry();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const registryMap = new Map();

  for (const record of registry.rows) {
    registryMap.set(record.key, record);

    for (const col of REQUIRED_COPY_COLUMNS) {
      const value = record[col];
      if (!value || String(value).trim() === "") {
        errors.push(`Row ${record.row}: missing ${col} for key '${record.key || "<empty>"}'`);
        break;
      }
    }
  }

  for (const [key, rows] of registry.duplicates.entries()) {
    errors.push(`Duplicate key '${key}' found on rows: ${rows.join(", ")}`);
  }

  const files = walkFiles(SRC_ROOT);
  const usedKeys = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    extractKeys(content).forEach((key) => usedKeys.add(key));
  }

  for (const key of usedKeys) {
    if (!registryMap.has(key)) {
      errors.push(`Missing copy key '${key}' in copy.csv`);
    }
  }

  for (const key of registryMap.keys()) {
    if (!usedKeys.has(key)) {
      warnings.push(`Unused copy key '${key}'`);
    }
  }

  if (warnings.length) {
    console.warn("Copy registry warnings:");
    warnings.forEach((line) => console.warn(`- ${line}`));
  }

  if (errors.length) {
    console.error("Copy registry errors:");
    errors.forEach((line) => console.error(`- ${line}`));
    process.exit(1);
  }

  console.log(`Copy registry ok: ${registry.rows.length} entries, ${usedKeys.size} keys used.`);
}

main();
