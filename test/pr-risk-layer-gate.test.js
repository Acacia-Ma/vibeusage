const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");
const gateModulePath = path.join(repoRoot, "scripts", "ops", "pr-risk-layer-gate.cjs");

function loadGateModule() {
  delete require.cache[require.resolve(gateModulePath)];
  return require(gateModulePath);
}

function writeTempFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function createCompleteBody() {
  return `# What does this PR do?

Add a stable PR review contract with live-body CI validation.

## Related Issue

Fixes #134

## Type of Change

- [x] CI / workflow
- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs
- [ ] Risk / contract change

## Changes Made

- redesign the PR body contract around stable required sections
- move re-review notes into optional reviewer context
- prefer live GitHub PR body in CI

## Affected Modules / Contracts

- **Modules touched:** \`.github/PULL_REQUEST_TEMPLATE.md\`, \`scripts/ops/pr-risk-layer-gate.cjs\`, \`scripts/ops/pr-risk-layer-gate.config.json\`, \`docs/ops/pr-review-preflight.md\`, \`test/pr-risk-layer-gate.test.js\`
- **Dependencies / contracts touched:** PR template contract, CI PR body source precedence, reviewer workflow wording
- **Repo sitemap evidence:** \`not required\`

## Validation

### Automated

- \`node --test test/pr-risk-layer-gate.test.js\` => PASS

### Manual / smoke

- rerun CI after editing the PR body and confirm the gate reads the live PR body

### Uncovered scope

- live GitHub Actions network path

## Risk Flags

- [ ] Public exposure / share links / unauthenticated access
- [ ] Auth/session/token handling
- [x] Cross-endpoint invariants or shared logic
- [ ] External gateway / environment constraints

## Risk Addendum (required if any risk flag is checked)

### Rules / Invariants

- reviewer context is optional and must not be part of the hard gate

### Boundary Matrix (must list at least 3)

- PR template -> gate config -> required sections
- live GitHub API body -> parser -> validation result
- checked risk flag -> addendum completeness -> CI exit code

### Evidence

- \`node --test test/pr-risk-layer-gate.test.js\` => PASS

## Reviewer Context (optional)

- **Review focus:** source precedence and optional reviewer context
- **Delta since last review:** rename sections and remove Codex-specific hard gate
- **Depends on:** none
- **Known gaps / follow-ups:** none

## Screenshots / Logs (optional)

- N/A
`;
}

