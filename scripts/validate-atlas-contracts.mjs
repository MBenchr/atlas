#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'data/contracts/manifest.json');

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeOfValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function typeMatches(value, expectedType) {
  switch (expectedType) {
    case 'object':
      return isObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function validateSchema(value, schema, currentPath, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const anyOfMatched = schema.anyOf.some((candidate) => {
      const candidateErrors = [];
      validateSchema(value, candidate, currentPath, candidateErrors);
      return candidateErrors.length === 0;
    });
    if (!anyOfMatched) {
      errors.push(`${currentPath}: value does not match any allowed schema variant (anyOf)`);
      return;
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${currentPath}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${currentPath}: expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matchedType = expectedTypes.some((t) => typeMatches(value, t));
    if (!matchedType) {
      errors.push(
        `${currentPath}: expected type ${expectedTypes.join('|')}, got ${typeOfValue(value)}`
      );
      return;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${currentPath}: expected minLength ${schema.minLength}, got ${value.length}`);
    }
    if (typeof schema.pattern === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${currentPath}: string does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${currentPath}: expected minimum ${schema.minimum}, got ${value}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${currentPath}: expected maximum ${schema.maximum}, got ${value}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${currentPath}: expected minItems ${schema.minItems}, got ${value.length}`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        validateSchema(value[i], schema.items, `${currentPath}[${i}]`, errors);
      }
    }
    return;
  }

  if (!isObject(value)) return;

  if (typeof schema.minProperties === 'number' && Object.keys(value).length < schema.minProperties) {
    errors.push(`${currentPath}: expected minProperties ${schema.minProperties}, got ${Object.keys(value).length}`);
  }

  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  for (const requiredKey of required) {
    if (!(requiredKey in value)) {
      errors.push(`${currentPath}.${requiredKey}: missing required property`);
    }
  }

  for (const [key, childSchema] of Object.entries(properties)) {
    if (key in value) {
      validateSchema(value[key], childSchema, `${currentPath}.${key}`, errors);
    }
  }

  const hasAdditionalPropertiesFlag = Object.prototype.hasOwnProperty.call(schema, 'additionalProperties');
  const additionalProperties = schema.additionalProperties;

  for (const [key, childValue] of Object.entries(value)) {
    const knownProperty = Object.prototype.hasOwnProperty.call(properties, key);
    if (knownProperty) continue;

    if (hasAdditionalPropertiesFlag && additionalProperties === false) {
      errors.push(`${currentPath}.${key}: additional property is not allowed`);
      continue;
    }

    if (isObject(additionalProperties)) {
      validateSchema(childValue, additionalProperties, `${currentPath}.${key}`, errors);
    }
  }
}

async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const selectedDatasets = new Set();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dataset' && args[i + 1]) {
      selectedDatasets.add(args[i + 1]);
      i += 1;
    }
  }

  return { selectedDatasets };
}

async function main() {
  const { selectedDatasets } = parseArgs();
  const manifest = await readJson(MANIFEST_PATH);
  const datasets = Object.entries(manifest.datasets || {});

  if (datasets.length === 0) {
    console.error('No datasets declared in data/contracts/manifest.json');
    process.exit(1);
  }

  const failures = [];
  let validatedCount = 0;

  for (const [datasetName, datasetConfig] of datasets) {
    if (selectedDatasets.size > 0 && !selectedDatasets.has(datasetName)) {
      continue;
    }

    validatedCount += 1;

    const dataFilePath = path.join(ROOT, datasetConfig.dataFile);
    const schemaFilePath = path.join(ROOT, datasetConfig.schemaFile);

    const [data, schema] = await Promise.all([
      readJson(dataFilePath),
      readJson(schemaFilePath)
    ]);

    const errors = [];
    validateSchema(data, schema, '$', errors);

    if (errors.length > 0) {
      failures.push({ datasetName, errors });
      console.error(`FAIL ${datasetName} (${datasetConfig.currentSchemaVersion}) - ${errors.length} error(s)`);
      for (const err of errors.slice(0, 20)) {
        console.error(`  - ${err}`);
      }
      if (errors.length > 20) {
        console.error(`  - ... ${errors.length - 20} more error(s)`);
      }
    } else {
      console.log(`PASS ${datasetName} (${datasetConfig.currentSchemaVersion})`);
    }
  }

  if (validatedCount === 0) {
    console.error('No dataset matched the requested filters.');
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error(`\nContract validation failed for ${failures.length}/${validatedCount} dataset(s).`);
    process.exit(1);
  }

  console.log(`\nAll Atlas data contracts passed (${validatedCount}/${validatedCount}).`);
}

main().catch((error) => {
  console.error('Contract validation execution failed:', error?.message || error);
  process.exit(1);
});
