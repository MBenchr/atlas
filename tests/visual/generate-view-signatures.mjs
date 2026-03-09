#!/usr/bin/env node

import { computeViewSignatures, writeViewSignatures } from './_view-signatures.mjs';

const signatures = await computeViewSignatures();
await writeViewSignatures(signatures);
console.log('Visual view signatures baseline regenerated.');
