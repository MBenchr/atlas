#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { assertServiceOpsGuardrails } from './lib/service-ops-guardrails.mjs';

const ROOT = process.cwd();
const OUTPUT_PATH = 'data/history/atlas-discipline-report.json';
const FULL_MODE = process.argv.includes('--full');

const SOURCE_FILES = [
  'AGENTS.md',
  'tasks/lessons.md',
  'docs/atlas-decision-stack.md',
  'docs/non-regression-matrix.md'
];

const REQUIRED_GOVERNANCE_FILES = [
  'AGENTS.md',
  'tasks/lessons.md',
  'docs/atlas-decision-stack.md',
  'docs/atlas-execution-board.md',
  'docs/non-regression-matrix.md',
  'docs/projection-registry.md',
  'docs/consumer-contract-matrix.md',
  'docs/discipline-dashboard.md',
  'scripts/generate-discipline-report.mjs',
  'scripts/lint-atlas.mjs',
  'scripts/lint-canonical-guardrails.mjs',
  'scripts/smoke-atlas.mjs',
  'scripts/validate-atlas-contracts.mjs'
];

const REQUIRED_LESSON_FIELDS = [
  'Date:',
  'Issue:',
  'Context:',
  'Failure mode:',
  'Root cause:',
  'Guardrail added:',
  'Proof:',
  'Follow-up:'
];

const MUST_KEYWORDS = [
  'must',
  'do not',
  'never',
  'always',
  'mandatory',
  'required',
  'block',
  'gate',
  'canonique',
  'canonical',
  'without',
  'before',
  'after',
  'strict',
  'doctrine'
];

function nowIso() {
  return new Date().toISOString();
}

