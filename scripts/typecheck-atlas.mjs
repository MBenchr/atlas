#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const TARGETS = ['app.js', 'scripts', 'tests'];
const ALLOWED_EXTENSIONS = new Set(['.js', '.mjs']);

async function collectFiles(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const stats = await fs.stat(absolutePath);

  if (stats.isFile()) return [absolutePath];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childRelativePath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(childRelativePath)));
      continue;
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(ROOT, childRelativePath));
    }
  }

  return files;
}

function checkFile(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`Syntax check failed for ${path.relative(ROOT, filePath)}\n${output}`);
  }
}

async function main() {
  const files = [];

  for (const target of TARGETS) {
    try {
      files.push(...(await collectFiles(target)));
    } catch {
      // Ignore missing optional target paths.
    }
  }

  if (files.length === 0) {
    throw new Error('No JS/MJS files found for syntax checks');
  }

  const uniqueFiles = [...new Set(files)].sort();

  for (const filePath of uniqueFiles) {
    checkFile(filePath);
  }

  console.log(`Syntax checks passed (${uniqueFiles.length} file(s)).`);
}

main().catch((error) => {
  console.error('Atlas typecheck failed:', error?.message || error);
  process.exit(1);
});
