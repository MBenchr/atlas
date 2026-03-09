#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildFreshnessContract, freshnessStatusFromAge, computeAgeHours } from './lib/data-freshness.mjs';

const ROOT = process.cwd();

function resolveSlaHours() {
  const normal = Number(process.env.ATLAS_FRESHNESS_NORMAL_HOURS || 24);
  const degraded = Number(process.env.ATLAS_FRESHNESS_DEGRADED_HOURS || 48);
  return {
    normal: Number.isFinite(normal) ? normal : 24,
    degraded: Number.isFinite(degraded) ? degraded : 48
  };
}

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(relativePath, payload) {
  const filePath = path.join(ROOT, relativePath);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function extractGeneratedAt(datasetName, payload) {
  if (typeof payload?.generatedAt === 'string') return payload.generatedAt;

  if (datasetName === 'atlas-history') {
    const snapshots = Array.isArray(payload?.snapshots) ? payload.snapshots : [];
    const latest = snapshots[snapshots.length - 1];
    if (latest && typeof latest.generatedAt === 'string') return latest.generatedAt;
  }

  return null;
}

async function main() {
  const manifest = await readJson('data/contracts/manifest.json');
  const atlasData = await readJson('data/atlas-data.json');
  const atlasHistory = await readJson('data/atlas-history.json');

  const datasetRows = [];
  for (const [datasetName, config] of Object.entries(manifest.datasets || {})) {
    const payload = await readJson(config.dataFile);
    const generatedAt = extractGeneratedAt(datasetName, payload);
    if (!generatedAt) continue;
    datasetRows.push({
      dataset: datasetName,
      file: config.dataFile,
      generatedAt
    });
  }

  const freshnessContract = buildFreshnessContract({
    datasets: datasetRows,
    slaHours: resolveSlaHours(),
    generatedAt: new Date().toISOString()
  });

  atlasData.freshnessContract = freshnessContract;

  const latestSnapshot = Array.isArray(atlasHistory.snapshots) ? atlasHistory.snapshots[atlasHistory.snapshots.length - 1] : null;
  const latestSnapshotGeneratedAt = latestSnapshot?.generatedAt || null;
  const latestSnapshotAgeHours = latestSnapshotGeneratedAt ? computeAgeHours(latestSnapshotGeneratedAt) : null;
  const latestSnapshotStatus = freshnessStatusFromAge(latestSnapshotAgeHours, freshnessContract.slaHours);

  atlasHistory.freshnessContract = {
    generatedAt: freshnessContract.generatedAt,
    slaHours: freshnessContract.slaHours,
    latestSnapshotGeneratedAt,
    latestSnapshotAgeHours: Number(latestSnapshotAgeHours ?? 0),
    latestSnapshotStatus
  };

  await Promise.all([
    writeJson('data/atlas-data.json', atlasData),
    writeJson('data/atlas-history.json', atlasHistory)
  ]);

  console.log(`Freshness contract generated (global=${freshnessContract.globalStatus}, stale=${freshnessContract.staleDatasetCount}).`);
}

main().catch((error) => {
  console.error('Failed to generate freshness contract:', error?.message || error);
  process.exit(1);
});
