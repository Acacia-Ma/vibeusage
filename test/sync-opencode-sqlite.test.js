const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

test("sync passes only opencode db path to parser without legacy message file discovery", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-opencode-sqlite-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevCodeHome = process.env.CODE_HOME;
  const prevGeminiHome = process.env.GEMINI_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;
  const rolloutPath = require.resolve("../src/lib/rollout");
  const syncPath = require.resolve("../src/commands/sync");

  delete require.cache[syncPath];
  const rollout = require(rolloutPath);
  const originals = {
    listRolloutFiles: rollout.listRolloutFiles,
    listClaudeProjectFiles: rollout.listClaudeProjectFiles,
    listGeminiSessionFiles: rollout.listGeminiSessionFiles,
    listOpencodeMessageFiles: rollout.listOpencodeMessageFiles,
    parseRolloutIncremental: rollout.parseRolloutIncremental,
    parseClaudeIncremental: rollout.parseClaudeIncremental,
    parseGeminiIncremental: rollout.parseGeminiIncremental,
    parseOpencodeIncremental: rollout.parseOpencodeIncremental,
    parseOpenclawIncremental: rollout.parseOpenclawIncremental,
  };

  let opencodeArgs = null;
  let listedOpencodeMessageFiles = false;
  rollout.listRolloutFiles = async () => [];
  rollout.listClaudeProjectFiles = async () => [];
  rollout.listGeminiSessionFiles = async () => [];
  rollout.listOpencodeMessageFiles = async () => {
    listedOpencodeMessageFiles = true;
    return [];
  };
  rollout.parseRolloutIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseClaudeIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseGeminiIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpenclawIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpencodeIncremental = async (args) => {
    opencodeArgs = args;
    return { filesProcessed: 0, eventsAggregated: 1, bucketsQueued: 1 };
  };

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.CODE_HOME = path.join(tmp, ".code");
    process.env.GEMINI_HOME = path.join(tmp, ".gemini");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const { cmdSync } = require(syncPath);
    await cmdSync(["--auto"]);

    assert.ok(opencodeArgs, "expected sync to call parseOpencodeIncremental");
    assert.equal(listedOpencodeMessageFiles, false);
    assert.equal(Object.prototype.hasOwnProperty.call(opencodeArgs, "messageFiles"), false);
    assert.equal(opencodeArgs.opencodeDbPath, path.join(tmp, ".opencode", "opencode.db"));
    assert.equal(opencodeArgs.source, "opencode");
  } finally {
    rollout.listRolloutFiles = originals.listRolloutFiles;
    rollout.listClaudeProjectFiles = originals.listClaudeProjectFiles;
    rollout.listGeminiSessionFiles = originals.listGeminiSessionFiles;
    rollout.listOpencodeMessageFiles = originals.listOpencodeMessageFiles;
    rollout.parseRolloutIncremental = originals.parseRolloutIncremental;
    rollout.parseClaudeIncremental = originals.parseClaudeIncremental;
    rollout.parseGeminiIncremental = originals.parseGeminiIncremental;
    rollout.parseOpencodeIncremental = originals.parseOpencodeIncremental;
    rollout.parseOpenclawIncremental = originals.parseOpenclawIncremental;
    delete require.cache[syncPath];

    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevCodeHome === undefined) delete process.env.CODE_HOME;
    else process.env.CODE_HOME = prevCodeHome;
    if (prevGeminiHome === undefined) delete process.env.GEMINI_HOME;
    else process.env.GEMINI_HOME = prevGeminiHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("manual sync warns when opencode sqlite3 is missing", async () => {
  await runSyncWarningScenario({
    argv: [],
    sqliteStatus: "missing-sqlite3",
    sqliteErrorCode: "ENOENT",
    expectWarning: true,
  });
});

test("manual sync warns when opencode sqlite query fails", async () => {
  await runSyncWarningScenario({
    argv: [],
    sqliteStatus: "query-failed",
    sqliteErrorCode: "SQLITE_CORRUPT",
    expectWarning: true,
  });
});

test("auto sync stays silent when opencode sqlite is degraded", async () => {
  await runSyncWarningScenario({
    argv: ["--auto"],
    sqliteStatus: "missing-sqlite3",
    sqliteErrorCode: "ENOENT",
    expectWarning: false,
  });
});