async function readText(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.readFile(fullPath, 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function pathExistsAbsolute(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFilesRecursively(relativeDir) {
  const startAbsolute = path.join(ROOT, relativeDir);
  const collected = [];

  async function walk(currentAbsolute) {
    const entries = await fs.readdir(currentAbsolute, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentAbsolute, entry.name);
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      collected.push(path.relative(ROOT, absolute));
    }
  }

  try {
    await walk(startAbsolute);
  } catch {
    return [];
  }

  return collected.sort((a, b) => a.localeCompare(b));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function shouldCapturePlainRule(line) {
  const text = line.trim();
  if (!text) return false;
  if (text.startsWith('#')) return false;
  if (text.startsWith('|')) return false;
  if (text.startsWith('```')) return false;
  if (text.startsWith('---')) return false;
  const lower = text.toLowerCase();
  if (lower.length < 20) return false;
  return MUST_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function extractRulesFromMarkdown(sourcePath, content) {
  if (sourcePath === 'tasks/lessons.md') {
    return extractRulesFromLessons(sourcePath, content);
  }

  const rules = [];
  const lines = content.split(/\r?\n/);
  let currentSection = 'root';
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    const headingMatch = line.match(/^#{2,6}\s+(.+)$/);
    if (headingMatch) {
      currentSection = normalizeText(headingMatch[1]);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(?![-])(.*)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    const checklistMatch = line.match(/^\s*-\s*\[[xX ]\]\s+(.*)$/);

    let rawText = null;
    if (checklistMatch) rawText = checklistMatch[1];
    else if (bulletMatch) rawText = bulletMatch[1];
    else if (numberedMatch) rawText = numberedMatch[1];
    else if (shouldCapturePlainRule(line)) rawText = line;

    if (!rawText) continue;

    const text = normalizeText(rawText.replace(/`/g, ''));
    if (!text || text === '---') continue;

    const dedupeKey = `${sourcePath}|${currentSection}|${text.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rules.push({
      id: `rule:${sourcePath.replace(/[^a-zA-Z0-9]+/g, '-')}:${lineNumber}`,
      sourceFile: sourcePath,
      sourceAbsolutePath: path.join(ROOT, sourcePath),
      sourceLine: lineNumber,
      section: currentSection,
      text
    });
  }

  return rules;
}

function extractRulesFromLessons(sourcePath, content) {
  const rules = [];
  const lines = content.split(/\r?\n/);
  const seen = new Set();

  let currentSection = 'root';
  let inGuardrailBlock = false;

  const fieldLabels = new Set(['Date:', 'Issue:', 'Context:', 'Failure mode:', 'Root cause:', 'Guardrail added:', 'Proof:', 'Follow-up:']);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();

    const headingMatch = line.match(/^#{2,6}\s+(.+)$/);
    if (headingMatch) {
      currentSection = normalizeText(headingMatch[1]);
      inGuardrailBlock = false;
      continue;
    }

    if (/^Guardrail added:\s*$/i.test(trimmed)) {
      inGuardrailBlock = true;
      continue;
    }

    const inlineGuardrailMatch = trimmed.match(/^Guardrail added:\s*(.+)$/i);
    if (inlineGuardrailMatch) {
      inGuardrailBlock = true;
      const text = normalizeText(inlineGuardrailMatch[1].replace(/`/g, ''));
      if (text) {
        const dedupeKey = `${sourcePath}|${currentSection}|${text.toLowerCase()}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          rules.push({
            id: `rule:${sourcePath.replace(/[^a-zA-Z0-9]+/g, '-')}:${lineNumber}`,
            sourceFile: sourcePath,
            sourceAbsolutePath: path.join(ROOT, sourcePath),
            sourceLine: lineNumber,
            section: currentSection,
            text
          });
        }
      }
      continue;
    }

    if (!inGuardrailBlock) continue;

    if (fieldLabels.has(trimmed)) {
      inGuardrailBlock = false;
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    let rawText = bulletMatch ? bulletMatch[1] : null;

    if (!rawText && shouldCapturePlainRule(line)) {
      rawText = line;
    }

    if (!rawText) continue;

    const text = normalizeText(rawText.replace(/`/g, ''));
    if (!text || text === '---') continue;

    const dedupeKey = `${sourcePath}|${currentSection}|${text.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rules.push({
      id: `rule:${sourcePath.replace(/[^a-zA-Z0-9]+/g, '-')}:${lineNumber}`,
      sourceFile: sourcePath,
      sourceAbsolutePath: path.join(ROOT, sourcePath),
      sourceLine: lineNumber,
      section: currentSection,
      text
    });
  }

  return rules;
}

function inferTags(rule) {
  const lower = `${rule.section} ${rule.text}`.toLowerCase();
  const tags = new Set();

  if (rule.sourceFile === 'tasks/lessons.md') {
    tags.add('lessons');
    tags.add('quality');
  } else if (rule.sourceFile === 'docs/non-regression-matrix.md') {
    tags.add('quality');
    tags.add('contracts');
  } else if (rule.sourceFile === 'docs/atlas-decision-stack.md') {
    tags.add('architecture');
    tags.add('linear');
  } else if (rule.sourceFile === 'AGENTS.md') {
    tags.add('architecture');
    tags.add('doctrine');
  }

  if (lower.includes('core decides') || lower.includes('projections explain') || lower.includes('apps render') || lower.includes('doctrine')) {
    tags.add('doctrine');
    tags.add('architecture');
  }
  if (lower.includes('canonical') || lower.includes('canonique') || lower.includes('write-path') || lower.includes('business truth') || lower.includes('recomputation') || lower.includes('projection')) {
    tags.add('architecture');
  }
  if (lower.includes('contract') || lower.includes('schema') || lower.includes('compatibility') || lower.includes('consumer')) {
    tags.add('contracts');
  }
  if (lower.includes('lint') || lower.includes('typecheck') || lower.includes('test') || lower.includes('smoke') || lower.includes('e2e') || lower.includes('quality') || lower.includes('check')) {
    tags.add('quality');
  }
  if (lower.includes('freshness') || lower.includes('fraicheur') || lower.includes('stale') || lower.includes('sla')) {
    tags.add('freshness');
  }
  if (lower.includes('alert')) {
    tags.add('alerts');
  }
  if (lower.includes('linear') || lower.includes('board') || lower.includes('queue') || lower.includes('ticket') || lower.includes('phase:now')) {
    tags.add('linear');
  }
  if (lower.includes('lesson') || lower.includes('guardrail') || lower.includes('proof')) {
    tags.add('lessons');
  }
  if (lower.includes('local-first') || lower.includes('do not push') || lower.includes('do not deploy') || lower.includes('remote mutation') || lower.includes('no push') || lower.includes('no deploy')) {
    tags.add('local-first');
  }

  if (tags.size === 0) tags.add('general');
  return [...tags];
}

function tailLines(input, count = 14) {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return lines.slice(-count);
}

function runCommand(command, args, timeoutMs = 240000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      resolve({
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        durationMs,
        stdout,
        stderr,
      });
    });
  });
}

function passControl(control, detail, extra = {}) {
  return {
    ...control,
    status: 'pass',
    detail,
    evidence: Array.isArray(extra.evidence) ? extra.evidence : [],
    command: extra.command || null,
    durationMs: extra.durationMs || null,
    output: Array.isArray(extra.output) ? extra.output : [],
  };
}

function failControl(control, detail, extra = {}) {
  return {
    ...control,
    status: 'fail',
    detail,
    evidence: Array.isArray(extra.evidence) ? extra.evidence : [],
    command: extra.command || null,
    durationMs: extra.durationMs || null,
    output: Array.isArray(extra.output) ? extra.output : [],
  };
}

function warnControl(control, detail, extra = {}) {
  return {
    ...control,
    status: 'warn',
    detail,
    evidence: Array.isArray(extra.evidence) ? extra.evidence : [],
    command: extra.command || null,
    durationMs: extra.durationMs || null,
    output: Array.isArray(extra.output) ? extra.output : [],
  };
}

async function evaluateRequiredGovernanceFiles(control) {
  const missing = [];
  for (const relativePath of REQUIRED_GOVERNANCE_FILES) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(relativePath))) missing.push(relativePath);
  }

  if (missing.length > 0) {
    return failControl(control, `${missing.length} required governance file(s) missing.`, {
      evidence: missing.map((relativePath) => path.join(ROOT, relativePath)),
    });
  }

  return passControl(control, `${REQUIRED_GOVERNANCE_FILES.length} governance file(s) present.`, {
    evidence: REQUIRED_GOVERNANCE_FILES.map((relativePath) => path.join(ROOT, relativePath)),
  });
}

async function evaluateDoctrineMarkers(control) {
  const [agents, app] = await Promise.all([readText('AGENTS.md'), readText('app.js')]);
  const missing = [];

  if (!agents.includes('Core decides. Projections explain. Apps render.')) {
    missing.push('AGENTS.md doctrine marker');
  }
  if (!app.includes('Le Core décide. Les projections expliquent. Les apps affichent.')) {
    missing.push('app.js doctrine banner marker');
  }

  if (missing.length > 0) {
    return failControl(control, 'Doctrine marker missing in required source(s).', {
      evidence: missing,
      output: missing,
    });
  }

  return passControl(control, 'Doctrine marker present in governance + UI surfaces.', {
    evidence: [path.join(ROOT, 'AGENTS.md'), path.join(ROOT, 'app.js')],
  });
}

function splitLessonEntries(content) {
  const matches = [];
  const regex = /^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s+[^\n]+\n|\Z)/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push({ title: normalizeText(match[1]), body: match[2] || '' });
  }
  return matches;
}

async function evaluateLessonsStructure(control) {
  const content = await readText('tasks/lessons.md');
  const entries = splitLessonEntries(content).filter((entry) => /\d{4}-\d{2}-\d{2}/.test(entry.title));

  if (entries.length === 0) {
    return failControl(control, 'No dated lesson entry found in tasks/lessons.md.', {
      evidence: [path.join(ROOT, 'tasks/lessons.md')],
    });
  }

  const missingByEntry = [];

  for (const entry of entries) {
    const missingFields = REQUIRED_LESSON_FIELDS.filter((label) => !new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'm').test(entry.body));
    if (missingFields.length > 0) {
      missingByEntry.push({ title: entry.title, missingFields });
    }
  }

  if (missingByEntry.length > 0) {
    return failControl(control, `${missingByEntry.length} lesson entr(y/ies) missing required field(s).`, {
      evidence: [path.join(ROOT, 'tasks/lessons.md')],
      output: missingByEntry.map((entry) => `${entry.title}: ${entry.missingFields.join(', ')}`),
    });
  }

  return passControl(control, `${entries.length} lesson entr(y/ies) include all required governance fields.`, {
    evidence: [path.join(ROOT, 'tasks/lessons.md')],
  });
}

async function evaluateDecisionStackReferences(control) {
  const content = await readText('docs/atlas-decision-stack.md');
  const requiredMarkers = [
    '## Precedence order',
    '1. Runtime system/developer instructions injected by Codex.',
    '2. Global persistent instructions: `/Users/mohyi/.codex/AGENTS.md`.',
    '3. Repo-local instructions: `/Users/mohyi/atlas/AGENTS.md`.',
    '4. Repo-local anti-regression memory: `/Users/mohyi/atlas/tasks/lessons.md`.',
    '## Mandatory architecture gate'
  ];

  const missing = requiredMarkers.filter((marker) => !content.includes(marker));

  if (missing.length > 0) {
    return failControl(control, 'Atlas decision stack is missing required precedence/gate marker(s).', {
      evidence: [path.join(ROOT, 'docs/atlas-decision-stack.md')],
      output: missing,
    });
  }

  return passControl(control, 'Atlas decision stack precedence and architecture gate markers present.', {
    evidence: [path.join(ROOT, 'docs/atlas-decision-stack.md')],
  });
}

async function evaluatePackageQualityScripts(control) {
  const pkg = await readJson('package.json');
  const scripts = pkg?.scripts || {};
  const requiredScripts = [
    'lint',
    'typecheck',
    'test:unit',
    'test:contracts',
    'test:smoke',
    'test:e2e',
    'check',
    'generate:discipline',
    'audit:discipline'
  ];

  const missing = requiredScripts.filter((name) => !scripts[name]);

  if (missing.length > 0) {
    return failControl(control, 'package.json is missing required quality/discipline scripts.', {
      evidence: [path.join(ROOT, 'package.json')],
      output: missing,
    });
  }

  return passControl(control, `${requiredScripts.length} quality/discipline script(s) declared in package.json.`, {
    evidence: [path.join(ROOT, 'package.json')],
  });
}

async function evaluateServiceOpsGuardrails(control) {
  try {
    const report = await readJson('data/architecture-service-ops-live-report.json');
    assertServiceOpsGuardrails(report);
    return passControl(control, 'Service-ops summary, coverage and decision KPI contract are coherent.', {
      evidence: [path.join(ROOT, 'data/architecture-service-ops-live-report.json')],
    });
  } catch (error) {
    return failControl(control, `Service-ops guardrail failed: ${String(error?.message || error)}`, {
      evidence: [path.join(ROOT, 'data/architecture-service-ops-live-report.json')],
    });
  }
}

async function evaluateLocalFirstPolicy(control) {
  const scriptFiles = await collectFilesRecursively('scripts');
  const scanTargets = [
    'AGENTS.md',
    'package.json',
    'run-atlas-fusion.sh',
    ...scriptFiles.filter((file) => /\.(mjs|js|sh|json)$/i.test(file))
  ];

  const riskyPatterns = [
    { id: 'git-push', regex: /\bgit\s+push\b/i },
    { id: 'wrangler-deploy', regex: /\bwrangler\s+deploy\b/i },
    { id: 'vercel-deploy', regex: /\bvercel\b.*\b(deploy|--prod)\b/i },
    { id: 'render-deploy', regex: /\brender\b.*\bdeploy\b/i },
    { id: 'firebase-deploy', regex: /\bfirebase\s+deploy\b/i },
    { id: 'kubectl-apply', regex: /\bkubectl\s+(apply|patch|replace|delete)\b/i },
    { id: 'terraform-apply', regex: /\bterraform\s+apply\b/i },
    { id: 'gcloud-deploy', regex: /\bgcloud\b.*\bdeploy\b/i },
  ];

  const hits = [];
  const scanned = [];

  for (const relativePath of scanTargets) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await pathExists(relativePath);
    if (!exists) continue;

    // eslint-disable-next-line no-await-in-loop
    const content = await readText(relativePath);
    scanned.push(path.join(ROOT, relativePath));
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.includes('regex:')) continue;
      for (const pattern of riskyPatterns) {
        if (pattern.regex.test(line)) {
          hits.push(`${relativePath}:${index + 1} [${pattern.id}] ${line.trim()}`);
        }
      }
    }
  }

  if (hits.length > 0) {
    return failControl(control, 'Potential remote mutation command(s) detected in repo scripts/config.', {
      evidence: scanned.slice(0, 20),
      output: hits.slice(0, 20),
    });
  }

  return passControl(control, `Static local-first guardrail passed (${scanned.length} file(s) scanned, no risky remote mutation command found).`, {
    evidence: scanned.slice(0, 20),
  });
}

