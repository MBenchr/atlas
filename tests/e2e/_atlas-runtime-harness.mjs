import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createClassListStub() {
  return {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false;
    },
  };
}

function createElementStub(id = '') {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    title: '',
    disabled: false,
    style: {},
    dataset: {},
    classList: createClassListStub(),
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    getBoundingClientRect() {
      return { width: 1200, height: 780 };
    },
  };
}

function createDocumentStub() {
  const map = new Map();
  return {
    body: { classList: createClassListStub() },
    getElementById(id) {
      if (!map.has(id)) map.set(id, createElementStub(id));
      return map.get(id);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    __nodes: map,
  };
}

export async function loadAtlasRuntime() {
  const filePath = path.join(ROOT, 'app.js');
  const source = await fs.readFile(filePath, 'utf8');

  const withoutBootstrap = source.replace(/\nbootstrap\(\);\s*$/m, '\n');
  const expose = `\n\nglobalThis.__atlasTestExports = {\n  state,\n  createDecisionKpiSession,\n  renderOverview,\n  renderExecutiveBoard,\n  renderTopActionsNow,\n  renderDecisionKpiDashboard,\n  renderArchitectureAlerts,\n  renderDomainMaster,\n  renderPortfolioView,\n  renderEvidenceAudit,\n  renderMigrationBanner,\n  buildArchitectureAlerts,\n  buildPortfolioRows,\n  buildVisibleViews,\n  setInvestigationContext,\n  setEvidenceContext,\n  render\n};\n`;

  const documentStub = createDocumentStub();
  const localStore = new Map();

  const sandbox = {
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    encodeURIComponent,
    decodeURIComponent,
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    document: documentStub,
    window: {
      location: { search: '' },
      addEventListener() {},
      removeEventListener() {},
      localStorage: {
        getItem(key) {
          return localStore.has(key) ? localStore.get(key) : null;
        },
        setItem(key, value) {
          localStore.set(key, String(value));
        },
        removeItem(key) {
          localStore.delete(key);
        },
      },
    },
  };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const script = new vm.Script(withoutBootstrap + expose, { filename: 'app.js' });
  script.runInContext(sandbox);

  const runtime = sandbox.__atlasTestExports;
  if (!runtime || !runtime.state) {
    throw new Error('Unable to load Atlas runtime exports for tests.');
  }
  return runtime;
}

export function applyFixture(runtime, fixture) {
  const { state } = runtime;
  state.data = clone(fixture.data);
  state.architectureScore = clone(fixture.architectureScore);
  state.driftReport = clone(fixture.driftReport);
  state.timeMachine = { snapshots: [] };
  state.history = clone(fixture.history);
  state.freshnessContract = clone(fixture.data.freshnessContract);
  state.previousSnapshot = clone(fixture.previousSnapshot);
  state.auditIndex = clone(fixture.auditIndex);
  state.serviceOpsReport = clone(fixture.serviceOpsReport);
  state.decisionKpiContract = clone(fixture.serviceOpsReport.decisionKpis);
  state.decisionKpiSession = null;
  state.decisionKpiHistory = [];

  state.activeView = 'overview';
  state.graphFilter = new Set(['repo', 'domain', 'projection', 'provider']);
  state.graphZoom = 1;
  state.alertSeverityFilter = 'all';
  state.alertDomainFilter = 'all';
  state.alertOwnerFilter = 'all';
  state.alertTypeFilter = 'all';
  state.alertStateFilter = 'all';
  state.alertStateOverrides = {};
  state.activeAlertProofId = null;
  state.domainMasterFilter = 'all';
  state.activeDomainProofDomain = null;
  state.portfolioQuadrantFilter = 'all';
  state.investigationContext = null;
  state.evidenceContext = null;
  state.evidenceSearch = '';
  state.evidenceTypeFilter = 'all';
  state.evidenceDomainFilter = 'all';
  state.evidenceSourceFilter = 'all';
  state.activeEvidenceId = null;
  state.helpMode = false;
  state.refreshInFlight = false;
  state.trendWindow = '14';
  state.trendSelection = {};
}

export function extractAlertCardDomains(html) {
  const domains = [];
  const regex = /<div class="alert-queue-head">\s*<strong>([^<]+) · [^<]+<\/strong>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    domains.push(String(match[1]).trim().toLowerCase());
  }
  return domains;
}

export function countMatches(html, pattern) {
  const matches = html.match(pattern);
  return matches ? matches.length : 0;
}

export function buildVisualSignature(html) {
  const headingRegex = /<h3>(?:<[^>]+>)*\s*([^<]+?)\s*(?:<[^>]+>)*<\/h3>/g;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push(match[1].trim());
  }

  return {
    length: html.length,
    cards: countMatches(html, /class="card/g),
    tables: countMatches(html, /<table/g),
    badges: countMatches(html, /class="badge/g),
    buttons: countMatches(html, /<button/g),
    headings,
  };
}
