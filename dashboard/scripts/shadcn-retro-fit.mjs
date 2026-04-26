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

// Split a Tailwind utility token into its modifier prefix(es) and the
// terminal "core" utility. The split point is the *last* `:` that is not
// inside a bracketed arbitrary-value group like `data-[state=open]:` or
// `[&>svg]:`. A naive regex like `[a-z]+:` cannot do this — it stops at
// `data-[`, leaves the variant unparsed, and the core utility never reaches
// the mapping table.
function splitPrefix(token) {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) lastColon = i;
  }
  if (lastColon === -1) return { prefix: "", core: token };
  return {
    prefix: token.slice(0, lastColon + 1),
    core: token.slice(lastColon + 1),
  };
}

// Rewrite a single className token. Drops the token (returns null) if any
// modifier in the chain is `dark:` (vibeusage is dark-only by register) or
// if the core is in the opacity-strip list.
function rewriteToken(token, mapping, opacityStrip) {
  if (!token) return token;
  const { prefix, core } = splitPrefix(token);

  // Strip the whole token if any modifier in the chain is `dark:` — we are
  // dark-only, light-mode overrides have nothing to override here.
  // Match `dark:` at the start of the chain or after another colon to avoid
  // false positives on, e.g., a hypothetical `mydark:` utility.
  if (/(^|:)dark:/.test(prefix)) return null;

  if (opacityStrip.includes(core)) return null;

  if (mapping.has(core)) {
    const replacement = mapping.get(core);
    if (replacement === "") return null;
    return prefix + replacement;
  }

  return token;
}

function rewriteClassString(classStr, mapping, opacityStrip) {
  return classStr
    .split(/\s+/)
    .map((t) => rewriteToken(t, mapping, opacityStrip))
    .filter((t) => t !== null && t !== "")
    .join(" ");
}

// Heuristic: does this string literal look like Tailwind class soup?
// Used to gate rewriting inside cn() / cva() / clsx() so we don't munge
// unrelated string literals that happen to live inside those calls.
function looksLikeTailwind(s) {
  return /(?:^|\s)(?:[a-z][a-z0-9-]*:|\[)?(?:bg|text|border|rounded|shadow|ring|opacity|outline|font|tracking|leading|p[xytrbl]?|m[xytrbl]?|w|h|min-|max-|flex|grid|gap|space|hidden|block|inline|absolute|relative|fixed|sticky|z|cursor|select|hover|focus|active|disabled|data|aria|group|peer|dark)/.test(
    s,
  );
}

function rewriteAllStringLiteralsIn(src, mapping, opacityStrip) {
  // Matches "..." or '...' literals. We rewrite a literal only if it looks
  // like Tailwind class soup (looksLikeTailwind), so JSX/JS string literals
  // unrelated to className are left alone.
  return src.replace(/(["'])((?:\\.|(?!\1)[^\\])*)\1/g, (m, q, body) => {
    if (!looksLikeTailwind(body)) return m;
    const rewritten = rewriteClassString(body, mapping, opacityStrip);
    return `${q}${rewritten}${q}`;
  });
}

// Match className="..." and className={`...`} and cn(...) / cva(...) /
// clsx(...) arguments. cn() bodies can contain *multiple* string literals
// (and ternaries, vars, etc.) — we replace ALL string literals inside the
// call body, not just the first one.
function rewriteFile(content, mapping, opacityStrip) {
  let out = content;

  // className="..."
  out = out.replace(/className=(["'])([^"']*?)\1/g, (m, q, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className=${q}${rewritten}${q}`;
  });

  // className={`...`} (no template interpolation case)
  out = out.replace(/className=\{`([^`${}]*?)`\}/g, (m, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className={\`${rewritten}\`}`;
  });

  // cn(...) / cva(...) / clsx(...) call bodies — rewrite every string
  // literal inside, not just the first arg. Body matched lazily up to the
  // closing paren; nested parens inside cn() are uncommon and out of scope.
  out = out.replace(
    /(\b(?:cn|cva|clsx)\s*\()([\s\S]*?)(\))/g,
    (m, head, body, tail) =>
      `${head}${rewriteAllStringLiteralsIn(body, mapping, opacityStrip)}${tail}`,
  );

  return out;
}

// Self-test fixtures — every entry asserts a real pattern that has shipped
// in upstream shadcn components. Failures here block CI and signal a
// regression in the rewriter.
const SELF_TESTS = [
  {
    name: "plain className with bg-primary",
    in: 'className="bg-primary"',
    out: 'className="bg-ink"',
  },
  {
    name: "data-[state=open] variant on bg-accent",
    in: 'className="data-[state=open]:bg-accent"',
    out: 'className="data-[state=open]:bg-ink-faint"',
  },
  {
    name: "data-[state=closed] strips dark: chained variant",
    in: 'className="dark:data-[state=open]:bg-slate-900"',
    out: 'className=""',
  },
  {
    name: "aria-selected variant",
    in: 'className="aria-selected:bg-accent"',
    out: 'className="aria-selected:bg-ink-faint"',
  },
  {
    name: "peer-disabled variant on opacity-50 strips token",
    in: 'className="peer-disabled:opacity-50"',
    out: 'className=""',
  },
  {
    name: "group-hover variant",
    in: 'className="group-hover:text-foreground"',
    out: 'className="group-hover:text-ink-bright"',
  },
  {
    name: "[&>svg] arbitrary selector variant",
    in: 'className="[&>svg]:text-muted-foreground"',
    out: 'className="[&>svg]:text-ink-muted"',
  },
  {
    name: "dark: prefix is dropped (mapped core)",
    in: 'className="dark:bg-white"',
    out: 'className=""',
  },
  {
    name: "rounded-md is stripped per zero-radius rule",
    in: 'className="rounded-md"',
    out: 'className=""',
  },
  {
    name: "responsive prefix preserved",
    in: 'className="md:text-2xl"',
    out: 'className="md:text-display-3"',
  },
  {
    name: "stacked responsive + state preserved",
    in: 'className="md:hover:bg-primary"',
    out: 'className="md:hover:bg-ink"',
  },
  {
    name: "multiple string literals inside cn() all rewritten",
    in: 'cn("bg-primary text-sm", "border-border rounded-md")',
    out: 'cn("bg-ink text-caption", "border-ink-line")',
  },
  {
    name: "plain non-tailwind string literal left untouched",
    in: 'cn("Hello world", "bg-primary")',
    out: 'cn("Hello world", "bg-ink")',
  },
];

function runSelfTests() {
  const { mapping, opacityStrip } = loadMapping();
  const failures = [];
  for (const t of SELF_TESTS) {
    const got = rewriteFile(t.in, mapping, opacityStrip);
    if (got !== t.out) {
      failures.push({ name: t.name, input: t.in, expected: t.out, got });
    }
  }
  if (failures.length === 0) {
    console.log(`self-test ok — ${SELF_TESTS.length}/${SELF_TESTS.length} passed`);
    return 0;
  }
  console.error(`self-test FAILED — ${failures.length}/${SELF_TESTS.length}`);
  for (const f of failures) {
    console.error(`  · ${f.name}`);
    console.error(`      in:  ${f.input}`);
    console.error(`      out: ${f.got}`);
    console.error(`      exp: ${f.expected}`);
  }
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: shadcn-retro-fit.mjs [--self-test|--check] <file.tsx> [<file.tsx> ...]",
    );
    process.exit(2);
  }
  if (args[0] === "--self-test") {
    process.exit(runSelfTests());
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