async function evaluateCommandControl(control) {
  const result = await runCommand(control.commandBin, control.commandArgs, control.timeoutMs || 240000);
  const command = `${control.commandBin} ${control.commandArgs.join(' ')}`;

  if (!result.ok) {
    return failControl(control, `Command failed (${result.code}${result.timedOut ? ', timeout' : ''}).`, {
      evidence: control.evidence || [],
      command,
      durationMs: result.durationMs,
      output: [...tailLines(result.stdout), ...tailLines(result.stderr)],
    });
  }

  return passControl(control, 'Command passed.', {
    evidence: control.evidence || [],
    command,
    durationMs: result.durationMs,
    output: tailLines(result.stdout),
  });
}

function controlDefinitions() {
  return [
    {
      id: 'governance.files',
      name: 'Governance files present',
      category: 'structure',
      tags: ['architecture', 'contracts', 'linear', 'quality', 'lessons', 'doctrine'],
      automated: true,
      run: evaluateRequiredGovernanceFiles,
    },
    {
      id: 'doctrine.marker',
      name: 'Doctrine markers aligned',
      category: 'architecture',
      tags: ['doctrine', 'architecture'],
      automated: true,
      run: evaluateDoctrineMarkers,
    },
    {
      id: 'lessons.integrity',
      name: 'Lessons entries keep required fields',
      category: 'governance',
      tags: ['lessons'],
      automated: true,
      run: evaluateLessonsStructure,
    },
    {
      id: 'decision-stack.precedence',
      name: 'Decision stack precedence kept',
      category: 'governance',
      tags: ['linear', 'architecture'],
      automated: true,
      run: evaluateDecisionStackReferences,
    },
    {
      id: 'package.quality-scripts',
      name: 'Quality and discipline scripts declared',
      category: 'quality',
      tags: ['quality'],
      automated: true,
      run: evaluatePackageQualityScripts,
    },
    {
      id: 'service-ops.guardrails',
      name: 'Service-ops semantic guardrails',
      category: 'contracts',
      tags: ['architecture', 'contracts', 'quality'],
      automated: true,
      run: evaluateServiceOpsGuardrails,
    },
    {
      id: 'policy.local-first',
      name: 'Local-first / no remote mutation policy',
      category: 'policy',
      tags: ['local-first'],
      automated: false,
      run: evaluateLocalFirstPolicy,
    },
    {
      id: 'gate.lint-atlas',
      name: 'Lint governance gate',
      category: 'quality-gate',
      tags: ['quality', 'contracts', 'architecture'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['scripts/lint-atlas.mjs'],
      evidence: [path.join(ROOT, 'scripts/lint-atlas.mjs')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.lint-canonical',
      name: 'Canonical guardrail lint gate',
      category: 'quality-gate',
      tags: ['quality', 'architecture', 'doctrine'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['scripts/lint-canonical-guardrails.mjs'],
      evidence: [path.join(ROOT, 'scripts/lint-canonical-guardrails.mjs')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.typecheck',
      name: 'Typecheck gate',
      category: 'quality-gate',
      tags: ['quality'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['scripts/typecheck-atlas.mjs'],
      evidence: [path.join(ROOT, 'scripts/typecheck-atlas.mjs')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.unit',
      name: 'Unit tests gate',
      category: 'quality-gate',
      tags: ['quality'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['--test', 'tests/unit/*.test.mjs'],
      evidence: [path.join(ROOT, 'tests/unit')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.contract-validate',
      name: 'Contract validation gate',
      category: 'quality-gate',
      tags: ['contracts', 'quality'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['scripts/validate-atlas-contracts.mjs'],
      evidence: [path.join(ROOT, 'scripts/validate-atlas-contracts.mjs')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.contract-tests',
      name: 'Contract tests gate',
      category: 'quality-gate',
      tags: ['contracts', 'quality'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['--test', 'tests/contracts/*.test.mjs'],
      evidence: [path.join(ROOT, 'tests/contracts')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.smoke',
      name: 'Smoke gate',
      category: 'quality-gate',
      tags: ['quality', 'architecture', 'freshness', 'alerts'],
      automated: true,
      commandBin: 'node',
      commandArgs: ['scripts/smoke-atlas.mjs'],
      evidence: [path.join(ROOT, 'scripts/smoke-atlas.mjs')],
      run: evaluateCommandControl,
    },
    {
      id: 'gate.e2e',
      name: 'E2E gate',
      category: 'quality-gate',
      tags: ['quality', 'architecture'],
      automated: true,
      fullOnly: true,
      timeoutMs: 420000,
      commandBin: 'node',
      commandArgs: ['--test', 'tests/e2e/*.test.mjs'],
      evidence: [path.join(ROOT, 'tests/e2e')],
      run: evaluateCommandControl,
    },
  ];
}

function mapRulesToControls(rules, controlsById) {
  return rules.map((rule) => {
    const controlScores = [];
    for (const control of controlsById.values()) {
      const overlap = control.tags.filter((tag) => rule.tags.includes(tag));
      if (overlap.length === 0) continue;
      controlScores.push({ controlId: control.id, score: overlap.length });
    }

    controlScores.sort((a, b) => b.score - a.score || a.controlId.localeCompare(b.controlId));
    const linkedControlIds = controlScores.slice(0, 4).map((row) => row.controlId);

    if (rule.tags.includes('local-first') && controlsById.has('policy.local-first') && !linkedControlIds.includes('policy.local-first')) {
      linkedControlIds.unshift('policy.local-first');
    }

    if (rule.tags.includes('lessons') && controlsById.has('lessons.integrity') && !linkedControlIds.includes('lessons.integrity')) {
      linkedControlIds.unshift('lessons.integrity');
    }

    return {
      ...rule,
      controlIds: linkedControlIds.slice(0, 5),
    };
  });
}

function evaluateRuleStatus(rule, controlResultsById) {
  if (!Array.isArray(rule.controlIds) || rule.controlIds.length === 0) {
    return {
      status: 'manual',
      reason: 'No automated control mapped to this rule.',
      failingControlIds: [],
      warningControlIds: [],
    };
  }

  const statuses = rule.controlIds
    .map((controlId) => controlResultsById.get(controlId))
    .filter(Boolean);

  const failing = statuses.filter((row) => row.status === 'fail').map((row) => row.id);
  const warning = statuses.filter((row) => row.status === 'warn').map((row) => row.id);

  if (failing.length > 0) {
    return {
      status: 'fail',
      reason: `${failing.length} mapped control(s) failed.`,
      failingControlIds: failing,
      warningControlIds: warning,
    };
  }

  if (warning.length > 0) {
    return {
      status: 'warn',
      reason: `${warning.length} mapped control(s) need manual/process verification.`,
      failingControlIds: [],
      warningControlIds: warning,
    };
  }

  return {
    status: 'pass',
    reason: 'Mapped controls passed.',
    failingControlIds: [],
    warningControlIds: [],
  };
}

async function collectRules() {
  const allRules = [];
  const sourceSummary = [];

  for (const sourcePath of SOURCE_FILES) {
    // eslint-disable-next-line no-await-in-loop
    const content = await readText(sourcePath);
    const extracted = extractRulesFromMarkdown(sourcePath, content).map((rule) => ({
      ...rule,
      tags: inferTags(rule),
    }));
    allRules.push(...extracted);
    sourceSummary.push({ sourceFile: sourcePath, ruleCount: extracted.length });
  }

  return { allRules, sourceSummary };
}

function summarizeControls(controlResults) {
  const summary = {
    total: controlResults.length,
    pass: 0,
    fail: 0,
    warn: 0,
  };

  for (const control of controlResults) {
    if (control.status === 'pass') summary.pass += 1;
    else if (control.status === 'fail') summary.fail += 1;
    else if (control.status === 'warn') summary.warn += 1;
  }

  return summary;
}

function summarizeRules(ruleResults) {
  const summary = {
    total: ruleResults.length,
    pass: 0,
    fail: 0,
    warn: 0,
    manual: 0,
  };

  for (const rule of ruleResults) {
    if (rule.status === 'pass') summary.pass += 1;
    else if (rule.status === 'fail') summary.fail += 1;
    else if (rule.status === 'warn') summary.warn += 1;
    else if (rule.status === 'manual') summary.manual += 1;
  }

  return summary;
}

function summarizeSourceCoverage(sourceSummary) {
  const ruleSources = sourceSummary
    .map((row) => String(row.sourceFile || '').trim())
    .filter(Boolean);
  const controlSources = [...new Set(REQUIRED_GOVERNANCE_FILES)];

  const ruleSet = new Set(ruleSources);
  const controlSet = new Set(controlSources);

  const overlapSources = controlSources.filter((source) => ruleSet.has(source));
  const ruleOnlySources = ruleSources.filter((source) => !controlSet.has(source));
  const controlOnlySources = controlSources.filter((source) => !ruleSet.has(source));

  return {
    ruleSources,
    controlSources,
    overlapSources,
    ruleOnlySources,
    controlOnlySources,
    counts: {
      ruleSources: ruleSources.length,
      controlSources: controlSources.length,
      overlap: overlapSources.length,
      ruleOnly: ruleOnlySources.length,
      controlOnly: controlOnlySources.length,
    },
  };
}

function summarizeRepoGovernance(rows) {
  const summary = {
    total: rows.length,
    pass: 0,
    warn: 0,
    fail: 0,
    missingFilesCount: 0,
    markerGapCount: 0,
  };

  for (const row of rows) {
    if (row.status === 'pass') summary.pass += 1;
    else if (row.status === 'warn') summary.warn += 1;
    else if (row.status === 'fail') summary.fail += 1;
    summary.missingFilesCount += Number(row.missingFiles?.length || 0);
    summary.markerGapCount += Number(row.markerGaps?.length || 0);
  }

  return summary;
}

function parseRepoNameFromPath(repoPath, fallbackName = 'unknown') {
  const normalized = String(repoPath || '').trim();
  if (!normalized) return String(fallbackName || 'unknown');
  const base = path.basename(normalized);
  if (!base) return String(fallbackName || 'unknown');
  return base.toUpperCase();
}

async function collectRepoGovernance() {
  let atlasData;
  try {
    atlasData = await readJson('data/atlas-data.json');
  } catch {
    return {
      source: path.join(ROOT, 'data/atlas-data.json'),
      available: false,
      summary: {
        total: 0,
        pass: 0,
        warn: 0,
        fail: 0,
        missingFilesCount: 0,
        markerGapCount: 0,
      },
      repos: [],
    };
  }

  const repos = Array.isArray(atlasData?.repos) ? atlasData.repos : [];
  const rows = [];

  for (const repo of repos) {
    const repoPath = String(repo?.path || '').trim();
    const repoName = String(repo?.name || parseRepoNameFromPath(repoPath, 'unknown')).trim();
    const absoluteRepoPath = repoPath;
    const agentsPath = absoluteRepoPath ? path.join(absoluteRepoPath, 'AGENTS.md') : '';
    const lessonsPath = absoluteRepoPath ? path.join(absoluteRepoPath, 'tasks/lessons.md') : '';

    // eslint-disable-next-line no-await-in-loop
    const repoExists = absoluteRepoPath ? await pathExistsAbsolute(absoluteRepoPath) : false;
    // eslint-disable-next-line no-await-in-loop
    const agentsExists = agentsPath ? await pathExistsAbsolute(agentsPath) : false;
    // eslint-disable-next-line no-await-in-loop
    const lessonsExists = lessonsPath ? await pathExistsAbsolute(lessonsPath) : false;

    let agentsContent = '';
    if (agentsExists) {
      try {
        // eslint-disable-next-line no-await-in-loop
        agentsContent = await fs.readFile(agentsPath, 'utf8');
      } catch {
        agentsContent = '';
      }
    }

    const decisionStackMarker = /decision stack|decision sources/i.test(agentsContent);
    const linearMarker = /linear/i.test(agentsContent);
    const doctrineMarker = /core decides\.\s*projections explain\.\s*apps render\./i.test(agentsContent);
    const localFirstMarker = /local-first/i.test(agentsContent);

    const missingFiles = [];
    if (!repoExists) missingFiles.push('repo-path');
    if (!agentsExists) missingFiles.push('AGENTS.md');
    if (!lessonsExists) missingFiles.push('tasks/lessons.md');

    const markerGaps = [];
    if (!decisionStackMarker) markerGaps.push('decision-stack');
    if (!linearMarker) markerGaps.push('linear');
    if (!doctrineMarker) markerGaps.push('doctrine');
    if (!localFirstMarker) markerGaps.push('local-first');

    let status = 'pass';
    if (missingFiles.length > 0) status = 'fail';
    else if (markerGaps.length > 0) status = 'warn';

    let statusReason = 'Governance baseline complete for this repo.';
    if (status === 'fail') statusReason = `Missing required governance files: ${missingFiles.join(', ')}.`;
    else if (status === 'warn') statusReason = `Governance markers to align in AGENTS.md: ${markerGaps.join(', ')}.`;

    rows.push({
      repo: repoName,
      path: absoluteRepoPath,
      status,
      statusReason,
      files: {
        repoPathExists: repoExists,
        agents: agentsExists,
        lessons: lessonsExists,
      },
      markers: {
        decisionStack: decisionStackMarker,
        linear: linearMarker,
        doctrine: doctrineMarker,
        localFirst: localFirstMarker,
      },
      missingFiles,
      markerGaps,
      evidence: [agentsPath, lessonsPath].filter(Boolean),
      runtime: {
        validationCommands: Array.isArray(repo?.validation) ? repo.validation.length : 0,
        tests: Array.isArray(repo?.tests) ? repo.tests.length : 0,
        routes: Array.isArray(repo?.routes) ? repo.routes.length : 0,
        risks: Array.isArray(repo?.risks) ? repo.risks.length : 0,
      },
    });
  }

  return {
    source: path.join(ROOT, 'data/atlas-data.json'),
    available: true,
    summary: summarizeRepoGovernance(rows),
    repos: rows,
  };
}

async function main() {
  const controls = controlDefinitions().filter((control) => FULL_MODE || !control.fullOnly);
  const controlResults = [];

  for (const control of controls) {
    // eslint-disable-next-line no-await-in-loop
    const result = await control.run(control);
    controlResults.push(result);
  }

  const controlResultsById = new Map(controlResults.map((control) => [control.id, control]));
  const controlsById = new Map(controls.map((control) => [control.id, control]));

  const { allRules, sourceSummary } = await collectRules();
  const repoGovernance = await collectRepoGovernance();
  const linkedRules = mapRulesToControls(allRules, controlsById);

  const ruleResults = linkedRules.map((rule) => {
    const evaluation = evaluateRuleStatus(rule, controlResultsById);
    return {
      ...rule,
      status: evaluation.status,
      statusReason: evaluation.reason,
      failingControlIds: evaluation.failingControlIds,
      warningControlIds: evaluation.warningControlIds,
    };
  });

  const deviations = ruleResults
    .filter((rule) => rule.status === 'fail' || rule.status === 'warn' || rule.status === 'manual')
    .map((rule) => {
      const linkedControls = (rule.controlIds || [])
        .map((controlId) => controlResultsById.get(controlId))
        .filter(Boolean)
        .map((control) => ({
          id: control.id,
          name: control.name,
          status: control.status,
          detail: control.detail,
          evidence: control.evidence,
          command: control.command,
        }));

      return {
        ruleId: rule.id,
        sourceFile: rule.sourceFile,
        sourceAbsolutePath: rule.sourceAbsolutePath,
        sourceLine: rule.sourceLine,
        section: rule.section,
        text: rule.text,
        status: rule.status,
        statusReason: rule.statusReason,
        linkedControls,
      };
    });

  const controlSummary = summarizeControls(controlResults);
  const ruleSummary = summarizeRules(ruleResults);
  const sourceCoverage = summarizeSourceCoverage(sourceSummary);

  const payload = {
    generatedAt: nowIso(),
    mode: FULL_MODE ? 'full' : 'quick',
    sourceFiles: SOURCE_FILES.map((relativePath) => ({
      path: relativePath,
      absolutePath: path.join(ROOT, relativePath),
    })),
    sourceSummary,
    sourceCoverage,
    repoGovernance,
    summary: {
      controls: controlSummary,
      rules: ruleSummary,
      deviationCount: deviations.length,
    },
    controls: controlResults,
    rules: ruleResults,
    deviations,
  };

  const outputAbsolutePath = path.join(ROOT, OUTPUT_PATH);
  await fs.mkdir(path.dirname(outputAbsolutePath), { recursive: true });
  await fs.writeFile(outputAbsolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const failCount = controlSummary.fail + ruleSummary.fail;
  const warnCount = controlSummary.warn + ruleSummary.warn + ruleSummary.manual;

  console.log(`Discipline report generated (${payload.mode}) -> ${OUTPUT_PATH}`);
  console.log(`Controls: ${controlSummary.pass} pass / ${controlSummary.fail} fail / ${controlSummary.warn} warn`);
  console.log(`Rules: ${ruleSummary.pass} pass / ${ruleSummary.fail} fail / ${ruleSummary.warn} warn / ${ruleSummary.manual} manual`);
  console.log(`Deviations listed: ${deviations.length}`);
  console.log(`Warnings/manual noted: ${warnCount}`);

  if (FULL_MODE && failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to generate discipline report:', error?.message || error);
  process.exit(1);
});