test("evaluatePrBody fails when required affected-modules section is missing", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    /\n## Affected Modules \/ Contracts[\s\S]*?\n## Validation/,
    "\n## Validation",
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Affected Modules / Contracts")),
    `expected missing affected modules error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody rejects untouched affected-modules template stub lines", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    /## Affected Modules \/ Contracts[\s\S]*?## Validation/,
    `## Affected Modules / Contracts

- **Modules touched:**
- **Dependencies / contracts touched:**
- **Repo sitemap evidence:** \`updated\` / \`not required\` / affected section(s)

## Validation`,
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Affected Modules / Contracts")),
    `expected untouched template stubs to fail affected-modules validation, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody passes without reviewer context because it is optional", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    /\n## Reviewer Context \(optional\)[\s\S]*?\n## Screenshots \/ Logs \(optional\)/,
    "\n## Screenshots / Logs (optional)",
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("evaluatePrBody fails when type of change has no checked item", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(/- \[x\] CI \/ workflow/, "- [ ] CI / workflow");

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Type of Change") && error.includes("checked")),
    `expected checked type-of-change error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody fails when validation subsections are left as placeholders", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    /## Validation[\s\S]*?## Risk Flags/,
    `## Validation

### Automated

- 

### Manual / smoke

- 

### Uncovered scope

- 

## Risk Flags`,
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Automated") && error.includes("non-placeholder")),
    `expected validation subsection error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody fails when risk layer is checked without complete addendum", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    /### Boundary Matrix \(must list at least 3\)[\s\S]*?### Evidence/,
    `### Boundary Matrix (must list at least 3)

- PR template -> gate config -> required sections

### Evidence`,
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Boundary Matrix")),
    `expected boundary matrix error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody requires public exposure addendum only when public exposure is checked", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = createCompleteBody().replace(
    "- [ ] Public exposure / share links / unauthenticated access",
    "- [x] Public exposure / share links / unauthenticated access",
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Public Exposure Addendum")),
    `expected public exposure addendum error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody passes for complete default-config PR body", () => {
  const { DEFAULT_CONFIG, evaluatePrBody } = loadGateModule();
  const body = `${createCompleteBody()}
## Public Exposure Addendum (required if public exposure is checked)

- **Access rules:** N/A
- **Exposed fields:** N/A
- **Avatar / image policy:** N/A
- **Regression coverage:** N/A
`;

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("evaluatePrBody supports reusable custom config", () => {
  const { evaluatePrBody } = loadGateModule();
  const config = {
    requiredSections: [
      { heading: "Summary", minContentLines: 1 },
      { heading: "Validation", minListItems: 2 },
    ],
    conditionalSections: [
      {
        triggerHeading: "Risk Flags",
        triggerLabels: ["Needs migration"],
        requiredSections: [{ heading: "Rollback Plan", minContentLines: 1 }],
      },
    ],
    placeholderValues: ["-"],
  };
  const body = `# Change

## Summary

Migration script for the new storage layout.

## Validation

- unit tests
- smoke run

## Risk Flags

- [x] Needs migration

## Rollback Plan

Re-run the old migration and restore previous config.
`;

  const result = evaluatePrBody(body, config);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("loadBodyFromEvent reads pull request body from GitHub event payload", () => {
  const { loadBodyFromEvent } = loadGateModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-risk-layer-"));
  const eventPath = writeTempFile(
    root,
    "event.json",
    JSON.stringify({
      pull_request: {
        body: "## Summary\n\nReusable gate body\n",
      },
    }),
  );

  const body = loadBodyFromEvent(eventPath);
  assert.equal(body, "## Summary\n\nReusable gate body\n");
});

test("loadBodyFromEvent returns null when event has no PR or issue body source", () => {
  const { loadBodyFromEvent } = loadGateModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-risk-layer-missing-"));
  const eventPath = writeTempFile(
    root,
    "event.json",
    JSON.stringify({
      repository: {
        full_name: "victorGPT/vibeusage",
      },
    }),
  );

  const body = loadBodyFromEvent(eventPath);
  assert.equal(body, null);
});

test("resolveBody prefers live GitHub API body over stale event payload body", async () => {
  const gate = loadGateModule();
  assert.equal(typeof gate.resolveBody, "function", "expected resolveBody export");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-risk-layer-live-"));
  const eventPath = writeTempFile(
    root,
    "event.json",
    JSON.stringify({
      repository: { full_name: "victorGPT/vibeusage" },
      pull_request: { number: 134, body: "stale body" },
    }),
  );

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ body: "live body" }),
  });

  try {
    const body = await gate.resolveBody({ eventFile: eventPath }, {
      env: {
        GITHUB_TOKEN: "test-token",
        GITHUB_REPOSITORY: "victorGPT/vibeusage",
      },
    });
    assert.equal(body, "live body");
  } finally {
    global.fetch = originalFetch;
  }
});

test("resolveBody falls back to event payload when live GitHub API fetch fails", async () => {
  const gate = loadGateModule();
  assert.equal(typeof gate.resolveBody, "function", "expected resolveBody export");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-risk-layer-fallback-"));
  const eventPath = writeTempFile(
    root,
    "event.json",
    JSON.stringify({
      repository: { full_name: "victorGPT/vibeusage" },
      pull_request: { number: 134, body: "stale but usable body" },
    }),
  );

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const body = await gate.resolveBody({ eventFile: eventPath }, {
      env: {
        GITHUB_TOKEN: "test-token",
        GITHUB_REPOSITORY: "victorGPT/vibeusage",
      },
    });
    assert.equal(body, "stale but usable body");
  } finally {
    global.fetch = originalFetch;
  }
});

test("CLI gate treats empty PR body as invalid instead of skipping", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pr-risk-layer-empty-"));
  const eventPath = writeTempFile(
    root,
    "event.json",
    JSON.stringify({
      pull_request: {
        body: "",
      },
    }),
  );

  const result = cp.spawnSync(
    process.execPath,
    [gateModulePath, "--event-file", eventPath],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1, `expected exit 1, got ${result.status}.\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /PR risk layer gate failed:/);
  assert.match(result.stderr, /Missing required section:/);
});

test("default config headings stay aligned with PR template", () => {
  const { DEFAULT_CONFIG } = loadGateModule();
  const template = fs.readFileSync(
    path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md"),
    "utf8",
  );

  for (const section of DEFAULT_CONFIG.requiredSections) {
    assert.ok(
      template.includes(`## ${section.heading}`) || template.includes(`# ${section.heading}`),
      `expected PR template to include section "${section.heading}"`,
    );
  }

  for (const rule of DEFAULT_CONFIG.conditionalSections) {
    assert.ok(
      template.includes(`## ${rule.triggerHeading}`),
      `expected PR template to include trigger section "${rule.triggerHeading}"`,
    );
    for (const label of rule.triggerLabels) {
      assert.ok(
        template.includes(label),
        `expected PR template to include trigger label "${label}"`,
      );
    }
    for (const section of rule.requiredSections) {
      assert.ok(
        template.includes(`## ${section.heading}`) || template.includes(`### ${section.heading}`),
        `expected PR template to include conditional section "${section.heading}"`,
      );
    }
  }
});