async function runSyncWarningScenario({ argv, sqliteStatus, sqliteErrorCode, expectWarning }) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-sync-opencode-warning-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevCodeHome = process.env.CODE_HOME;
  const prevGeminiHome = process.env.GEMINI_HOME;
  const prevOpencodeHome = process.env.OPENCODE_HOME;
  const prevStdout = process.stdout.write;
  const prevStderr = process.stderr.write;
  const rolloutPath = require.resolve("../src/lib/rollout");
  const syncPath = require.resolve("../src/commands/sync");

  delete require.cache[syncPath];
  const rollout = require(rolloutPath);
  const originals = {
    listRolloutFiles: rollout.listRolloutFiles,
    listClaudeProjectFiles: rollout.listClaudeProjectFiles,
    listGeminiSessionFiles: rollout.listGeminiSessionFiles,
    listOpencodeMessageFiles: rollout.listOpencodeMessageFiles,
    parseRolloutIncremental: rollout.parseRolloutIncremental,
    parseClaudeIncremental: rollout.parseClaudeIncremental,
    parseGeminiIncremental: rollout.parseGeminiIncremental,
    parseOpencodeIncremental: rollout.parseOpencodeIncremental,
    parseOpenclawIncremental: rollout.parseOpenclawIncremental,
  };

  let stdout = "";
  let stderr = "";
  process.stdout.write = (chunk, enc, cb) => {
    stdout += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
    if (typeof cb === "function") cb();
    return true;
  };
  process.stderr.write = (chunk, enc, cb) => {
    stderr += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
    if (typeof cb === "function") cb();
    return true;
  };

  rollout.listRolloutFiles = async () => [];
  rollout.listClaudeProjectFiles = async () => [];
  rollout.listGeminiSessionFiles = async () => [];
  rollout.listOpencodeMessageFiles = async () => [];
  rollout.parseRolloutIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseClaudeIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseGeminiIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpenclawIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
  });
  rollout.parseOpencodeIncremental = async () => ({
    filesProcessed: 0,
    eventsAggregated: 0,
    bucketsQueued: 0,
    sqliteStatus,
    sqliteCheckedAt: "2026-04-03T00:00:00.000Z",
    sqliteErrorCode,
  });

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    process.env.CODE_HOME = path.join(tmp, ".code");
    process.env.GEMINI_HOME = path.join(tmp, ".gemini");
    process.env.OPENCODE_HOME = path.join(tmp, ".opencode");

    const { cmdSync } = require(syncPath);
    await cmdSync(argv);

    if (!argv.includes("--auto")) {
      assert.match(stdout, /Sync finished:/);
    }
    if (expectWarning) {
      assert.match(stderr, /OpenCode usage may be incomplete/i);
      assert.match(stderr, /vibeusage doctor/);
    } else {
      assert.equal(stderr, "");
    }
  } finally {
    process.stdout.write = prevStdout;
    process.stderr.write = prevStderr;
    rollout.listRolloutFiles = originals.listRolloutFiles;
    rollout.listClaudeProjectFiles = originals.listClaudeProjectFiles;
    rollout.listGeminiSessionFiles = originals.listGeminiSessionFiles;
    rollout.listOpencodeMessageFiles = originals.listOpencodeMessageFiles;
    rollout.parseRolloutIncremental = originals.parseRolloutIncremental;
    rollout.parseClaudeIncremental = originals.parseClaudeIncremental;
    rollout.parseGeminiIncremental = originals.parseGeminiIncremental;
    rollout.parseOpencodeIncremental = originals.parseOpencodeIncremental;
    rollout.parseOpenclawIncremental = originals.parseOpenclawIncremental;
    delete require.cache[syncPath];

    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevCodeHome === undefined) delete process.env.CODE_HOME;
    else process.env.CODE_HOME = prevCodeHome;
    if (prevGeminiHome === undefined) delete process.env.GEMINI_HOME;
    else process.env.GEMINI_HOME = prevGeminiHome;
    if (prevOpencodeHome === undefined) delete process.env.OPENCODE_HOME;
    else process.env.OPENCODE_HOME = prevOpencodeHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
