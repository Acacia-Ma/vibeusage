// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];
const dashboardRoot = path.resolve(import.meta.dirname, "../../..");

async function collectJsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return await collectJsFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    }),
  );
  return files.flat();
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("shared SSOT browser build", () => {
  it("does not emit CommonJS runtime markers into browser bundles", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-dashboard-build-"));
    tempDirs.push(outDir);

    await build({
      configFile: path.join(dashboardRoot, "vite.config.js"),
      root: dashboardRoot,
      mode: "test",
      logLevel: "silent",
      build: {
        outDir,
        emptyOutDir: true,
      },
    });

    const jsFiles = await collectJsFiles(outDir);
    const bundleContents = await Promise.all(jsFiles.map((file) => fs.readFile(file, "utf8")));

    expect(bundleContents.some((content) => content.includes("module.exports"))).toBe(false);
  });
});
