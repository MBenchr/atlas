#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SOURCE_DIR = "/Users/mohyi/mcp/generated/atlas/site/data";
const TARGET_DIR = "/Users/mohyi/atlas/data";
const ATLAS_ROOT = "/Users/mohyi/atlas";
const POST_SYNC_SCRIPTS = [
  "generate:freshness",
  "generate:priority",
  "generate:alerts",
  "generate:trends",
  "generate:audit",
];

async function copyDirRecursive(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
      continue;
    }
    await fs.copyFile(from, to);
  }
}

async function main() {
  await copyDirRecursive(SOURCE_DIR, TARGET_DIR);
  for (const scriptName of POST_SYNC_SCRIPTS) {
    const result = spawnSync("npm", ["run", scriptName], {
      cwd: ATLAS_ROOT,
      stdio: "inherit",
      encoding: "utf8",
      env: process.env,
    });
    if (result.status !== 0) {
      throw new Error(`post-sync script failed: ${scriptName}`);
    }
  }
  process.stdout.write(`[atlas-sync] copied generated datasets from ${SOURCE_DIR} to ${TARGET_DIR}\n`);
}

main().catch((error) => {
  process.stderr.write(`[atlas-sync] failed: ${String(error?.message || error)}\n`);
  process.exit(1);
});
