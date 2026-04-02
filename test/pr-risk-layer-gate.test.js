const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");
const {
  DEFAULT_CONFIG,
  evaluatePrBody,
  loadBodyFromEvent,
} = require("../scripts/ops/pr-risk-layer-gate.cjs");

function writeTempFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function createCompleteBody() {
  return `# PR Goal (one sentence)

## Scope

- Add reusable PR review preflight gate.

## Affected Modules / Dependency Notes

- Modules: scripts/ops, test, docs/ops, .github
- Dependencies/contracts touched: PR template contract, CI preflight, AGENTS workflow
- Repo sitemap evidence: updated Scripts And Validation and Workflow docs sections

## Codex Context (required when requesting @codex review)

- **Delta since last Codex review:** first review on this PR
- **Intended behavior / invariants:** review requests fail fast when required sections are missing
- **Edge cases covered:** missing sections, triggered risk layer without addendum, complete body
- **Tests run (command + result):** node --test test/pr-risk-layer-gate.test.js => PASS
- **Known gaps / out of scope:** no GitHub API polling changes

## Risk Layer Trigger (if any)

- [x] Auth/session/token handling
- [ ] Public exposure / share links / unauthenticated access
- [ ] Cross-endpoint invariants or shared logic
- [ ] External gateway / environment constraints

## Risk Layer Addendum (fill ONLY if any trigger checked)

### Rules / Invariants

- Review gate must fail before @codex review when risk metadata is incomplete.

### Boundary Matrix (must list at least 3)

- PR body -> parser -> required sections
- Risk trigger -> addendum completeness -> exit code
- CI event payload -> PR body extraction -> validation outcome

### Evidence (tests or repro)

- node --test test/pr-risk-layer-gate.test.js => PASS

## Public Exposure Checklist (if applicable)

- [x] Mark N/A if no public exposure

## Regression Test Gate

### Most likely regression surface

- PR body parser drifts from template headings.

### Verification method (choose at least one)

- [x] Automated node test

### Uncovered scope

- GitHub-hosted runtime execution path
`;
}

test("evaluatePrBody fails when required affected-modules section is missing", () => {
  const body = createCompleteBody().replace(
    /\n## Affected Modules \/ Dependency Notes[\s\S]*?\n## Codex Context/,
    "\n## Codex Context",
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Affected Modules / Dependency Notes")),
    `expected missing affected modules error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody rejects untouched affected-modules template stub lines", () => {
  const body = createCompleteBody().replace(
    /## Affected Modules \/ Dependency Notes[\s\S]*?## Codex Context/,
    `## Affected Modules / Dependency Notes

- **Modules touched:**
- **Dependencies / contracts touched:**
- **Repo sitemap evidence:** \`updated\` / \`not required\` / affected section(s)

## Codex Context`,
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Affected Modules / Dependency Notes")),
    `expected untouched template stubs to fail affected-modules validation, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody fails when risk layer is checked without complete addendum", () => {
  const body = createCompleteBody().replace(
    /### Boundary Matrix \(must list at least 3\)[\s\S]*?### Evidence \(tests or repro\)/,
    `### Boundary Matrix (must list at least 3)

- PR body -> parser -> required sections

### Evidence (tests or repro)`,
  );

  const result = evaluatePrBody(body, DEFAULT_CONFIG);

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("Boundary Matrix")),
    `expected boundary matrix error, got ${result.errors.join("\n")}`,
  );
});

test("evaluatePrBody passes for complete default-config PR body", () => {
  const result = evaluatePrBody(createCompleteBody(), DEFAULT_CONFIG);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("evaluatePrBody supports reusable custom config", () => {
  const config = {
    requiredSections: [
      { heading: "Summary", minContentLines: 1 },
      { heading: "Verification", minListItems: 2 },
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

## Verification

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
    [path.join(repoRoot, "scripts", "ops", "pr-risk-layer-gate.cjs"), "--event-file", eventPath],
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
  const template = fs.readFileSync(
    path.join(repoRoot, ".github", "PULL_REQUEST_TEMPLATE.md"),
    "utf8",
  );

  for (const section of DEFAULT_CONFIG.requiredSections) {
    assert.ok(
      template.includes(`## ${section.heading}`),
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
        template.includes(`### ${section.heading}`),
        `expected PR template to include conditional section "${section.heading}"`,
      );
    }
  }
});
