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

test('multi-consumer projections have explicit compatibility policy', async () => {
  const contractRegistry = await readJson('tests/contracts/atlas-projection-contracts.json');
  const multiConsumerEntries = contractRegistry.entries.filter((entry) => Array.isArray(entry.consumers) && entry.consumers.length > 1);

  assert.ok(multiConsumerEntries.length > 0, 'expected at least one multi-consumer projection');

  for (const entry of multiConsumerEntries) {
    const key = keyOf(entry);
    const compatibility = entry.compatibility || {};

    assert.equal(compatibility.backwardCompatible, true, `${key}: backwardCompatible must be true`);
    assert.equal(compatibility.forwardTolerant, true, `${key}: forwardTolerant must be true`);
    assert.equal(compatibility.breakingPolicy, 'major-with-migration', `${key}: breakingPolicy must be major-with-migration`);
    assert.equal(compatibility.migrationRequired, true, `${key}: migrationRequired must be true`);
  }
});

test('all consumers in atlas projection registry are authorized in consumer matrix source', async () => {
  const atlasData = await readJson('data/atlas-data.json');
  const contractRegistry = await readJson('tests/contracts/atlas-projection-contracts.json');

  const contractByKey = new Map(contractRegistry.entries.map((entry) => [keyOf(entry), entry]));

  for (const atlasEntry of atlasData.projectionRegistry) {
    const key = keyOf(atlasEntry);
    const registryEntry = contractByKey.get(key);

    assert.ok(registryEntry, `missing consumer matrix entry for ${key}`);

    for (const consumer of atlasEntry.consumers) {
      assert.ok(
        registryEntry.consumers.includes(consumer),
        `${key}: consumer ${consumer} is not authorized in matrix source`
      );
    }
  }
});
