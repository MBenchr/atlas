import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

function keyOf(entry) {
  return `${entry.domain}::${entry.projection}`;
}

function sorted(values) {
  return [...values].sort();
}

test('all Atlas projection reads are declared in contract registry', async () => {
  const atlasData = await readJson('data/atlas-data.json');
  const contractRegistry = await readJson('tests/contracts/atlas-projection-contracts.json');

  const atlasEntries = atlasData.projectionRegistry;
  const contractEntries = contractRegistry.entries;

  assert.ok(Array.isArray(atlasEntries) && atlasEntries.length > 0, 'atlas-data projectionRegistry must be a non-empty array');
  assert.ok(Array.isArray(contractEntries) && contractEntries.length > 0, 'contract registry entries must be a non-empty array');

  const contractByKey = new Map(contractEntries.map((entry) => [keyOf(entry), entry]));

  for (const atlasEntry of atlasEntries) {
    const key = keyOf(atlasEntry);
    const contractEntry = contractByKey.get(key);

    assert.ok(contractEntry, `missing contract declaration for ${key}`);
    assert.equal(contractEntry.canonical, true, `${key}: canonical must be true`);
    assert.equal(contractEntry.status, 'canonical', `${key}: status must be canonical`);

    assert.deepEqual(
      sorted(contractEntry.consumers),
      sorted(atlasEntry.consumers),
      `${key}: consumer list mismatch between atlas-data and contract registry`
    );

    assert.ok(contractEntry.owner && contractEntry.owner.length > 0, `${key}: owner must be declared`);
    assert.ok(contractEntry.contractVersion && contractEntry.contractVersion.length > 0, `${key}: contractVersion must be declared`);
  }
});

test('contract registry entries are unique and complete', async () => {
  const contractRegistry = await readJson('tests/contracts/atlas-projection-contracts.json');
  const seen = new Set();

  for (const entry of contractRegistry.entries) {
    const key = keyOf(entry);
    assert.ok(!seen.has(key), `duplicate contract entry for ${key}`);
    seen.add(key);

    assert.ok(entry.domain, `${key}: domain is required`);
    assert.ok(entry.projection, `${key}: projection is required`);
    assert.ok(Array.isArray(entry.consumers) && entry.consumers.length > 0, `${key}: consumers must be declared`);
  }
});
