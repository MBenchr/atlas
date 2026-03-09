#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildTrendsCorrelation } from './lib/trends-correlation.mjs';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(relativePath, payload) {
  const filePath = path.join(ROOT, relativePath);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const atlasHistory = await readJson('data/atlas-history.json');
  const correlation = buildTrendsCorrelation(atlasHistory, { generatedAt: new Date().toISOString() });

  atlasHistory.trendsCorrelation = correlation;

  await Promise.all([
    writeJson('data/atlas-history.json', atlasHistory),
    writeJson('data/history/atlas-trends-correlation.json', correlation),
  ]);

  const notable = Array.isArray(correlation.notableEvents) ? correlation.notableEvents.length : 0;
  const samples7 = Number(correlation?.windows?.["7d"]?.sampleCount || 0);
  const samples30 = Number(correlation?.windows?.["30d"]?.sampleCount || 0);
  const samples90 = Number(correlation?.windows?.["90d"]?.sampleCount || 0);

  console.log(
    `Trends correlation generated (events=${notable}, samples: 7d=${samples7}, 30d=${samples30}, 90d=${samples90}).`
  );
}

main().catch((error) => {
  console.error('Failed to generate trends correlation:', error?.message || error);
  process.exit(1);
});

