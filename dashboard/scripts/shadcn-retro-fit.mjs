#!/usr/bin/env node
// shadcn → vibeusage v3 SSOT retro-fitter.
// Input:  path to a raw shadcn component file (jsx / tsx).
// Output: same file with classNames remapped to v3 SSOT tokens.
//         opacity-30..90 stripped (use ink-* alpha tokens instead).
//         rounded-* stripped (DESIGN.md §1: zero radius except .dot).
//
// Usage:
//   node scripts/shadcn-retro-fit.mjs src/ui/shadcn/tooltip.tsx
//   node scripts/shadcn-retro-fit.mjs --check src/ui/shadcn/tooltip.tsx
//
// Mapping source: scripts/shadcn-mapping.json. SSOT: dashboard/DESIGN.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPPING_PATH = path.resolve(__dirname, "shadcn-mapping.json");

function loadMapping() {
  const raw = fs.readFileSync(MAPPING_PATH, "utf8");
  const json = JSON.parse(raw);
  // Flatten all category objects into a single map (excluding meta + arrays).
  const flat = new Map();
  for (const [cat, value] of Object.entries(json)) {
    if (cat.startsWith("_")) continue;
    if (Array.isArray(value)) continue;
    if (typeof value !== "object" || value === null) continue;
    for (const [from, to] of Object.entries(value)) {
      flat.set(from, to);
    }
  }
  return { mapping: flat, opacityStrip: json.opacity_strip || [] };
}

// Match a className token at a word boundary inside a className string.
// We match the *whole token* including any responsive / state prefixes,
// e.g. md:bg-white, hover:text-gray-500, dark:bg-slate-900.
function rewriteToken(token, mapping, opacityStrip) {
  // Split off prefixes (anything ending with :)
  const prefixMatch = token.match(/^((?:[a-z]+:)+)?(.+)$/);
  if (!prefixMatch) return token;
  const prefix = prefixMatch[1] || "";
  const core = prefixMatch[2];

  if (opacityStrip.includes(core)) return null; // drop entirely

  if (mapping.has(core)) {
    const replacement = mapping.get(core);
    if (replacement === "") return null; // strip
    return prefix + replacement;
  }

  // Drop dark: prefix entirely (vibeusage is dark-only by register).
  if (prefix.startsWith("dark:")) return null;

  return token;
}

function rewriteClassString(classStr, mapping, opacityStrip) {
  return classStr
    .split(/\s+/)
    .map((t) => rewriteToken(t, mapping, opacityStrip))
    .filter((t) => t !== null && t !== "")
    .join(" ");
}

// Match className="..." and className={`...`} and cn("...") arguments.
function rewriteFile(content, mapping, opacityStrip) {
  let out = content;

  // className="..."
  out = out.replace(/className=(["'])([^"']*?)\1/g, (m, q, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className=${q}${rewritten}${q}`;
  });

  // className={`...`} (no interpolation case)
  out = out.replace(/className=\{`([^`${}]*?)`\}/g, (m, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className={\`${rewritten}\`}`;
  });

  // cn("string-arg") and cva("string-arg") string literals.
  // Be conservative: only string literals, leave template/var args alone.
  out = out.replace(
    /(\b(?:cn|cva|clsx)\s*\([^)]*?)(["'])([^"'`{}]*?)\2/g,
    (m, before, q, classes) => {
      // skip if there are no tailwind-looking tokens
      if (!/(?:^|\s)(?:bg|text|border|rounded|shadow|ring|opacity)-/.test(classes)) {
        return m;
      }
      const rewritten = rewriteClassString(classes, mapping, opacityStrip);
      return `${before}${q}${rewritten}${q}`;
    },
  );

  return out;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: shadcn-retro-fit.mjs [--check] <file.tsx> [<file.tsx> ...]");
    process.exit(2);
  }
  const check = args[0] === "--check";
  const targets = check ? args.slice(1) : args;

  const { mapping, opacityStrip } = loadMapping();
  let dirty = 0;
  let touched = 0;

  for (const file of targets) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error(`skip (not found): ${file}`);
      continue;
    }
    const before = fs.readFileSync(abs, "utf8");
    const after = rewriteFile(before, mapping, opacityStrip);
    if (before === after) {
      console.log(`unchanged: ${file}`);
      continue;
    }
    if (check) {
      console.error(`would-rewrite: ${file}`);
      dirty++;
    } else {
      fs.writeFileSync(abs, after);
      console.log(`rewrote: ${file}`);
      touched++;
    }
  }

  if (check && dirty > 0) {
    console.error(`${dirty} file(s) would be rewritten.`);
    process.exit(1);
  }
  console.log(check ? "check ok" : `done — ${touched} file(s) rewritten`);
}

main();
