#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function statSize(relativePath) {
  try {
    const filePath = path.join(ROOT, relativePath);
    const stats = await fs.stat(filePath);
    return Number(stats.size || 0);
  } catch {
    return null;
  }
}

async function buildDatasetArtifacts(atlasData, atlasHistory) {
  const generatedAt = atlasData?.generatedAt || new Date().toISOString();
  const historyGeneratedAt = atlasHistory?.snapshots?.at(-1)?.generatedAt || generatedAt;

  const rows = [
    {
      id: 'dataset:atlas-data',
      type: 'dataset',
      source: 'generated',
      label: 'Dataset Atlas principal',
      path: 'data/atlas-data.json',
      generatedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:atlas-history',
      type: 'dataset',
      source: 'generated',
      label: 'Historique Atlas',
      path: 'data/atlas-history.json',
      generatedAt: historyGeneratedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:architecture-drift',
      type: 'dataset',
      source: 'generated',
      label: 'Rapport de dérive',
      path: 'data/architecture-drift.json',
      generatedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:architecture-score',
      type: 'dataset',
      source: 'generated',
      label: 'Score architecture',
      path: 'data/architecture-score.json',
      generatedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:architecture-policy-report',
      type: 'dataset',
      source: 'generated',
      label: 'Rapport policy',
      path: 'data/architecture-policy-report.json',
      generatedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:architecture-strategy-report',
      type: 'dataset',
      source: 'generated',
      label: 'Rapport strategy',
      path: 'data/architecture-strategy-report.json',
      generatedAt,
      domain: 'platform',
    },
    {
      id: 'dataset:trends-correlation',
      type: 'dataset',
      source: 'history',
      label: 'Projection trends correlation',
      path: 'data/history/atlas-trends-correlation.json',
      generatedAt: atlasHistory?.trendsCorrelation?.generatedAt || historyGeneratedAt,
      domain: 'platform',
    },
  ];

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      sizeBytes: await statSize(row.path),
    }))
  );
}

async function buildSnapshotArtifacts(atlasHistory) {
  const snapshots = Array.isArray(atlasHistory?.snapshots) ? atlasHistory.snapshots : [];
  return Promise.all(
    snapshots.map(async (row, index) => {
      const relPath = `data/${row.file}`;
      return {
        id: `snapshot:${row.file}`,
        type: 'snapshot',
        source: 'history',
        label: `Snapshot brut ${index + 1}/${snapshots.length}`,
        path: relPath,
        generatedAt: row.generatedAt || new Date().toISOString(),
        sizeBytes: await statSize(relPath),
        domain: 'platform',
      };
    })
  );
}

async function main() {
  const [atlasData, atlasHistory] = await Promise.all([
    readJson('data/atlas-data.json'),
    readJson('data/atlas-history.json'),
  ]);

  const [datasets, snapshots] = await Promise.all([
    buildDatasetArtifacts(atlasData, atlasHistory),
    buildSnapshotArtifacts(atlasHistory),
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      atlasData: 'data/atlas-data.json',
      atlasHistory: 'data/atlas-history.json',
    },
    artifacts: [...datasets, ...snapshots],
  };

  await fs.writeFile(
    path.join(ROOT, 'data/history/atlas-audit-index.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8'
  );

  console.log(`Audit index generated (${payload.artifacts.length} artifact(s)).`);
}

main().catch((error) => {
  console.error('Failed to generate audit index:', error?.message || error);
  process.exit(1);
});
