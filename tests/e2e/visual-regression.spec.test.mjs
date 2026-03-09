import test from 'node:test';
import assert from 'node:assert/strict';

import { computeViewSignatures } from '../visual/_view-signatures.mjs';
import { readViewSignatures } from '../visual/_view-signatures.mjs';

test('visual signatures match baseline for critical decision views', async () => {
  const [actual, expected] = await Promise.all([computeViewSignatures(), readViewSignatures()]);
  assert.deepEqual(actual, expected);
});
