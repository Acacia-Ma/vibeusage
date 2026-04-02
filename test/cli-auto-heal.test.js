const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { run } = require("../src/cli");
const { buildClaudeHookCommand } = require("../src/lib/claude-config");

test("cli status auto-heals Claude hooks installed before Stop support", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-cli-heal-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const binDir = path.join(tmp, ".vibeusage", "bin");
    const claudeDir = path.join(tmp, ".claude");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const notifyPath = path.join(binDir, "notify.cjs");
    const hookCommand = buildClaudeHookCommand(notifyPath);
    await fs.writeFile(notifyPath, "// noop\n", "utf8");
    await fs.writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify(
        {
          hooks: {
            SessionEnd: [{ hooks: [{ type: "command", command: hookCommand }] }],
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    process.stdout.write = () => true;
    await run(["status"]);

    const settings = JSON.parse(await fs.readFile(path.join(claudeDir, "settings.json"), "utf8"));
    assert.deepEqual(settings.hooks.Stop, [
      { hooks: [{ type: "command", command: hookCommand }] },
    ]);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("cli status does not rewrite Claude hooks before notify shim exists", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-cli-heal-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    const binDir = path.join(tmp, ".vibeusage", "bin");
    const claudeDir = path.join(tmp, ".claude");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(claudeDir, { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const notifyPath = path.join(binDir, "notify.cjs");
    const hookCommand = buildClaudeHookCommand(notifyPath);
    const settingsPath = path.join(claudeDir, "settings.json");
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          hooks: {
            SessionEnd: [{ hooks: [{ type: "command", command: hookCommand }] }],
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    process.stdout.write = () => true;
    await run(["status"]);

    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    assert.equal(settings.hooks.Stop, undefined);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
