const VIEWS = [
  { id: "overview", label: "Vue d'ensemble", icon: "overview", group: "pilotage", hint: "Décision rapide" },
  { id: "alerts", label: "Alertes", icon: "risk", group: "pilotage", hint: "Urgences architecture" },
  { id: "portfolio", label: "Portfolio", icon: "flow", group: "pilotage", hint: "Arbitrage manager" },
  { id: "history", label: "Historique", icon: "history", group: "pilotage", hint: "Évolution temporelle" },
  { id: "domains", label: "Domaines", icon: "domain", group: "architecture", hint: "Ownership et discipline" },
  { id: "projections", label: "Projections", icon: "projection", group: "architecture", hint: "Read-path canonique" },
  { id: "evidence", label: "Preuves", icon: "validation", group: "trajectoire", hint: "Audit et exports" },
  { id: "roadmap", label: "Trajectoire", icon: "roadmap", group: "trajectoire", hint: "Plan d'exécution" },
];

const VIEW_GROUPS = [
  { id: "pilotage", label: "Pilotage" },
  { id: "architecture", label: "Architecture" },
  { id: "trajectoire", label: "Trajectoire" },
];

const ROLLOUT_FLAG_DEFAULTS = {
  cockpitV3Enabled: true,
  legacyTabBridgeEnabled: true,
  evidenceSpaceEnabled: true,
  secondaryInvestigationEnabled: true,
  decisionKpiEnabled: true,
};

const LEGACY_BRIDGE_VIEW_IDS = ["overview", "domains", "history", "roadmap"];

const LEGACY_TAB_MAPPING = [
  { legacyTab: "home", v3Layer: "overview", rationale: "Cockpit décisionnel P0 (actions + contexte)." },
  { legacyTab: "alerts-table", v3Layer: "alerts", rationale: "Queue opérationnelle actionnable." },
  { legacyTab: "portfolio", v3Layer: "portfolio", rationale: "Arbitrage manager/architecte." },
  { legacyTab: "domains", v3Layer: "domains", rationale: "Fiche domaine maître (owner + plan + preuves)." },
  { legacyTab: "graph", v3Layer: "domains -> enquête graphe", rationale: "Diagnostic L3 contextuel, plus en navigation primaire." },
  { legacyTab: "radar", v3Layer: "domains -> radar", rationale: "Diagnostic L3 contextuel, activé via drill-down." },
  { legacyTab: "history", v3Layer: "history", rationale: "Trajectoire temporelle 7/30/90 et diff snapshots." },
  { legacyTab: "proofs", v3Layer: "evidence", rationale: "Preuves/audit séparés du flux décisionnel." },
  { legacyTab: "roadmap", v3Layer: "roadmap", rationale: "Plan d'exécution et readiness." },
];

const BADGE_LABELS = {
  contractsFirst: "Contrats d'abord",
  canonicalWritePath: "Write-path canonique",
  projectionCanonical: "Projection canonique",
  noDuplicatedBusinessLogic: "Pas de logique métier dupliquée",
  otelReady: "Prêt OTel",
  pkceReady: "Prêt PKCE",
  e2eProof: "Preuve E2E",
  moduleReady: "Prêt modules",
};

const NODE_META = {
  repo: { marker: "R", color: "#5ec8ff", icon: "repo" },
  domain: { marker: "D", color: "#6ce6ad", icon: "domain" },
  projection: { marker: "P", color: "#ffc36a", icon: "projection" },
  provider: { marker: "E", color: "#f88377", icon: "external" },
};

const state = {
  data: null,
  architectureScore: null,
  driftReport: null,
  timeMachine: null,
  history: null,
  freshnessContract: null,
  previousSnapshot: null,
  auditIndex: null,
  serviceOpsReport: null,
  rolloutFlags: null,
  decisionKpiContract: null,
  decisionKpiSession: null,
  decisionKpiHistory: [],
  activeView: "overview",
  graphFilter: new Set(["repo", "domain", "projection", "provider"]),
  graphZoom: 1,
  alertSeverityFilter: "all",
  alertDomainFilter: "all",
  alertOwnerFilter: "all",
  alertTypeFilter: "all",
  alertStateFilter: "all",
  alertStateOverrides: {},
  activeAlertProofId: null,
  domainMasterFilter: "all",
  activeDomainProofDomain: null,
  portfolioQuadrantFilter: "all",
  investigationContext: null,
  evidenceContext: null,
  evidenceSearch: "",
  evidenceTypeFilter: "all",
  evidenceDomainFilter: "all",
  evidenceSourceFilter: "all",
  activeEvidenceId: null,
  detailListenerBound: false,
  decisionKpiListenerBound: false,
  decisionKpiLifecycleBound: false,
  helpMode: false,
  refreshInFlight: false,
  trendWindow: "14",
  trendSelection: {},
};

const DECISION_KPI_STORAGE_KEY = "atlas.decision-kpi.v1";

const DEFAULT_DECISION_KPI_CONTRACT = {
  version: "v1",
  targets: {
    timeToFirstPrioritySec: 30,
    timeToRationaleSec: 60,
    clicksToOwnerAction: 2,
    drilldownRateMin: 0.25,
  },
  baselineBeforeRefactor: {
    sampleSize: 18,
    timeToFirstPrioritySec: 86.4,
    timeToRationaleSec: 142.6,
    clicksToOwnerAction: 5.8,
    drilldownRate: 0.18,
  },
  postRefactorBaseline: {
    sampleSize: 20,
    timeToFirstPrioritySec: 34.1,
    timeToRationaleSec: 63.8,
    clicksToOwnerAction: 2.4,
    drilldownRate: 0.29,
  },
};

const runtime = (() => {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || params.get("embed") === "true";
  return {
    params,
    embedded,
    fusion: params.get("fusion") === "1" || params.get("fusion") === "true",
  };
})();

if (runtime.embedded) {
  document.body.classList.add("embed-mode");
}

let externalControlBound = false;

function parseRolloutBoolean(rawValue) {
  if (typeof rawValue !== "string") return null;
  const value = rawValue.trim().toLowerCase();
  if (!value) return null;
  if (["1", "true", "on", "yes", "enabled"].includes(value)) return true;
  if (["0", "false", "off", "no", "disabled"].includes(value)) return false;
  return null;
}

function readRolloutFlag(flagName, fallback) {
  const queryKey = `ff_${flagName}`;
  const storageKey = `atlas.rollout.${flagName}`;

  const queryRaw = runtime?.params?.get(queryKey);
  const queryParsed = parseRolloutBoolean(queryRaw);
  if (typeof queryParsed === "boolean") return queryParsed;

  try {
    const storageRaw = window.localStorage.getItem(storageKey);
    const storageParsed = parseRolloutBoolean(storageRaw);
    if (typeof storageParsed === "boolean") return storageParsed;
  } catch {
    // ignore localStorage access errors
  }

  return Boolean(fallback);
}

function resolveRolloutFlags() {
  return {
    cockpitV3Enabled: readRolloutFlag("cockpit_v3", ROLLOUT_FLAG_DEFAULTS.cockpitV3Enabled),
    legacyTabBridgeEnabled: readRolloutFlag("legacy_bridge", ROLLOUT_FLAG_DEFAULTS.legacyTabBridgeEnabled),
    evidenceSpaceEnabled: readRolloutFlag("evidence", ROLLOUT_FLAG_DEFAULTS.evidenceSpaceEnabled),
    secondaryInvestigationEnabled: readRolloutFlag("investigation", ROLLOUT_FLAG_DEFAULTS.secondaryInvestigationEnabled),
    decisionKpiEnabled: readRolloutFlag("decision_kpi", ROLLOUT_FLAG_DEFAULTS.decisionKpiEnabled),
  };
}

function getRolloutFlags() {
  if (!state.rolloutFlags) state.rolloutFlags = resolveRolloutFlags();
  return state.rolloutFlags;
}

function isFeatureEnabled(flagName) {
  const flags = getRolloutFlags();
  return Boolean(flags?.[flagName]);
}

function buildVisibleViews(flags = getRolloutFlags()) {
  const flagValues = flags || ROLLOUT_FLAG_DEFAULTS;
  if (!flagValues.cockpitV3Enabled) {
    return VIEWS.filter((view) => LEGACY_BRIDGE_VIEW_IDS.includes(view.id));
  }

  return VIEWS.filter((view) => {
    if (view.id === "evidence" && !flagValues.evidenceSpaceEnabled) return false;
    return true;
  });
}

function resolveVisibleFallbackView(preferredView = "overview", flags = getRolloutFlags()) {
  const visibleViews = buildVisibleViews(flags);
  if (visibleViews.find((view) => view.id === preferredView)) return preferredView;
  return visibleViews[0]?.id || "overview";
}

function switchViewSafely(nextView, fallbackView = "overview") {
  state.activeView = resolveVisibleFallbackView(nextView, getRolloutFlags());
  if (state.activeView !== nextView && fallbackView) {
    state.activeView = resolveVisibleFallbackView(fallbackView, getRolloutFlags());
  }
}

const VIEW_EXPLANATIONS = {
  overview: {
    title: "Ce que montre cette vue",
    summary: "Synthèse exécutive de la santé architecture V3: volume, discipline et risques prioritaires.",
    bullets: [
      "KPIs: taille du système, couverture de tests, dette ouverte.",
      "Scorecards domaines: lisibilité immédiate de l'état par domaine.",
      "Alertes critiques: ce qui menace la stabilité et l'évolutivité.",
    ],
  },
  graph: {
    title: "Ce que montre cette vue",
    summary: "Cartographie des dépendances entre dépôts, domaines, projections et fournisseurs externes.",
    bullets: [
      "Filtres: isolez les couches pour éviter les fausses corrélations.",
      "Nœuds et liens: visualisez les couplages et les zones de concentration.",
      "Zoom: inspectez précisément les relations à risque.",
    ],
  },
  radar: {
    title: "Ce que montre cette vue",
    summary: "Lecture rapide multi-axes de chaque domaine pour détecter les faiblesses structurelles.",
    bullets: [
      "Axes: architecture, discipline projection, validation, extraction.",
      "Couleurs et valeurs: repérez les domaines à traiter en priorité.",
      "Lecture transversale: identifiez les écarts entre domaines.",
    ],
  },
  projections: {
    title: "Ce que montre cette vue",
    summary: "Registre canonique des projections et de leurs consommateurs.",
    bullets: [
      "Projection canonique: une seule source de lecture partagée.",
      "Statut: canonique, dupliquée ou manquante.",
      "Responsable explicite: indispensable pour éviter la dérive.",
    ],
  },
  domains: {
    title: "Ce que montre cette vue",
    summary: "Composition métier par domaine: responsabilité, flux d'écriture et discipline de lecture.",
    bullets: [
      "Responsabilité domaine: qui décide et qui consomme.",
      "Write-path: validation du chemin d'écriture officiel.",
      "Signaux de dérive: contournement ou duplication métier.",
    ],
  },
  alerts: {
    title: "Ce que montre cette vue",
    summary: "Regroupe les signaux actionnables pour piloter les corrections architecture.",
    bullets: [
      "Alertes d'architecture: violations doctrine et couplage.",
      "Hotspots: fichiers volumineux à découper en priorité.",
      "Sécurité/validation: signaux d'exécution et preuves techniques.",
    ],
  },
  portfolio: {
    title: "Ce que montre cette vue",
    summary: "Arbitrage portefeuille: priorités domaines, signaux croisés, trajectoires et références de stabilité.",
    bullets: [
      "Tableau trié: ordre d'action par score décisionnel canonique.",
      "Heatmap signaux: risque, dérive, discipline et tendance.",
      "Scatter + sparklines: décider stabiliser/extract en quelques minutes.",
    ],
  },
  history: {
    title: "Ce que montre cette vue",
    summary: "Évolution dans le temps entre snapshot courant et précédent.",
    bullets: [
      "Timeline N, N-1...: tendance dette et complexité.",
      "Diff domaines: variation des scores de santé.",
      "Diff dépôt: variation LOC, routes et tests.",
    ],
  },
  evidence: {
    title: "Ce que montre cette vue",
    summary: "Espace Preuves/Audit séparé pour consulter les artefacts bruts sans bruit dans les vues de décision.",
    bullets: [
      "Checks détaillés: fraîcheur, taxonomie, couverture snapshots/projections.",
      "Inventaire exhaustif: artefacts filtrables et exportables en JSON.",
      "Drill-down contextuel: ouverture depuis alertes/domaines vers preuve pertinente.",
    ],
  },
  roadmap: {
    title: "Ce que montre cette vue",
    summary: "Trajectoire d'extraction V3 et écarts restants vers la cible.",
    bullets: [
      "Étapes: ordre recommandé d'exécution.",
      "Niveau de préparation: état réel avant exécution.",
      "Écarts: blocages qui empêchent l'architecture cible.",
    ],
  },
};

function badgeClass(status) {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  return "fail";
}

function badgeIcon(status) {
  if (status === "pass") return iconSvg("validation", "tiny-icon");
  if (status === "warn") return iconSvg("risk", "tiny-icon");
  return iconSvg("gaps", "tiny-icon");
}

function safe(text) {
  return String(text ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function iconSvg(name, cls = "icon") {
  const paths = {
    overview: '<path d="M3 3h8v8H3z"/><path d="M13 3h8v5h-8z"/><path d="M13 10h8v11h-8z"/><path d="M3 13h8v8H3z"/>',
    graph: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6.8 6.1l10.4-.2M6.5 6.8l4.1 10M17.4 7.5l-4.4 9"/>',
    layers: '<path d="M12 3L3 8l9 5 9-5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/>',
    flow: '<path d="M4 5h8v4H4z"/><path d="M12 7h4m0 0l-2-2m2 2l-2 2"/><path d="M12 17h8v4h-8z"/><path d="M12 19H8m0 0l2-2m-2 2l2 2"/>',
    external: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h7"/>',
    security: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    validation: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
    risk: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1"/>',
  roadmap: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h14"/><circle cx="16" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  gaps: '<path d="M4 18V6"/><path d="M4 18h16"/><path d="M8 14l3-3 3 2 4-5"/>',
  radar: '<path d="M12 12l7-7"/><path d="M4 12a8 8 0 0 1 16 0"/><path d="M6 16a6 6 0 0 1 12 0"/><path d="M8 20a4 4 0 0 1 8 0"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/><path d="M12 8v5l3 2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.2 2.2 0 1 1 3.3 1.9c-.9.5-1.3 1-1.3 2.1"/><circle cx="12" cy="17" r="1"/>',
    refresh: '<path d="M4 12a8 8 0 0 1 13.6-5.7"/><path d="M18 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.6 5.7"/><path d="M6 20v-4h4"/>',
    repo: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    domain: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>',
    projection: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><circle cx="12" cy="7" r="1"/>',
    why: '<path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h6"/>',
    governance: '<path d="M4 20h16"/><path d="M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/>',
    action: '<path d="M4 12h12"/><path d="M12 8l4 4-4 4"/><path d="M4 6h6M4 18h6"/>',
  };
  const content = paths[name] || paths.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

function tip(text) {
  return `<span class="tip" data-tip="${safe(text)}" aria-label="${safe(text)}">?</span>`;
}

function prettyPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function deltaLabel(now, prev) {
  if (typeof now !== "number" || typeof prev !== "number") return "n/d";
  const delta = now - prev;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

function average(values) {
  const nums = (values || []).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return nums.reduce((acc, value) => acc + value, 0) / nums.length;
}

function formatShortTime(value) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatMediumDate(value) {
  try {
    return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(value || "");
  }
}

function formatDecisionSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/d";
  return `${num.toFixed(1)}s`;
}

function formatDecisionClicks(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/d";
  return Number.isInteger(num) ? `${num}` : num.toFixed(1);
}

function formatDecisionRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/d";
  return `${Math.round(num * 100)}%`;
}

function asFiniteNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveDecisionKpiContract() {
  const payload = state.decisionKpiContract;
  const defaults = DEFAULT_DECISION_KPI_CONTRACT;
  return {
    version: String(payload?.version || defaults.version),
    generatedAt: payload?.generatedAt || state.serviceOpsReport?.generatedAt || null,
    source: payload?.source || "data/architecture-service-ops-live-report.json",
    targets: {
      timeToFirstPrioritySec: asFiniteNumber(payload?.targets?.timeToFirstPrioritySec, defaults.targets.timeToFirstPrioritySec),
      timeToRationaleSec: asFiniteNumber(payload?.targets?.timeToRationaleSec, defaults.targets.timeToRationaleSec),
      clicksToOwnerAction: asFiniteNumber(payload?.targets?.clicksToOwnerAction, defaults.targets.clicksToOwnerAction),
      drilldownRateMin: asFiniteNumber(payload?.targets?.drilldownRateMin, defaults.targets.drilldownRateMin),
    },
    baselineBeforeRefactor: {
      sampleSize: asFiniteNumber(payload?.baselineBeforeRefactor?.sampleSize, defaults.baselineBeforeRefactor.sampleSize),
      timeToFirstPrioritySec: asFiniteNumber(
        payload?.baselineBeforeRefactor?.timeToFirstPrioritySec,
        defaults.baselineBeforeRefactor.timeToFirstPrioritySec
      ),
      timeToRationaleSec: asFiniteNumber(
        payload?.baselineBeforeRefactor?.timeToRationaleSec,
        defaults.baselineBeforeRefactor.timeToRationaleSec
      ),
      clicksToOwnerAction: asFiniteNumber(
        payload?.baselineBeforeRefactor?.clicksToOwnerAction,
        defaults.baselineBeforeRefactor.clicksToOwnerAction
      ),
      drilldownRate: asFiniteNumber(payload?.baselineBeforeRefactor?.drilldownRate, defaults.baselineBeforeRefactor.drilldownRate),
    },
    postRefactorBaseline: {
      sampleSize: asFiniteNumber(payload?.postRefactorBaseline?.sampleSize, defaults.postRefactorBaseline.sampleSize),
      timeToFirstPrioritySec: asFiniteNumber(
        payload?.postRefactorBaseline?.timeToFirstPrioritySec,
        defaults.postRefactorBaseline.timeToFirstPrioritySec
      ),
      timeToRationaleSec: asFiniteNumber(
        payload?.postRefactorBaseline?.timeToRationaleSec,
        defaults.postRefactorBaseline.timeToRationaleSec
      ),
      clicksToOwnerAction: asFiniteNumber(
        payload?.postRefactorBaseline?.clicksToOwnerAction,
        defaults.postRefactorBaseline.clicksToOwnerAction
      ),
      drilldownRate: asFiniteNumber(payload?.postRefactorBaseline?.drilldownRate, defaults.postRefactorBaseline.drilldownRate),
    },
  };
}

function createDecisionKpiSession() {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    interactionCount: 0,
    navigationCount: 0,
    drilldownCount: 0,
    ownerActionCount: 0,
    firstPriorityAtMs: null,
    firstRationaleAtMs: null,
    firstOwnerActionAtMs: null,
    firstOwnerActionClicks: null,
    viewVisits: {},
    lastView: null,
    events: [],
  };
}

function sanitizeDecisionKpiSession(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!payload.id || !payload.startedAt || !Number.isFinite(Number(payload.startedAtMs))) return null;
  return {
    id: String(payload.id),
    startedAt: String(payload.startedAt),
    startedAtMs: Number(payload.startedAtMs),
    interactionCount: Math.max(0, Number(payload.interactionCount || 0)),
    navigationCount: Math.max(0, Number(payload.navigationCount || 0)),
    drilldownCount: Math.max(0, Number(payload.drilldownCount || 0)),
    ownerActionCount: Math.max(0, Number(payload.ownerActionCount || 0)),
    firstPriorityAtMs: asFiniteNumber(payload.firstPriorityAtMs),
    firstRationaleAtMs: asFiniteNumber(payload.firstRationaleAtMs),
    firstOwnerActionAtMs: asFiniteNumber(payload.firstOwnerActionAtMs),
    firstOwnerActionClicks: asFiniteNumber(payload.firstOwnerActionClicks),
    viewVisits: payload.viewVisits && typeof payload.viewVisits === "object" ? payload.viewVisits : {},
    lastView: payload.lastView ? String(payload.lastView) : null,
    events: Array.isArray(payload.events) ? payload.events.slice(-120) : [],
  };
}

function summarizeDecisionKpiSession(session, endedAtMs = Date.now()) {
  if (!session) return null;
  const durationSec = Math.max(0, (Number(endedAtMs) - Number(session.startedAtMs || endedAtMs)) / 1000);
  const firstPrioritySec =
    Number.isFinite(Number(session.firstPriorityAtMs)) && Number(session.firstPriorityAtMs) >= Number(session.startedAtMs)
      ? Number(((Number(session.firstPriorityAtMs) - Number(session.startedAtMs)) / 1000).toFixed(1))
      : null;
  const firstRationaleSec =
    Number.isFinite(Number(session.firstRationaleAtMs)) && Number(session.firstRationaleAtMs) >= Number(session.startedAtMs)
      ? Number(((Number(session.firstRationaleAtMs) - Number(session.startedAtMs)) / 1000).toFixed(1))
      : null;
  const firstOwnerActionClicks = Number.isFinite(Number(session.firstOwnerActionClicks))
    ? Number(session.firstOwnerActionClicks)
    : null;
  const drilldownRate =
    Number(session.interactionCount || 0) > 0
      ? Number((Number(session.drilldownCount || 0) / Number(session.interactionCount || 0)).toFixed(3))
      : 0;
  return {
    id: String(session.id),
    startedAt: String(session.startedAt),
    durationSec: Number(durationSec.toFixed(1)),
    interactionCount: Number(session.interactionCount || 0),
    navigationCount: Number(session.navigationCount || 0),
    drilldownCount: Number(session.drilldownCount || 0),
    ownerActionCount: Number(session.ownerActionCount || 0),
    firstPrioritySec,
    firstRationaleSec,
    firstOwnerActionClicks,
    drilldownRate,
  };
}

function readDecisionKpiStore() {
  try {
    const raw = window.localStorage.getItem(DECISION_KPI_STORAGE_KEY);
    if (!raw) return { history: [], activeSession: null };
    const payload = JSON.parse(raw);
    const history = Array.isArray(payload?.history)
      ? payload.history
          .map((entry) => {
            const summary = {
              id: String(entry?.id || ""),
              startedAt: String(entry?.startedAt || ""),
              durationSec: asFiniteNumber(entry?.durationSec),
              interactionCount: asFiniteNumber(entry?.interactionCount, 0),
              navigationCount: asFiniteNumber(entry?.navigationCount, 0),
              drilldownCount: asFiniteNumber(entry?.drilldownCount, 0),
              ownerActionCount: asFiniteNumber(entry?.ownerActionCount, 0),
              firstPrioritySec: asFiniteNumber(entry?.firstPrioritySec),
              firstRationaleSec: asFiniteNumber(entry?.firstRationaleSec),
              firstOwnerActionClicks: asFiniteNumber(entry?.firstOwnerActionClicks),
              drilldownRate: asFiniteNumber(entry?.drilldownRate, 0),
            };
            if (!summary.id || !summary.startedAt) return null;
            return summary;
          })
          .filter(Boolean)
      : [];
    const activeSession = sanitizeDecisionKpiSession(payload?.activeSession);
    return { history, activeSession };
  } catch {
    return { history: [], activeSession: null };
  }
}

function persistDecisionKpiStore() {
  try {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      history: (state.decisionKpiHistory || []).slice(-40),
      activeSession: state.decisionKpiSession,
    };
    window.localStorage.setItem(DECISION_KPI_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // best effort only (embed/private mode may block localStorage)
  }
}

function ensureDecisionKpiSession() {
  if (!state.decisionKpiSession) state.decisionKpiSession = createDecisionKpiSession();
  return state.decisionKpiSession;
}

function initializeDecisionKpiTelemetry() {
  if (state.decisionKpiSession) return;
  const store = readDecisionKpiStore();
  const history = Array.isArray(store.history) ? store.history.slice(-40) : [];
  if (store.activeSession) {
    const previousSummary = summarizeDecisionKpiSession(store.activeSession);
    if (previousSummary) history.push(previousSummary);
  }
  state.decisionKpiHistory = history.slice(-40);
  state.decisionKpiSession = createDecisionKpiSession();
  state.decisionKpiSession.lastView = state.activeView;
  state.decisionKpiSession.viewVisits[state.activeView] = 1;
  persistDecisionKpiStore();
}

function finalizeDecisionKpiTelemetry() {
  const session = state.decisionKpiSession;
  if (!session) return;
  const summary = summarizeDecisionKpiSession(session);
  if (summary) {
    state.decisionKpiHistory = [...(state.decisionKpiHistory || []), summary].slice(-40);
  }
  state.decisionKpiSession = null;
  persistDecisionKpiStore();
}

function resetDecisionKpiSession() {
  state.decisionKpiSession = createDecisionKpiSession();
  state.decisionKpiSession.lastView = state.activeView;
  state.decisionKpiSession.viewVisits[state.activeView] = 1;
  persistDecisionKpiStore();
}

function trackDecisionKpiInteraction(rawKinds, detail = {}) {
  const session = ensureDecisionKpiSession();
  const kinds = Array.from(
    new Set(
      String(rawKinds || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (!kinds.length) return;

  const timestampMs = Date.now();
  session.interactionCount = Number(session.interactionCount || 0) + 1;

  if (kinds.includes("navigation")) {
    session.navigationCount = Number(session.navigationCount || 0) + 1;
    const view = String(detail?.view || state.activeView || "").trim();
    if (view) {
      session.lastView = view;
      session.viewVisits[view] = Number(session.viewVisits[view] || 0) + 1;
    }
  }
  if (kinds.includes("priority") && !Number.isFinite(Number(session.firstPriorityAtMs))) {
    session.firstPriorityAtMs = timestampMs;
  }
  if (kinds.includes("rationale") && !Number.isFinite(Number(session.firstRationaleAtMs))) {
    session.firstRationaleAtMs = timestampMs;
  }
  if (kinds.includes("drilldown")) {
    session.drilldownCount = Number(session.drilldownCount || 0) + 1;
  }
  if (kinds.includes("owner-action")) {
    session.ownerActionCount = Number(session.ownerActionCount || 0) + 1;
    if (!Number.isFinite(Number(session.firstOwnerActionAtMs))) {
      session.firstOwnerActionAtMs = timestampMs;
      session.firstOwnerActionClicks = Number(session.interactionCount || 0);
    }
  }

  session.events.push({
    at: new Date(timestampMs).toISOString(),
    kinds,
    detail,
  });
  if (session.events.length > 120) session.events = session.events.slice(-120);
  persistDecisionKpiStore();
}

function decisionKpiStatus(value, threshold, mode = "max") {
  const numericValue = Number(value);
  const numericThreshold = Number(threshold);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericThreshold)) return "warn";
  if (mode === "min") return numericValue >= numericThreshold ? "pass" : "fail";
  return numericValue <= numericThreshold ? "pass" : "fail";
}

function averageDecisionMetric(rows, key) {
  const values = (rows || [])
    .map((row) => asFiniteNumber(row?.[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2));
}

function computeDecisionKpiAggregate(contract) {
  const currentSummary = summarizeDecisionKpiSession(state.decisionKpiSession);
  const allRows = [...(state.decisionKpiHistory || []), ...(currentSummary ? [currentSummary] : [])];
  const effectiveRows = allRows.slice(-20);
  const aggregate = {
    sampleSize: effectiveRows.length,
    timeToFirstPrioritySec: averageDecisionMetric(effectiveRows, "firstPrioritySec"),
    timeToRationaleSec: averageDecisionMetric(effectiveRows, "firstRationaleSec"),
    clicksToOwnerAction: averageDecisionMetric(effectiveRows, "firstOwnerActionClicks"),
    drilldownRate: averageDecisionMetric(effectiveRows, "drilldownRate"),
  };
  const successRows = effectiveRows.filter((row) => Number(row.interactionCount || 0) > 0);
  const targetHits = successRows.filter((row) => {
    const firstPriorityPass =
      Number.isFinite(Number(row.firstPrioritySec)) && Number(row.firstPrioritySec) <= Number(contract.targets.timeToFirstPrioritySec);
    const rationalePass =
      Number.isFinite(Number(row.firstRationaleSec)) && Number(row.firstRationaleSec) <= Number(contract.targets.timeToRationaleSec);
    const ownerPass =
      Number.isFinite(Number(row.firstOwnerActionClicks)) && Number(row.firstOwnerActionClicks) <= Number(contract.targets.clicksToOwnerAction);
    return firstPriorityPass && rationalePass && ownerPass;
  });
  return {
    currentSummary,
    aggregate,
    successRate: successRows.length ? Number((targetHits.length / successRows.length).toFixed(3)) : 0,
  };
}

function parseAgeHoursFromIso(value) {
  const timestamp = Date.parse(String(value || ""));
  if (Number.isNaN(timestamp)) return null;
  const age = (Date.now() - timestamp) / (1000 * 60 * 60);
  return Number(Math.max(0, age).toFixed(1));
}

function freshnessStatusFromAge(ageHours, slaHours = { normal: 24, degraded: 48 }) {
  const age = Number(ageHours);
  const normal = Number(slaHours?.normal ?? 24);
  const degraded = Number(slaHours?.degraded ?? 48);
  if (!Number.isFinite(age)) return "stale";
  if (age <= normal) return "normal";
  if (age <= degraded) return "degraded";
  return "stale";
}

function freshnessBadgeClass(status) {
  return status === "normal" ? "pass" : status === "degraded" ? "warn" : "fail";
}

function freshnessLabel(status) {
  return status === "normal" ? "normal" : status === "degraded" ? "degradee" : "stale";
}

function normalizeAlertState(value) {
  const raw = String(value || "open").trim().toLowerCase().replaceAll("_", "-");
  if (raw === "in-progress" || raw === "progress" || raw === "started") return "in-progress";
  if (raw === "done" || raw === "closed" || raw === "resolved") return "done";
  return "open";
}

function alertStateLabel(stateValue) {
  if (stateValue === "in-progress") return "in-progress";
  if (stateValue === "done") return "done";
  return "open";
}

function alertStateBadgeClass(stateValue) {
  if (stateValue === "done") return "pass";
  if (stateValue === "in-progress") return "warn";
  return "fail";
}

function resolveProofHref(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const root = "/Users/mohyi/atlas/";
  if (value.startsWith(root)) return `./${value.slice(root.length)}`;
  if (value.startsWith("data/") || value.startsWith("docs/") || value.startsWith("tasks/")) return `./${value}`;
  return "";
}

function buildFallbackFreshnessContract(data = state.data, history = state.history) {
  const datasets = [];
  if (data?.generatedAt) {
    const ageHours = parseAgeHoursFromIso(data.generatedAt);
    const status = freshnessStatusFromAge(ageHours);
    datasets.push({
      dataset: "atlas-data",
      file: "data/atlas-data.json",
      generatedAt: data.generatedAt,
      ageHours: Number(ageHours ?? 0),
      status,
    });
  }

  const snapshots = Array.isArray(history?.snapshots) ? history.snapshots : [];
  const latest = snapshots[snapshots.length - 1];
  if (latest?.generatedAt) {
    const ageHours = parseAgeHoursFromIso(latest.generatedAt);
    const status = freshnessStatusFromAge(ageHours);
    datasets.push({
      dataset: "atlas-history",
      file: "data/atlas-history.json",
      generatedAt: latest.generatedAt,
      ageHours: Number(ageHours ?? 0),
      status,
    });
  }

  const rank = { normal: 0, degraded: 1, stale: 2 };
  const globalStatus = datasets.reduce((best, row) => (rank[row.status] > rank[best] ? row.status : best), "normal");
  const staleRows = datasets.filter((row) => row.status === "stale");

  return {
    generatedAt: new Date().toISOString(),
    slaHours: { normal: 24, degraded: 48 },
    globalStatus,
    staleDatasetCount: staleRows.length,
    datasets,
    alerts: staleRows.map((row) => ({
      id: `freshness:${row.dataset}`,
      type: "freshness",
      dataset: row.dataset,
      domain: "platform",
      severity: "critical",
      status: row.status,
      ageHours: row.ageHours,
      generatedAt: row.generatedAt,
      explanation: `Dataset ${row.dataset} stale (${row.ageHours}h).`,
      action: `Relancer le refresh Atlas pour ${row.dataset} puis revalider les quality gates.`,
    })),
  };
}

function resolveFreshnessContract(data = state.data, history = state.history) {
  const fromData = data?.freshnessContract;
  if (fromData && Array.isArray(fromData.datasets)) {
    return {
      generatedAt: fromData.generatedAt || new Date().toISOString(),
      slaHours: {
        normal: Number(fromData?.slaHours?.normal ?? 24),
        degraded: Number(fromData?.slaHours?.degraded ?? 48),
      },
      globalStatus: String(fromData.globalStatus || "normal"),
      staleDatasetCount: Number(fromData.staleDatasetCount || 0),
      datasets: fromData.datasets,
      alerts: Array.isArray(fromData.alerts) ? fromData.alerts : [],
    };
  }
  return buildFallbackFreshnessContract(data, history);
}

function updateFreshnessPill(contract) {
  const node = document.getElementById("freshness-status");
  if (!node) return;
  const resolved = contract || buildFallbackFreshnessContract();
  const status = String(resolved?.globalStatus || "stale");
  const staleCount = Number(resolved?.staleDatasetCount || 0);
  node.classList.remove("pass", "warn", "fail");
  node.classList.add(freshnessBadgeClass(status));
  node.textContent = `Fraicheur: ${freshnessLabel(status)}${staleCount > 0 ? ` (${staleCount} stale)` : ""}`;
}

function normalizeTrendWindow() {
  const value = String(state.trendWindow || "14");
  if (value === "all") return "all";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 14;
  return numeric;
}

function trimTrendPoints(points) {
  const safePoints = Array.isArray(points) ? points : [];
  const windowSize = normalizeTrendWindow();
  if (windowSize === "all") return safePoints;
  return safePoints.slice(-windowSize);
}

function trendWindowLabel(points) {
  if (!Array.isArray(points) || !points.length) return "Période: n/d";
  const start = points[0]?.generatedAt;
  const end = points[points.length - 1]?.generatedAt;
  return `Période: ${formatMediumDate(start)} → ${formatMediumDate(end)}`;
}

function getDomainProfile(name) {
  if (!state.data?.domainProfiles) return null;
  return state.data.domainProfiles.find((d) => String(d.domain).toLowerCase() === String(name).toLowerCase()) || null;
}

function getArchitectureDomain(name) {
  const key = String(name).toLowerCase();
  const payload = state.architectureScore;
  if (!payload) return null;
  if (Array.isArray(payload.domains)) {
    const row = payload.domains.find((entry) => String(entry?.domain || "").toLowerCase() === key);
    if (!row) return null;
    return {
      score: Number(row.overall || 0),
      domainIsolation: Number(row.architectureHealth || 0),
      writePath: Number(row.architectureHealth || 0),
      projections: Number(row.projectionDiscipline || 0),
      events: Number(row.architectureHealth || 0),
      contracts: Number(row.validationMaturity || 0),
      observability: Number(row.validationMaturity || 0),
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
    };
  }
  if (payload?.domains && typeof payload.domains === "object") {
    return payload.domains[key] || null;
  }
  if (payload?.legacy?.domains && typeof payload.legacy.domains === "object") {
    return payload.legacy.domains[key] || null;
  }
  return null;
}

function getDriftDomain(name) {
  return state.driftReport?.domains?.[String(name).toLowerCase()] || null;
}

function getDecisionPriorityDomain(name, data = state.data) {
  const key = String(name || "").toLowerCase();
  const rows = data?.decisionPriority?.domains;
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => String(row?.domain || "").toLowerCase() === key) || null;
}

function getTrendsCorrelation() {
  const projection = state.history?.trendsCorrelation;
  return projection && typeof projection === "object" ? projection : null;
}

function normalizeDomainToken(value) {
  return String(value || "").trim().toLowerCase();
}

function getInvestigationContext() {
  const context = state.investigationContext;
  if (!context || typeof context !== "object") return null;
  const domain = normalizeDomainToken(context.domain);
  if (!domain) return null;
  return {
    domain,
    source: String(context.source || "context"),
    alertId: context.alertId ? String(context.alertId) : null,
  };
}

function setInvestigationContext({ domain, source, alertId = null, view }) {
  const normalizedDomain = normalizeDomainToken(domain);
  if (!normalizedDomain) return;
  if (!isFeatureEnabled("secondaryInvestigationEnabled")) {
    state.investigationContext = null;
    switchViewSafely("domains", "overview");
    render();
    return;
  }
  state.investigationContext = {
    domain: normalizedDomain,
    source: String(source || "context"),
    alertId: alertId ? String(alertId) : null,
  };
  switchViewSafely(view === "radar" ? "radar" : "graph", "domains");
  render();
}

function clearInvestigationContext(nextView = "domains") {
  state.investigationContext = null;
  switchViewSafely(nextView, "overview");
  render();
}

function setEvidenceContext({ domain, source, proofPath = "", alertId = null }) {
  const normalizedDomain = normalizeDomainToken(domain);
  if (!isFeatureEnabled("evidenceSpaceEnabled")) {
    state.evidenceContext = null;
    state.activeEvidenceId = null;
    switchViewSafely("alerts", "overview");
    render();
    return;
  }
  state.evidenceContext = {
    domain: normalizedDomain || "",
    source: String(source || "context"),
    proofPath: String(proofPath || ""),
    alertId: alertId ? String(alertId) : null,
  };
  if (normalizedDomain) state.evidenceDomainFilter = normalizedDomain;
  if (proofPath) state.evidenceSearch = String(proofPath);
  state.activeEvidenceId = null;
  switchViewSafely("evidence", "alerts");
  render();
}

function clearEvidenceContext() {
  state.evidenceContext = null;
  state.evidenceSearch = "";
  state.evidenceDomainFilter = "all";
  state.evidenceTypeFilter = "all";
  state.evidenceSourceFilter = "all";
  state.activeEvidenceId = null;
  if (state.activeView === "evidence" && !isFeatureEnabled("evidenceSpaceEnabled")) {
    switchViewSafely("overview");
  }
  render();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "n/d";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function buildFallbackAuditIndex(data = state.data, history = state.history) {
  const nowIso = new Date().toISOString();
  const latestSnapshot = Array.isArray(history?.snapshots) ? history.snapshots[history.snapshots.length - 1] : null;
  const artifacts = [
    { id: "dataset:atlas-data", type: "dataset", source: "generated", label: "Dataset Atlas principal", path: "data/atlas-data.json", generatedAt: data?.generatedAt || nowIso, sizeBytes: null, domain: "platform" },
    { id: "dataset:atlas-history", type: "dataset", source: "generated", label: "Historique Atlas", path: "data/atlas-history.json", generatedAt: latestSnapshot?.generatedAt || nowIso, sizeBytes: null, domain: "platform" },
    { id: "dataset:architecture-drift", type: "dataset", source: "generated", label: "Rapport de dérive", path: "data/architecture-drift.json", generatedAt: data?.generatedAt || nowIso, sizeBytes: null, domain: "platform" },
    { id: "dataset:architecture-score", type: "dataset", source: "generated", label: "Score architecture", path: "data/architecture-score.json", generatedAt: data?.generatedAt || nowIso, sizeBytes: null, domain: "platform" },
    { id: "dataset:trends-correlation", type: "dataset", source: "history", label: "Projection trends correlation", path: "data/history/atlas-trends-correlation.json", generatedAt: history?.trendsCorrelation?.generatedAt || nowIso, sizeBytes: null, domain: "platform" },
  ];

  const snapshotRows = Array.isArray(history?.snapshots)
    ? history.snapshots.map((row, index, array) => ({
        id: `snapshot:${row.file}`,
        type: "snapshot",
        source: "history",
        label: `Snapshot brut ${array.length - index}/${array.length}`,
        path: `data/${row.file}`,
        generatedAt: row.generatedAt || nowIso,
        sizeBytes: null,
        domain: "platform",
      }))
    : [];

  return {
    generatedAt: nowIso,
    artifacts: [...artifacts, ...snapshotRows],
  };
}

function resolveAuditIndex(data = state.data, history = state.history) {
  const payload = state.auditIndex;
  if (payload && Array.isArray(payload.artifacts)) return payload;
  return buildFallbackAuditIndex(data, history);
}

function severityRankValue(level) {
  const key = String(level || "low").toLowerCase();
  return key === "critical" ? 4 : key === "high" ? 3 : key === "medium" ? 2 : key === "low" ? 1 : 0;
}

function computeFallbackDecisionPriority(row) {
  const drift = getDriftDomain(row.domain);
  const findings = Number(drift?.totalFindings || 0);
  const projected = Number(drift?.healthImpact?.projectedScore ?? row.score);
  const degradation = Math.max(0, Number(row.score || 0) - projected);
  const consumers = (row.consumers || []).length;
  return Number(
    (
      (100 - Number(row.score || 0)) * 0.35 +
      findings * 2.8 +
      degradation * 1.4 +
      consumers * 3
    ).toFixed(1)
  );
}

function architectureRows(data) {
  const profiles = data?.domainProfiles || [];
  const scorePayload = state.architectureScore;
  if (!scorePayload?.domains && !scorePayload?.legacy?.domains) {
    return profiles.map((profile) => ({
      domain: profile.domain,
      score: profile.overallScore,
      domainIsolation: profile.scores?.architectureHealth?.score ?? profile.overallScore,
      writePath: profile.scores?.architectureHealth?.score ?? profile.overallScore,
      projections: profile.scores?.projectionDiscipline?.score ?? profile.overallScore,
      events: profile.scores?.architectureHealth?.score ?? profile.overallScore,
      contracts: profile.scores?.validationMaturity?.score ?? profile.overallScore,
      observability: profile.scores?.observabilityReadiness?.score ?? profile.overallScore,
      warnings: [],
      consumers: profile.consumers || [],
      decisionPriority:
        Number(getDecisionPriorityDomain(profile.domain, data)?.score) || 0,
      decisionPriorityRank:
        Number(getDecisionPriorityDomain(profile.domain, data)?.rank) || null,
    }));
  }

  const profileByDomain = new Map(
    profiles.map((profile) => [String(profile.domain).toLowerCase(), profile])
  );

  const legacyDomains =
    scorePayload?.legacy?.domains && typeof scorePayload.legacy.domains === "object"
      ? scorePayload.legacy.domains
      : null;

  if (Array.isArray(scorePayload?.domains)) {
    return scorePayload.domains.map((row) => {
      const domain = String(row?.domain || "").toLowerCase();
      const profile = profileByDomain.get(domain);
      return {
        domain,
        score: Number(row?.overall || 0),
        domainIsolation: Number(row?.architectureHealth || profile?.scores?.architectureHealth?.score || 0),
        writePath: Number(row?.architectureHealth || profile?.scores?.architectureHealth?.score || 0),
        projections: Number(row?.projectionDiscipline || profile?.scores?.projectionDiscipline?.score || 0),
        events: Number(profile?.scores?.architectureHealth?.score || row?.architectureHealth || 0),
        contracts: Number(row?.validationMaturity || profile?.scores?.validationMaturity?.score || 0),
        observability: Number(profile?.scores?.observabilityReadiness?.score || row?.validationMaturity || 0),
        warnings: Array.isArray(row?.warnings) ? row.warnings : [],
        consumers: profile?.consumers || [],
        decisionPriority:
          Number(getDecisionPriorityDomain(domain, data)?.score) || 0,
        decisionPriorityRank:
          Number(getDecisionPriorityDomain(domain, data)?.rank) || null,
      };
    });
  }

  const objectDomains =
    scorePayload?.domains && typeof scorePayload.domains === "object"
      ? scorePayload.domains
      : legacyDomains || {};

  return Object.entries(objectDomains).map(([domain, row]) => {
    const normalized = String(domain).toLowerCase();
    const profile = profileByDomain.get(normalized);
    return {
      domain: normalized,
      score: Number(row?.score || 0),
      domainIsolation: Number(row?.domainIsolation || profile?.scores?.architectureHealth?.score || 0),
      writePath: Number(row?.writePath || profile?.scores?.architectureHealth?.score || 0),
      projections: Number(row?.projections || profile?.scores?.projectionDiscipline?.score || 0),
      events: Number(row?.events || profile?.scores?.architectureHealth?.score || 0),
      contracts: Number(row?.contracts || profile?.scores?.validationMaturity?.score || 0),
      observability: Number(row?.observability || profile?.scores?.observabilityReadiness?.score || 0),
      warnings: Array.isArray(row?.warnings) ? row.warnings : [],
      consumers: profile?.consumers || [],
      decisionPriority:
        Number(getDecisionPriorityDomain(normalized, data)?.score) || 0,
      decisionPriorityRank:
        Number(getDecisionPriorityDomain(normalized, data)?.rank) || null,
    };
  });
}

function frenchExplainFromText(rawText) {
  const text = String(rawText || "").trim();
  const normalized = text.toLowerCase();

  const domainNames = (state.data?.domainProfiles || []).map((d) => d.domain);
  const domain = domainNames.find((d) => new RegExp(`\\b${d}\\b`, "i").test(normalized));
  if (domain) {
    const profile = getDomainProfile(domain);
    const arch = getArchitectureDomain(domain);
    if (profile) {
      return {
        title: `Domaine ${profile.domain}`,
        category: "domain",
        definition: `Ce domaine représente un bloc métier du système NEXORA V3. Son score global est ${(arch?.score ?? profile.overallScore)}/100.`,
        why: `Plus ce domaine est propre, plus la plateforme reste stable sur 10 ans (moins de duplication, moins de dérive, meilleure évolutivité).`,
        governance: `Doctrine: le Core décide, les projections expliquent, les apps affichent. Les consommateurs (${(profile.consumers || []).join(", ") || "n/d"}) ne doivent pas redécider la logique métier.`,
        action: arch
          ? `AHS détails: isolation=${arch.domainIsolation}, write-path=${arch.writePath}, projections=${arch.projections}, events=${arch.events}, contracts=${arch.contracts}, observability=${arch.observability}.`
          : `Priorités: contracts-first=${profile.badges.contractsFirst}, write-path=${profile.badges.canonicalWritePath}, projection=${profile.badges.projectionCanonical}, duplication=${profile.badges.noDuplicatedBusinessLogic}.`,
      };
    }
  }

  const patterns = [
    {
      re: /repositories scanned|dépôts scannés|repo\b/i,
      detail: {
        title: "Dépôts scannés",
        category: "repo",
        definition: "Nombre de repositories analysés pour construire la carte de vérité.",
        why: "Plus la couverture de scan est complète, plus les décisions d’architecture sont fiables.",
        governance: "MCP agit comme control plane multi-repo. La gouvernance V3 exige une lecture transversale, pas locale.",
        action: "Si un repo manque, la cartographie est partielle et les scores peuvent être trompeurs.",
      },
    },
    {
      re: /loc|lines|fichier|hotspot/i,
      detail: {
        title: "Volume de code / Hotspot",
        category: "risk",
        definition: "Indicateur de taille et de concentration de complexité.",
        why: "Les gros hotspots augmentent le risque de régression et ralentissent les extractions de domaine.",
        governance: "V3 pousse des routes fines et une séparation domaine/application/ports/adapters.",
        action: "Découper progressivement les zones les plus lourdes et ajouter des preuves (tests + E2E).",
      },
    },
    {
      re: /route|write-path|write path/i,
      detail: {
        title: "Write-path canonique",
        category: "flow",
        definition: "Chemin officiel d’écriture métier. Une seule source de décision, pas de chemin parallèle.",
        why: "Évite les états incohérents et les divergences entre apps.",
        governance: "Règle V3: une seule write-path canonique, aucune duplication cross-app.",
        action: "Si un write-path hors core est détecté, le traiter comme risque architectural prioritaire.",
      },
    },
    {
      re: /projection|read path|read-path|read model/i,
      detail: {
        title: "Projection canonique / Read-path",
        category: "projection",
        definition: "Vue stable dérivée du canon, destinée aux consommateurs.",
        why: "Permet aux apps d’afficher sans recalculer localement la logique métier.",
        governance: "Le Core décide. Les projections expliquent. Les apps affichent.",
        action: "Quand plusieurs apps lisent un même domaine, une projection canonique explicite est requise.",
      },
    },
    {
      re: /contracts-first|contract/i,
      detail: {
        title: "Contracts-first",
        category: "governance",
        definition: "Les contrats et schémas sont définis avant l’implémentation.",
        why: "Réduit les régressions d’intégration entre équipes/apps/services.",
        governance: "Doctrine V3 obligatoire sur les domaines critiques.",
        action: "Ajouter/renforcer contract tests consumer ↔ projection.",
      },
    },
    {
      re: /pkce|oauth|jwt|session|auth|security|otel|trace/i,
      detail: {
        title: "Sécurité / Auth / Observabilité",
        category: "security",
        definition: "Mesure la robustesse des accès, identités, traces et diagnostics.",
        why: "Sans garde-fous sécurité + traces, les incidents coûtent plus cher et durent plus longtemps.",
        governance: "PKCE par défaut pour clients publics, OTel + Trace Context par défaut.",
        action: "Traiter les trous de sécurité/observabilité comme dette de plateforme, pas comme détail local.",
      },
    },
    {
      re: /e2e|playwright|validation|proof|tests?/i,
      detail: {
        title: "Validation / Preuve",
        category: "validation",
        definition: "Preuves techniques exécutables: lint, typecheck, tests, E2E.",
        why: "La gouvernance V3 est pilotée par preuve, pas par déclaration.",
        governance: "Chaque ticket exécutable doit publier ses preuves associées.",
        action: "Si un flux utilisateur est impacté, inclure Playwright E2E.",
      },
    },
    {
      re: /gap|target|roadmap|extraction|phase/i,
      detail: {
        title: "Écart vs cible V3",
        category: "roadmap",
        definition: "Différence entre l’architecture actuelle et l’architecture cible.",
        why: "Permet de prioriser les efforts qui débloquent la stabilité long terme.",
        governance: "Packages/domaines d’abord, extraction physique ensuite.",
        action: "Exécuter les phases dans l’ordre et éviter les chantiers parallèles non prouvés.",
      },
    },
    {
      re: /drift|dérive|unregistered|undeclared|projectionbypass|ownershipviolation/i,
      detail: {
        title: "Dérive architecture",
        category: "risk",
        definition: "Écart détecté entre le code réel et les registres canoniques (projections, events, boundaries, ownership).",
        why: "Une dérive non traitée crée du couplage caché, des régressions et des décisions locales non gouvernées.",
        governance: "Le scanner drift sert de garde-fou V3 avec impact explicite sur la santé de domaine.",
        action: "Corriger les domaines avec `riskLevel` high/critical en priorité et lier la correction à un ticket architecture.",
      },
    },
    {
      re: /external|service|provider|stripe|slack|twilio|telegram|vercel|render|cloudflare/i,
      detail: {
        title: "Service externe",
        category: "external",
        definition: "Intégration tierce utilisée par un ou plusieurs domaines/repositories.",
        why: "Chaque dépendance externe augmente les risques d’auth, de webhooks, de drift et de blocages humains.",
        governance: "Human-Only uniquement en dernier recours après tentative d’automatisation.",
        action: "Cartographier clairement ownership, callback/webhook, secrets et criticité.",
      },
    },
  ];

  for (const entry of patterns) {
    if (entry.re.test(normalized)) return entry.detail;
  }

  return {
    title: "Élément d’architecture",
    category: "info",
    definition: "Cet élément fait partie du cockpit de pilotage V3.",
    why: "Il sert à comprendre l’état réel du système et à décider les prochains refactors.",
    governance: "Référence doctrine: contracts-first, module-first, write-path canonique, projections explicites.",
    action: "Clique sur des éléments plus précis (domaine, badge, ligne de table) pour une explication ciblée.",
  };
}

function showDetailPanel(detail) {
  const body = document.getElementById("detail-body");
  const overlay = document.getElementById("detail-overlay");
  const panel = document.getElementById("detail-panel");
  if (!body || !overlay) return;
  const category = detail.category || "info";
  if (panel) panel.setAttribute("data-category", category);
  body.innerHTML = `
    <div class="detail-item detail-title">${iconSvg(category === "domain" ? "domain" : category, "detail-icon")}<strong>${safe(detail.title || "Détail")}</strong></div>
    <div class="detail-item">${iconSvg("info", "detail-icon")}<strong>Définition:</strong><br />${safe(detail.definition || "")}</div>
    <div class="detail-item">${iconSvg("why", "detail-icon")}<strong>Pourquoi c’est important:</strong><br />${safe(detail.why || "")}</div>
    <div class="detail-item">${iconSvg("governance", "detail-icon")}<strong>Lien gouvernance V3:</strong><br />${safe(detail.governance || "")}</div>
    <div class="detail-item">${iconSvg("action", "detail-icon")}<strong>Action recommandée:</strong><br />${safe(detail.action || "")}</div>
  `;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function hideDetailPanel() {
  const overlay = document.getElementById("detail-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

function setHelpMode(enabled) {
  state.helpMode = enabled;
  const toggle = document.getElementById("help-mode-toggle");
  if (toggle) {
    toggle.innerHTML = `${iconSvg("help", "tiny-icon")} Aide: ${enabled ? "ON" : "OFF"}`;
    toggle.classList.toggle("active", enabled);
  }
  document.body.classList.toggle("help-mode", enabled);
  if (!enabled) hideDetailPanel();
}

function setRefreshButtonState(mode, message = "") {
  const button = document.getElementById("atlas-refresh-btn");
  if (!button) return;
  if (mode === "loading") {
    button.disabled = true;
    button.innerHTML = `${iconSvg("refresh", "tiny-icon spin")} Mise à jour...`;
    return;
  }
  button.disabled = false;
  if (mode === "ok") {
    button.innerHTML = `${iconSvg("validation", "tiny-icon")} Atlas à jour`;
    if (message) button.title = message;
    setTimeout(() => {
      button.innerHTML = `${iconSvg("refresh", "tiny-icon")} Mettre à jour`;
    }, 1400);
    return;
  }
  if (mode === "error") {
    button.innerHTML = `${iconSvg("risk", "tiny-icon")} Échec mise à jour`;
    if (message) button.title = message;
    setTimeout(() => {
      button.innerHTML = `${iconSvg("refresh", "tiny-icon")} Mettre à jour`;
    }, 1800);
    return;
  }
  button.innerHTML = `${iconSvg("refresh", "tiny-icon")} Mettre à jour`;
}

function bindGlobalDetailInteractions() {
  const view = document.getElementById("view");
  const appRoot = document.getElementById("app");
  if (!view) return;

  document.querySelectorAll(".card, .badge, .tag, .kpi, .kpi-caption, table tbody tr, .detail-item, h3, h4, th, .nav button, .pill").forEach((el) => {
    el.classList.add("explainable");
  });

  if (!state.detailListenerBound && appRoot) {
    const refreshBtn = document.getElementById("atlas-refresh-btn");
    const helpToggle = document.getElementById("help-mode-toggle");
    const close = document.getElementById("detail-close");
    const panel = document.getElementById("detail-panel");
    const overlay = document.getElementById("detail-overlay");

    if (refreshBtn) {
      setRefreshButtonState("idle");
      refreshBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.refreshInFlight) return;
        state.refreshInFlight = true;
        setRefreshButtonState("loading");
        try {
          const response = await fetch("./api/refresh", { method: "POST" });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result?.stderr || result?.message || `HTTP ${response.status}`);
          }
          await reloadDataIntoState();
          render();
          setRefreshButtonState("ok", "Scan + build terminés");
        } catch (error) {
          setRefreshButtonState("error", String(error));
          showDetailPanel({
            title: "Mise à jour Atlas indisponible",
            definition: "Le bouton nécessite le serveur Atlas Node avec API refresh.",
            why: "Un serveur statique (python) ne peut pas exécuter atlas:generate.",
            governance: "Utiliser un serveur avec endpoint /api/refresh pour garder données + cockpit synchronisés.",
            action: "Terminal: /Users/mohyi/atlas/run-atlas-fusion.sh",
          });
        } finally {
          state.refreshInFlight = false;
        }
      });
    }

    if (helpToggle) {
      helpToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setHelpMode(!state.helpMode);
      });
    }
    if (close) {
      close.addEventListener("click", (event) => {
        event.preventDefault();
        hideDetailPanel();
      });
    }
    appRoot.addEventListener("click", (event) => {
      if (event.target.closest("#detail-panel")) return;
      if (event.target.closest("#help-mode-toggle")) return;
      if (!state.helpMode) {
        hideDetailPanel();
        return;
      }
      const target = event.target.closest(".explainable, .atlas-node");
      if (!target) {
        hideDetailPanel();
        return;
      }
      const text = target.getAttribute("data-detail-text") || target.textContent || "";
      showDetailPanel(frenchExplainFromText(text));
    });
    if (overlay) overlay.addEventListener("click", () => hideDetailPanel());
    if (panel) panel.addEventListener("click", (event) => event.stopPropagation());
    state.detailListenerBound = true;
  }
}

function scoreBar(score) {
  return `
    <div class="score-bar" title="${score}/100">
      <div class="score-fill" style="width:${score}%"></div>
    </div>
  `;
}

function renderViewGuide(viewId) {
  const guide = VIEW_EXPLANATIONS[viewId];
  if (!guide) return "";
  return `
    <section class="card view-guide">
      <h3>${iconSvg("help", "inline-icon")} ${safe(guide.title)}</h3>
      <p class="view-guide-summary">${safe(guide.summary)}</p>
      <ul class="view-guide-list">
        ${(guide.bullets || []).map((item) => `<li>${safe(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function buildHistoryTrendPoints() {
  const snapshots = Array.isArray(state.history?.snapshots) ? [...state.history.snapshots] : [];
  return snapshots
    .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
    .map((snapshot, index) => {
      const summary = snapshot.summary || {};
      return {
        index,
        generatedAt: snapshot.generatedAt,
        label: formatShortTime(snapshot.generatedAt),
        domainScores: summary.domainScores || {},
        avgScore: averageDomainScoreFromMap(summary.domainScores || {}),
        gaps: Number(summary.gapCount || 0),
        services: Number(summary.servicesCount || 0),
        graphNodes: Number(summary.graphNodes || 0),
        graphEdges: Number(summary.graphEdges || 0),
      };
    });
}

function buildTimeMachineTrendPoints() {
  const snapshots = Array.isArray(state.timeMachine?.snapshots) ? [...state.timeMachine.snapshots] : [];
  return snapshots
    .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
    .map((snapshot, index) => ({
      index,
      generatedAt: snapshot.generatedAt,
      label: formatShortTime(snapshot.generatedAt),
      avgScore: averageDomainScoreFromMap(snapshot.domainScores || {}),
      gaps: Number(snapshot.gapCount || 0),
      services: Number(snapshot.externalServicesCount || 0),
      loc: Number(snapshot.loc || 0),
      routes: Number(snapshot.routeCount || 0),
      tests: Number(snapshot.testCount || 0),
    }));
}

function formatSigned(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "n/d";
  return `${num > 0 ? "+" : ""}${num}`;
}

function computeSeriesGeometry(values, width, height, padding) {
  const numeric = values.map((value) => Number(value || 0));
  if (!numeric.length) return [];
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const step = numeric.length > 1 ? innerWidth / (numeric.length - 1) : 0;
  const range = max - min;

  return numeric.map((value, index) => {
    const x = padding.left + index * step;
    const ratio = range === 0 ? 0.5 : (value - min) / range;
    const y = padding.top + (1 - ratio) * innerHeight;
    return { x, y, value };
  });
}

function renderTrendChart({ chartId, title, subtitle, points, series, emptyLabel = "Pas assez de données pour tracer une tendance." }) {
  if (!Array.isArray(points) || points.length < 2) {
    return `
      <article class="card trend-card">
        <h4>${safe(title)}</h4>
        <p class="trend-subtitle">${safe(subtitle || "")}</p>
        <p class="mono">${safe(emptyLabel)}</p>
      </article>
    `;
  }

  const width = 860;
  const height = 230;
  const padding = { top: 18, right: 16, bottom: 32, left: 28 };
  const chartKey = String(chartId || title || "trend")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");

  const seriesShapes = (series || [])
    .map((config) => {
      const values = Array.isArray(config.values)
        ? config.values.map((value) => Number(value || 0))
        : points.map((point) => Number(point[config.key] || 0));
      if (!values.length) return null;

      const geometry = computeSeriesGeometry(values, width, height, padding);
      const path = geometry.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
      const last = values[values.length - 1];
      const prev = values.length >= 2 ? values[values.length - 2] : last;
      const delta = Number((last - prev).toFixed(1));
      const better = config.better === "lower" ? delta <= 0 : delta >= 0;
      const deltaClass = delta === 0 ? "warn" : better ? "pass" : "fail";
      const formatter = config.format || ((value) => `${Math.round(value)}`);

      return {
        ...config,
        values,
        geometry,
        path,
        lastPoint: geometry[geometry.length - 1],
        lastLabel: formatter(last),
        deltaLabel: values.length >= 2 ? formatSigned(delta) : "n/d",
        deltaClass,
      };
    })
    .filter(Boolean);

  if (!seriesShapes.length) {
    return `
      <article class="card trend-card">
        <h4>${safe(title)}</h4>
        <p class="trend-subtitle">${safe(subtitle || "")}</p>
        <p class="mono">${safe(emptyLabel)}</p>
      </article>
    `;
  }

  const selectedRaw = Number(state.trendSelection[chartKey]);
  const selectedIndex = Number.isInteger(selectedRaw)
    ? Math.max(0, Math.min(points.length - 1, selectedRaw))
    : points.length - 1;
  const selectedPoint = points[selectedIndex] || points[points.length - 1];

  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const innerWidth = width - padding.left - padding.right;
  const tickStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const anchorGeometry = seriesShapes[0]?.geometry || [];
  const selectedX = anchorGeometry[selectedIndex]?.x ?? padding.left;

  return `
    <article class="card trend-card">
      <h4>${safe(title)}</h4>
      <p class="trend-subtitle">${safe(subtitle || "")}</p>
      <div class="trend-period-row">
        <span class="mono">Point sélectionné: ${safe(formatMediumDate(selectedPoint?.generatedAt || ""))}</span>
        <span class="mono">Heure: ${safe(formatShortTime(selectedPoint?.generatedAt || ""))}</span>
      </div>
      <div class="trend-legend">
        ${seriesShapes
          .map(
            (shape) => `
          <span class="trend-legend-item">
            <span class="trend-swatch" style="background:${shape.color}"></span>
            <span>${safe(shape.label)}</span>
            <span class="mono">${safe(shape.format(shape.values[selectedIndex] ?? shape.values[shape.values.length - 1]))}</span>
            <span class="badge ${shape.deltaClass}">Δ ${safe(shape.deltaLabel)}</span>
          </span>
        `
          )
          .join("")}
      </div>
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safe(title)}">
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#2f5463" stroke-width="1" />
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#2f5463" stroke-width="1" />
        <line x1="${selectedX}" y1="${padding.top}" x2="${selectedX}" y2="${height - padding.bottom}" stroke="#8dc3d6" stroke-opacity="0.55" stroke-width="1.2" stroke-dasharray="4 4" />
        ${seriesShapes
          .map(
            (shape) => `
          <path d="${shape.path}" fill="none" stroke="${shape.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="${shape.lastPoint.x}" cy="${shape.lastPoint.y}" r="4" fill="${shape.color}" />
          <circle cx="${shape.geometry[selectedIndex]?.x ?? shape.lastPoint.x}" cy="${shape.geometry[selectedIndex]?.y ?? shape.lastPoint.y}" r="4.8" fill="${shape.color}" stroke="#e8fbff" stroke-width="1.3" />
        `
          )
          .join("")}
        ${anchorGeometry
          .map(
            (anchor, index) => `
          <g class="trend-anchor ${index === selectedIndex ? "active" : ""}" data-trend-chart="${safe(chartKey)}" data-trend-index="${index}">
            <circle cx="${anchor.x}" cy="${height - padding.bottom}" r="9" fill="transparent" />
            <circle cx="${anchor.x}" cy="${height - padding.bottom}" r="${index === selectedIndex ? 4.2 : 3}" fill="${index === selectedIndex ? "#c7f0ff" : "#7ea8b8"}" />
            <title>${safe(formatMediumDate(points[index]?.generatedAt || ""))}</title>
          </g>
        `
          )
          .join("")}
        ${tickIndexes
          .map((index) => {
            const x = padding.left + index * tickStep;
            const label = points[index]?.label || "";
            return `
              <line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 5}" stroke="#3a6676" stroke-width="1" />
              <text x="${x}" y="${height - 8}" text-anchor="middle" fill="#9fb2ba" font-size="11">${safe(label)}</text>
            `;
          })
          .join("")}
      </svg>
      <div class="trend-click-hint">Clique sur un point pour changer la période analysée dans ce graphique.</div>
    </article>
  `;
}

function buildFocusInspirationLists(data) {
  const rows = architectureRows(data);
  const historyPoints = buildHistoryTrendPoints();
  const first = historyPoints[0]?.domainScores || {};
  const last = historyPoints[historyPoints.length - 1]?.domainScores || {};
  const trendByDomain = new Map(
    [...new Set([...Object.keys(first), ...Object.keys(last)])].map((domain) => [
      domain,
      Number((Number(last[domain] || 0) - Number(first[domain] || 0)).toFixed(1)),
    ])
  );

  const enriched = rows.map((row) => {
    const drift = getDriftDomain(row.domain);
    const driftFindings = Number(drift?.totalFindings || 0);
    const warningsCount = Array.isArray(row.warnings) ? row.warnings.length : 0;
    const trend = trendByDomain.get(row.domain) ?? 0;
    const priorityScore = Number(row.decisionPriority || computeFallbackDecisionPriority(row));
    const focusPriority =
      priorityScore +
      driftFindings * 1.5 +
      warningsCount +
      (trend < 0 ? Math.abs(trend) * 1.5 : 0);
    const inspirationPriority =
      row.score +
      Math.max(0, trend) * 2 +
      Math.max(0, row.projections - 80) / 2 +
      Math.max(0, row.contracts - 80) / 2 -
      driftFindings * 3 -
      warningsCount;

    return {
      ...row,
      driftFindings,
      warningsCount,
      trend,
      priorityScore,
      focusPriority,
      inspirationPriority,
    };
  });

  const focus = [...enriched].sort((a, b) => b.focusPriority - a.focusPriority).slice(0, 5);
  const inspiration = [...enriched]
    .filter((row) => row.score >= 70)
    .sort((a, b) => b.inspirationPriority - a.inspirationPriority)
    .slice(0, 5);

  return { focus, inspiration };
}

function renderFocusInspiration(data) {
  const { focus, inspiration } = buildFocusInspirationLists(data);

  return `
    <section class="focus-grid">
      <article class="card focus-column">
        <h3>Focus prioritaire</h3>
        <p class="focus-subtitle">Domaines à corriger en premier pour réduire le risque global.</p>
        ${focus
          .map(
            (item, index) => `
          <div class="focus-item">
            <div class="focus-head">
              <strong>#${index + 1} ${safe(item.domain)}</strong>
              <span class="badge ${item.score < 70 ? "fail" : "warn"}">prio ${item.priorityScore}</span>
            </div>
            <div class="focus-meta">dérive=${item.driftFindings} · tendance=${formatSigned(item.trend)} · alertes=${item.warningsCount}</div>
            <div class="focus-action">Action: sécuriser le write-path, éliminer la dérive et stabiliser les contrats/projections.</div>
          </div>
        `
          )
          .join("")}
      </article>

      <article class="card focus-column">
        <h3>Inspiration à répliquer</h3>
        <p class="focus-subtitle">Domaines les plus solides à prendre comme modèle d’implémentation.</p>
        ${inspiration
          .map(
            (item, index) => `
          <div class="focus-item">
            <div class="focus-head">
              <strong>#${index + 1} ${safe(item.domain)}</strong>
              <span class="badge pass">score ${item.score}</span>
            </div>
            <div class="focus-meta">dérive=${item.driftFindings} · tendance=${formatSigned(item.trend)} · projections=${item.projections}</div>
            <div class="focus-action">À imiter: ownership clair, projection canonique et discipline de validation.</div>
          </div>
        `
          )
          .join("")}
      </article>
    </section>
  `;
}

function renderTrendWindowControls(points) {
  const options = [
    { id: "7", label: "7 points" },
    { id: "14", label: "14 points" },
    { id: "30", label: "30 points" },
    { id: "all", label: "Tout" },
  ];
  return `
    <section class="card trend-toolbar">
      <div class="trend-toolbar-left">
        <strong>${iconSvg("history", "inline-icon")} Fenêtre d'analyse</strong>
        <div class="trend-window-group">
          ${options
            .map(
              (option) => `
            <button type="button" class="trend-window-btn ${String(state.trendWindow) === option.id ? "active" : ""}" data-trend-window="${option.id}">
              ${safe(option.label)}
            </button>
          `
            )
            .join("")}
        </div>
      </div>
      <div class="mono">${safe(trendWindowLabel(points))}</div>
    </section>
  `;
}

function renderEvolutionTrends(data) {
  const historyPoints = trimTrendPoints(buildHistoryTrendPoints());
  const machinePoints = trimTrendPoints(buildTimeMachineTrendPoints());
  const { focus } = buildFocusInspirationLists(data);
  const highlightedDomains = focus.slice(0, 3).map((item) => item.domain);
  const domainSeries = highlightedDomains.map((domain, index) => ({
    label: domain,
    values: historyPoints.map((point) => Number(point.domainScores?.[domain] || 0)),
    color: ["#5ec8ff", "#31c2a0", "#f2a65a"][index % 3],
    better: "higher",
    format: (value) => `${Math.round(value)}/100`,
  }));

  return `
    ${renderTrendWindowControls(historyPoints.length ? historyPoints : machinePoints)}
    <section class="trend-grid">
      ${renderTrendChart({
        chartId: "history-health",
        title: "Évolution santé & dérive (historique)",
        subtitle: "Lecture des signaux structurels dans le temps (score moyen et dette).",
        points: historyPoints,
        series: [
          { key: "avgScore", label: "Score moyen", color: "#4fd18b", better: "higher", format: (value) => `${Math.round(value)}/100` },
          { key: "gaps", label: "Écarts", color: "#ef6c57", better: "lower", format: (value) => `${Math.round(value)}` },
          { key: "services", label: "Services externes", color: "#f2a65a", better: "lower", format: (value) => `${Math.round(value)}` },
        ],
      })}

      ${renderTrendChart({
        chartId: "history-topology",
        title: "Évolution topologie graphe",
        subtitle: "Variation des nœuds et des liens d’architecture (couplage global).",
        points: historyPoints,
        series: [
          { key: "graphNodes", label: "Nœuds", color: "#6ce6ad", better: "lower", format: (value) => `${Math.round(value)}` },
          { key: "graphEdges", label: "Liens", color: "#ffc36a", better: "lower", format: (value) => `${Math.round(value)}` },
        ],
      })}

      ${renderTrendChart({
        chartId: "machine-volume",
        title: "Évolution volume technique (snapshots récents)",
        subtitle: "Complexité opérationnelle: LOC, routes et couverture tests.",
        points: machinePoints,
        series: [
          { key: "loc", label: "LOC", color: "#5ec8ff", better: "lower", format: (value) => `${Math.round(value).toLocaleString()}` },
          { key: "routes", label: "Routes", color: "#f88377", better: "lower", format: (value) => `${Math.round(value)}` },
          { key: "tests", label: "Tests", color: "#31c2a0", better: "higher", format: (value) => `${Math.round(value)}` },
        ],
        emptyLabel: "Pas assez de snapshots récents pour tracer LOC/routes/tests.",
      })}

      ${renderTrendChart({
        chartId: "focus-domains",
        title: "Trajectoire des domaines à surveiller",
        subtitle: "Les domaines Focus sont suivis ici pour valider l'amélioration dans le temps.",
        points: historyPoints,
        series: domainSeries,
        emptyLabel: "Pas assez de données domaines pour tracer la trajectoire Focus.",
      })}
    </section>
  `;
}

function renderTrendsCorrelation() {
  const projection = getTrendsCorrelation();
  if (!projection) {
    return `
      <section class="card" style="margin-top:12px">
        <h3>Corrélation 7/30/90</h3>
        <div class="detail-item">Projection indisponible: exécuter <span class="mono">npm run generate:trends</span>.</div>
      </section>
    `;
  }

  const windows = projection.windows || {};
  const windowRows = ["7d", "30d", "90d"]
    .map((key) => ({ key, row: windows[key] || null }))
    .filter((entry) => entry.row);
  const events = Array.isArray(projection.notableEvents) ? projection.notableEvents.slice(0, 10) : [];

  return `
    <section class="card" style="margin-top:12px">
      <h3>Corrélation temporelle 7/30/90</h3>
      <p class="matrix-subtitle">Lecture causale: quoi a changé, quand, et quel impact sur la santé architecture.</p>
      <div class="correlation-grid">
        ${
          windowRows.length
            ? windowRows
                .map(({ key, row }) => `
              <article class="correlation-window-card">
                <div class="section-head">
                  <strong>${safe(key)}</strong>
                  <span class="badge ${row.impactLevel === "high" ? "fail" : row.impactLevel === "medium" ? "warn" : "pass"}">${safe(row.impactLevel)} · ${row.impactScore}</span>
                </div>
                <div class="mono">from=${safe(formatMediumDate(row.fromGeneratedAt))} → to=${safe(formatMediumDate(row.toGeneratedAt))}</div>
                <div class="domain-master-kpis mono">
                  <span>score=${row.deltas.avgScoreDelta > 0 ? "+" : ""}${row.deltas.avgScoreDelta}</span>
                  <span>gaps=${row.deltas.gapDelta > 0 ? "+" : ""}${row.deltas.gapDelta}</span>
                  <span>edges=${row.deltas.graphEdgesDelta > 0 ? "+" : ""}${row.deltas.graphEdgesDelta}</span>
                </div>
                <div class="correlation-read">${safe(row.causalRead || "n/d")}</div>
              </article>
            `)
                .join("")
            : '<div class="detail-item">Aucune fenêtre de corrélation disponible.</div>'
        }
      </div>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Instant</th>
            <th>Changement marquant</th>
            <th>Impact</th>
            <th>Deltas</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${
            events.length
              ? events
                  .map((event) => `
                <tr>
                  <td>${safe(formatMediumDate(event.timestamp))}</td>
                  <td>${safe(event.whatChanged || "n/d")}</td>
                  <td><span class="badge ${event.impactLevel === "high" ? "fail" : event.impactLevel === "medium" ? "warn" : "pass"}">${safe(event.impactLevel)} · ${event.impactScore}</span></td>
                  <td class="mono">
                    score=${event.signals?.avgScoreDelta > 0 ? "+" : ""}${Number(event.signals?.avgScoreDelta || 0)}
                    · gaps=${event.signals?.gapDelta > 0 ? "+" : ""}${Number(event.signals?.gapDelta || 0)}
                    · edges=${event.signals?.graphEdgesDelta > 0 ? "+" : ""}${Number(event.signals?.graphEdgesDelta || 0)}
                  </td>
                  <td class="mono">${safe(event.source?.currentSnapshotFile || "n/d")}</td>
                </tr>
              `)
                  .join("")
              : '<tr><td colspan="5" class="mono">Aucun événement marquant détecté.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

function countAlertsBySeverity(alerts) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  (alerts || []).forEach((alert) => {
    const key = String(alert?.severity || "low");
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
  });
  return counts;
}

function buildViewIndicators(data) {
  if (!data) return {};
  const rows = architectureRows(data);
  const portfolioRows = buildPortfolioRows(data);
  const auditIndex = resolveAuditIndex(data, state.history);
  const alerts = buildArchitectureAlerts(data);
  const severity = countAlertsBySeverity(alerts);
  const snapshotsCount = Array.isArray(state.history?.snapshots) ? state.history.snapshots.length : 0;
  const averageScore = Math.round(average(rows.map((row) => row.score || 0)));
  const pendingRoadmap = (data.roadmap || []).filter((step) => String(step.status || "").toLowerCase() !== "done").length;
  const portfolioHot = portfolioRows.filter((row) => row.risk >= 55).length;
  const evidenceCount = Array.isArray(auditIndex?.artifacts) ? auditIndex.artifacts.length : 0;

  return {
    overview: `${averageScore}/100`,
    alerts: `${severity.critical + severity.high}`,
    portfolio: `${portfolioHot}`,
    history: `${snapshotsCount}`,
    domains: `${data.domainProfiles?.length || 0}`,
    projections: `${data.projectionRegistry?.length || 0}`,
    evidence: `${evidenceCount}`,
    graph: `${data.graph?.nodes?.length || 0}`,
    radar: `${data.domainProfiles?.length || 0}`,
    roadmap: `${pendingRoadmap}`,
  };
}

function renderNav() {
  const nav = document.getElementById("nav");
  const indicators = buildViewIndicators(state.data);
  const visibleViews = buildVisibleViews();
  nav.innerHTML = `
    <h3>Vues Atlas</h3>
    ${VIEW_GROUPS.map((group) => {
      const views = visibleViews.filter((view) => view.group === group.id);
      if (!views.length) return "";
      return `
        <div class="nav-group">
          <div class="nav-group-title">${safe(group.label)}</div>
          ${views
            .map(
              (view) => `
            <button class="${state.activeView === view.id ? "active" : ""}" data-view="${view.id}" data-kpi-event="navigation" data-kpi-view="${view.id}">
              <span class="nav-btn-content">
                ${iconSvg(view.icon, "nav-icon")}
                <span class="nav-label-wrap">
                  <span>${safe(view.label)}</span>
                  <span class="nav-hint">${safe(view.hint || "")}</span>
                </span>
              </span>
              <span class="nav-metric">${safe(indicators[view.id] || "0")}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `;
    }).join("")}
  `;
  nav.querySelectorAll("button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      render();
    });
  });
}

function renderDoctrineBanner() {
  if (runtime.embedded) return "";
  return `
    <section class="card doctrine-banner">
      <strong>${iconSvg("layers", "inline-icon")} Le Core décide. Les projections expliquent. Les apps affichent.</strong>
      <span class="doctrine-sub">Le cockpit signale toute reconstruction métier locale, write-path parallèle et projection non canonique.</span>
    </section>
  `;
}

function renderMigrationBanner() {
  if (runtime.embedded) return "";
  const flags = getRolloutFlags();
  const mode = flags.cockpitV3Enabled ? "v3-active" : "legacy-bridge";
  const visibleViews = buildVisibleViews(flags);
  const disabled = [];
  if (!flags.cockpitV3Enabled) disabled.push("cockpit_v3");
  if (!flags.evidenceSpaceEnabled) disabled.push("evidence");
  if (!flags.secondaryInvestigationEnabled) disabled.push("investigation");
  if (!flags.decisionKpiEnabled) disabled.push("decision_kpi");
  const rollbackSummary = disabled.length ? `Rollback actif: ${disabled.join(", ")}` : "Rollback actif: aucun";

  return `
    <section class="card migration-banner">
      <div class="section-head">
        <h3>Migration IA Atlas (legacy -> V3)</h3>
        <span class="badge ${mode === "v3-active" ? "pass" : "warn"}">${mode}</span>
      </div>
      <div class="mono">
        vues=${visibleViews.map((view) => view.id).join(", ")} · flags: cockpit_v3=${flags.cockpitV3Enabled} · evidence=${flags.evidenceSpaceEnabled} · investigation=${flags.secondaryInvestigationEnabled} · decision_kpi=${flags.decisionKpiEnabled}
      </div>
      <div class="mono">${safe(rollbackSummary)}</div>
      <table style="margin-top:8px">
        <thead>
          <tr>
            <th>Legacy tab</th>
            <th>Layer V3</th>
            <th>Raison</th>
          </tr>
        </thead>
        <tbody>
          ${LEGACY_TAB_MAPPING
            .map(
              (row) => `
            <tr>
              <td class="mono">${safe(row.legacyTab)}</td>
              <td class="mono">${safe(row.v3Layer)}</td>
              <td>${safe(row.rationale)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <div class="migration-links">
        <a class="mono" href="./docs/migration-plan.md" target="_blank" rel="noreferrer noopener">migration-plan.md</a>
        <a class="mono" href="./docs/rollout-flags.md" target="_blank" rel="noreferrer noopener">rollout-flags.md</a>
      </div>
    </section>
  `;
}

function renderExecutiveBoard(data) {
  const rows = architectureRows(data);
  const alerts = buildArchitectureAlerts(data);
  const severity = countAlertsBySeverity(alerts);
  const driftSummary = state.driftReport?.summary || { domainsWithDrift: 0, totalFindings: 0, criticalDomains: [] };
  const averageScore = Math.round(average(rows.map((row) => row.score || 0)));
  const projectedScores = (driftSummary.criticalDomains || [])
    .map((row) => Number(row.projectedScore))
    .filter((value) => Number.isFinite(value));
  const projectedMean = projectedScores.length ? Math.round(average(projectedScores)) : averageScore;
  const externalRisk = (data.externalServices || []).filter((service) => service.humanOnlyRisk).length;
  const highRiskDomains = (driftSummary.criticalDomains || []).slice(0, 3).map((row) => row.domain);

  return `
    <section class="executive-grid">
      <article class="card executive-card">
        <h3>État global</h3>
        <div class="executive-kpi">${averageScore}/100</div>
        <div class="executive-sub">Moyenne actuelle des domaines</div>
        <div class="executive-meta">Projection sous dérive: ${projectedMean}/100</div>
      </article>

      <article class="card executive-card">
        <h3>Pression opérationnelle</h3>
        <div class="executive-kpi">${severity.critical + severity.high}</div>
        <div class="executive-sub">Alertes critiques + hautes</div>
        <div class="executive-meta">critical=${severity.critical} · high=${severity.high}</div>
      </article>

      <article class="card executive-card">
        <h3>Dette architecture</h3>
        <div class="executive-kpi">${driftSummary.totalFindings}</div>
        <div class="executive-sub">Constats de dérive cumulés</div>
        <div class="executive-meta">Domaines touchés: ${driftSummary.domainsWithDrift}</div>
      </article>

      <article class="card executive-card">
        <h3>Risque fournisseur</h3>
        <div class="executive-kpi">${externalRisk}</div>
        <div class="executive-sub">Services Human-Only exposés</div>
        <div class="executive-meta">${highRiskDomains.length ? `Focus: ${safe(highRiskDomains.join(", "))}` : "Pas de domaine critique identifié."}</div>
      </article>
    </section>
  `;
}

function renderExecutiveTrendPreview() {
  const historyPoints = trimTrendPoints(buildHistoryTrendPoints());
  return `
    <section style="margin-top:12px">
      ${renderTrendWindowControls(historyPoints)}
      ${renderTrendChart({
        chartId: "overview-preview",
        title: "Tendance globale (visible immédiatement)",
        subtitle: "Évolution score moyen, dette (gaps) et pression fournisseur sur les derniers snapshots.",
        points: historyPoints,
        series: [
          { key: "avgScore", label: "Score moyen", color: "#4fd18b", better: "higher", format: (value) => `${Math.round(value)}/100` },
          { key: "gaps", label: "Écarts", color: "#ef6c57", better: "lower", format: (value) => `${Math.round(value)}` },
          { key: "services", label: "Services externes", color: "#f2a65a", better: "lower", format: (value) => `${Math.round(value)}` },
        ],
        emptyLabel: "Historique insuffisant pour afficher la tendance globale.",
      })}
    </section>
  `;
}

function renderDecisionKpiDashboard() {
  const contract = resolveDecisionKpiContract();
  const telemetry = computeDecisionKpiAggregate(contract);
  const session = telemetry.currentSummary;

  const sessionRows = [
    {
      label: "time-to-first-priority",
      value: session?.firstPrioritySec,
      target: contract.targets.timeToFirstPrioritySec,
      mode: "max",
      format: formatDecisionSeconds,
    },
    {
      label: "time-to-rationale",
      value: session?.firstRationaleSec,
      target: contract.targets.timeToRationaleSec,
      mode: "max",
      format: formatDecisionSeconds,
    },
    {
      label: "clicks-to-owner-action",
      value: session?.firstOwnerActionClicks,
      target: contract.targets.clicksToOwnerAction,
      mode: "max",
      format: formatDecisionClicks,
    },
    {
      label: "drilldown-rate",
      value: session?.drilldownRate,
      target: contract.targets.drilldownRateMin,
      mode: "min",
      format: formatDecisionRate,
    },
  ];

  const baselineBefore = contract.baselineBeforeRefactor;
  const baselineAfter = contract.postRefactorBaseline;
  const aggregate = telemetry.aggregate;

  const compareLine = (label, key, format, mode = "max", targetKey = key) => {
    const before = asFiniteNumber(baselineBefore?.[key]);
    const after = asFiniteNumber(baselineAfter?.[key]);
    const observed = asFiniteNumber(aggregate?.[key]);
    const target = asFiniteNumber(contract.targets?.[targetKey]);
    const status = key === "drilldownRate" ? decisionKpiStatus(observed, target, "min") : decisionKpiStatus(observed, target, mode);
    const delta = Number.isFinite(before) && Number.isFinite(observed) ? Number((observed - before).toFixed(2)) : null;
    const deltaClass =
      delta === null
        ? "warn"
        : mode === "max"
          ? delta <= 0
            ? "pass"
            : "fail"
          : delta >= 0
            ? "pass"
            : "fail";
    const deltaLabel =
      delta === null
        ? "n/d"
        : `${delta > 0 ? "+" : ""}${mode === "min" ? formatDecisionRate(delta) : delta.toFixed(2)}${mode === "max" ? "" : ""}`;

    return `
      <tr>
        <td>${safe(label)}</td>
        <td class="mono">${safe(format(before))}</td>
        <td class="mono">${safe(format(after))}</td>
        <td class="mono">${safe(format(observed))}</td>
        <td class="mono">${safe(format(target))}</td>
        <td><span class="badge ${status}">${status}</span></td>
        <td><span class="badge ${deltaClass}">${safe(deltaLabel)}</span></td>
      </tr>
    `;
  };

  return `
    <section class="card decision-kpi-card" style="margin-top:12px">
      <div class="section-head">
        <h3>KPI décision (30s/60s/2 clics)</h3>
        <span class="mono">session=${safe(session?.id || "n/d")} · interactions=${Number(session?.interactionCount || 0)}</span>
      </div>
      <p class="matrix-subtitle">Instrumentation UX locale: priorité, rationale, owner-action, drilldown. Baseline avant/après + cible opératoire.</p>
      <div class="decision-kpi-summary">
        <span class="mono">sessions agrégées=${telemetry.aggregate.sampleSize}</span>
        <span class="mono">success-rate cibles=${formatDecisionRate(telemetry.successRate)}</span>
        <span class="mono">source=${safe(contract.source)}</span>
        <button type="button" class="inline-btn" data-kpi-reset data-kpi-event="navigation" data-kpi-view="${safe(state.activeView)}">Réinitialiser session KPI</button>
      </div>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Métrique session</th>
            <th>Valeur</th>
            <th>Cible</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${sessionRows
            .map((row) => {
              const status = decisionKpiStatus(row.value, row.target, row.mode);
              const valueLabel = Number.isFinite(Number(row.value)) ? row.format(row.value) : "en attente";
              const targetLabel = row.format(row.target);
              return `
                <tr>
                  <td>${safe(row.label)}</td>
                  <td class="mono">${safe(valueLabel)}</td>
                  <td class="mono">${safe(targetLabel)}</td>
                  <td><span class="badge ${status}">${Number.isFinite(Number(row.value)) ? status : "pending"}</span></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>

      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Baseline/impact</th>
            <th>Avant refonte</th>
            <th>Après refonte</th>
            <th>Observé (20 sessions)</th>
            <th>Cible</th>
            <th>Statut</th>
            <th>Delta vs avant</th>
          </tr>
        </thead>
        <tbody>
          ${compareLine("time-to-first-priority (s)", "timeToFirstPrioritySec", formatDecisionSeconds, "max")}
          ${compareLine("time-to-rationale (s)", "timeToRationaleSec", formatDecisionSeconds, "max")}
          ${compareLine("clicks-to-owner-action", "clicksToOwnerAction", formatDecisionClicks, "max")}
          ${compareLine("drilldown-rate", "drilldownRate", formatDecisionRate, "min", "drilldownRateMin")}
        </tbody>
      </table>
      <div class="mono decision-kpi-footnote">
        baseline-before sample=${Number(baselineBefore?.sampleSize || 0)} · baseline-after sample=${Number(baselineAfter?.sampleSize || 0)} · report-generatedAt=${safe(contract.generatedAt || "n/d")}
      </div>
    </section>
  `;
}

function buildTopActionItems(data, limit = 5) {
  const alerts = buildArchitectureAlerts(data)
    .filter((row) => normalizeAlertState(row.state) !== "done")
    .sort((a, b) => Number(b.priorityScore || 0) - Number(a.priorityScore || 0));
  return alerts.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    id: String(row.id || `${row.domain}:${index}`),
    domain: String(row.domain || "platform"),
    type: String(row.type || "unknown"),
    severity: String(row.severity || "medium"),
    state: normalizeAlertState(row.state),
    priorityScore: Number(row.priorityScore || 0),
    why: String(row.explanation || "Signal opérationnel prioritaire."),
    impact: String(row.projectedImpact || "n/d"),
    owner: String(row.owner || "atlas-ops"),
    action: String(row.action || "Traiter l'alerte selon le playbook Atlas."),
    proofLink: String(row.proofLink || ""),
  }));
}

function renderTopActionsNow(data) {
  const items = buildTopActionItems(data, 5);
  return `
    <section class="card" style="margin-top:12px">
      <div class="section-head">
        <h3>Top 5 actions maintenant</h3>
        <button class="inline-btn" type="button" data-switch-view="alerts" data-kpi-event="priority,navigation" data-kpi-view="alerts">Ouvrir la queue alertes</button>
      </div>
      <div class="top-actions-grid">
        ${
          items.length
            ? items
                .map((item) => {
                  const proofHref = resolveProofHref(item.proofLink);
                  return `
                    <article class="top-action-card" data-kpi-event="priority" data-kpi-domain="${safe(item.domain)}">
                      <div class="top-action-head">
                        <strong>#${item.rank} ${safe(item.domain)} · ${safe(item.type)}</strong>
                        <span class="badge ${item.severity === "critical" ? "fail" : item.severity === "high" ? "warn" : "pass"}">${safe(item.severity)} · ${item.priorityScore}</span>
                      </div>
                      <div class="top-action-why">${safe(item.why)}</div>
                      <div class="top-action-meta">
                        <span>impact=${safe(item.impact)}</span>
                        <span>owner=${safe(item.owner)}</span>
                        <span>state=${safe(alertStateLabel(item.state))}</span>
                      </div>
                      <div class="top-action-action">${safe(item.action)}</div>
                      <div class="top-action-links">
                        ${
                          proofHref
                            ? `<a class="mono" href="${safe(proofHref)}" target="_blank" rel="noreferrer noopener" data-kpi-event="priority,rationale,drilldown" data-kpi-domain="${safe(item.domain)}">Voir preuves</a>`
                            : `<span class="mono">${safe(item.proofLink || "Preuve n/d")}</span>`
                        }
                      </div>
                    </article>
                  `;
                })
                .join("")
            : '<div class="detail-item">Aucune action ouverte dans la queue actuelle.</div>'
        }
      </div>
    </section>
  `;
}

function classifyPortfolioQuadrant(risk, importance) {
  if (risk >= 55 && importance >= 70) return "agir-maintenant";
  if (risk >= 55) return "stabiliser";
  if (importance >= 70) return "extraire";
  return "hold";
}

function buildDomainScoreHistoryMap() {
  const snapshots = Array.isArray(state.history?.snapshots) ? [...state.history.snapshots] : [];
  snapshots.sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime());
  const map = new Map();
  for (const snapshot of snapshots) {
    const generatedAt = snapshot?.generatedAt;
    const domainScores = snapshot?.summary?.domainScores || {};
    for (const [domain, rawScore] of Object.entries(domainScores)) {
      const key = String(domain || "").toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        generatedAt,
        score: Number(rawScore || 0),
      });
    }
  }
  return map;
}

function buildPortfolioRows(data) {
  const ownerByDomain = new Map(
    (data?.domainOwnership || []).map((row) => [String(row?.domain || "").toLowerCase(), String(row?.owner || "atlas-ops")])
  );
  const decisionPriorityByDomain = new Map(
    (data?.decisionPriority?.domains || []).map((row) => [String(row?.domain || "").toLowerCase(), row])
  );
  const domainWindows = getTrendsCorrelation()?.domainWindows || {};
  const scoreHistoryByDomain = buildDomainScoreHistoryMap();

  const rows = architectureRows(data).map((row) => {
    const domain = String(row.domain || "unknown").toLowerCase();
    const priority = decisionPriorityByDomain.get(domain);
    const drift = getDriftDomain(domain);
    const risk = Number(priority?.score || row.decisionPriority || computeFallbackDecisionPriority(row));
    const importance = Number(priority?.signals?.strategicImportance || 0);
    const owner = ownerByDomain.get(domain) || "atlas-ops";
    const driftFindings = Number(priority?.signals?.driftFindings ?? drift?.totalFindings ?? 0);
    const policyViolations = Number(priority?.signals?.policyViolationCount ?? drift?.ownershipViolations ?? 0);
    const crossDomainImports = Number(priority?.signals?.crossDomainImports ?? drift?.crossDomainImports ?? 0);
    const consumers = Number(priority?.signals?.consumers ?? (row.consumers || []).length);
    const gaps = Number(priority?.signals?.gapCount || 0);
    const scoreNow = Number(priority?.signals?.currentScore ?? row.score ?? 0);
    const projectedScore = Number(priority?.signals?.projectedScore ?? drift?.healthImpact?.projectedScore ?? scoreNow);
    const windows = domainWindows[domain] || {};
    const d7 = Number(windows["7d"]?.scoreDelta || 0);
    const d30 = Number(windows["30d"]?.scoreDelta || 0);
    const d90 = Number(windows["90d"]?.scoreDelta || 0);
    const quadrant = classifyPortfolioQuadrant(risk, importance);
    const recommendation =
      quadrant === "agir-maintenant" || quadrant === "stabiliser"
        ? "stabilize-first"
        : quadrant === "extraire"
          ? "extract"
          : "hold";
    const stabilityRaw =
      scoreNow * 0.5 +
      Math.max(0, 100 - risk) * 0.25 +
      Math.max(0, 100 - driftFindings * 12) * 0.15 +
      Math.max(-20, Math.min(20, d30 * 3 + d90 * 1.5));
    const stabilityIndex = Number(Math.max(0, Math.min(100, stabilityRaw)).toFixed(1));
    return {
      domain,
      owner,
      priorityRank: Number(priority?.rank || row.decisionPriorityRank || 0) || null,
      priorityScore: Number(risk.toFixed(1)),
      risk: Number(risk.toFixed(1)),
      importance: Number(importance.toFixed(1)),
      scoreNow: Number(scoreNow.toFixed(1)),
      projectedScore: Number(projectedScore.toFixed(1)),
      driftFindings,
      policyViolations,
      crossDomainImports,
      consumers,
      gaps,
      d7: Number(d7.toFixed(1)),
      d30: Number(d30.toFixed(1)),
      d90: Number(d90.toFixed(1)),
      quadrant,
      recommendation,
      stabilityIndex,
      scoreHistory: scoreHistoryByDomain.get(domain) || [],
    };
  });

  return rows.sort((a, b) => {
    const rankA = a.priorityRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.priorityRank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    if (b.risk !== a.risk) return b.risk - a.risk;
    if (b.importance !== a.importance) return b.importance - a.importance;
    return a.domain.localeCompare(b.domain);
  });
}

function scoreToTone(value, { goodWhenHigh = false, medium = 45, high = 70 } = {}) {
  const num = Number(value || 0);
  if (goodWhenHigh) {
    if (num >= high) return "pass";
    if (num >= medium) return "warn";
    return "fail";
  }
  if (num >= high) return "fail";
  if (num >= medium) return "warn";
  return "pass";
}

function trendTone(delta) {
  const value = Number(delta || 0);
  if (value >= 1) return "pass";
  if (value <= -1) return "fail";
  return "warn";
}

function formatCompactNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/d";
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function renderSignalCell(value, label, options = {}) {
  const tone = scoreToTone(value, options);
  return `<td class="portfolio-heat-cell ${tone}" title="${safe(label)}"><span class="mono">${safe(formatCompactNumber(value))}</span></td>`;
}

function renderPortfolioSparkline(points) {
  if (!Array.isArray(points) || points.length < 2) return '<span class="mono">n/d</span>';
  const width = 140;
  const height = 38;
  const padding = { top: 5, right: 4, bottom: 5, left: 4 };
  const values = points.map((point) => Number(point.score || 0));
  const geometry = computeSeriesGeometry(values, width, height, padding);
  if (!geometry.length) return '<span class="mono">n/d</span>';
  const path = geometry.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const first = Number(values[0] || 0);
  const last = Number(values[values.length - 1] || 0);
  const delta = Number((last - first).toFixed(1));
  const tone = trendTone(delta);
  const final = geometry[geometry.length - 1];
  return `
    <div class="portfolio-sparkline-wrap">
      <svg class="portfolio-sparkline ${tone}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend sparkline">
        <path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
        <circle cx="${final.x}" cy="${final.y}" r="2.8" fill="currentColor"></circle>
      </svg>
      <span class="badge ${tone}">Δ ${safe(formatSigned(delta))}</span>
    </div>
  `;
}

function renderPortfolioHeatmap(rows) {
  const targetRows = rows.slice(0, 10);
  return `
    <section class="card" style="margin-top:12px">
      <h3>Heatmap domaine × signaux</h3>
      <table class="portfolio-heatmap">
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Risque</th>
            <th>Importance</th>
            <th>Dérive</th>
            <th>Violations</th>
            <th>Imports X-domain</th>
            <th>Score courant</th>
            <th>Delta 30j</th>
          </tr>
        </thead>
        <tbody>
          ${
            targetRows.length
              ? targetRows
                  .map(
                    (row) => `
                <tr>
                  <td><strong>${safe(row.domain)}</strong></td>
                  ${renderSignalCell(row.risk, `Risque ${row.domain}`, { goodWhenHigh: false, medium: 40, high: 55 })}
                  ${renderSignalCell(row.importance, `Importance ${row.domain}`, { goodWhenHigh: false, medium: 60, high: 75 })}
                  ${renderSignalCell(row.driftFindings, `Dérive ${row.domain}`, { goodWhenHigh: false, medium: 1, high: 3 })}
                  ${renderSignalCell(row.policyViolations, `Violations ${row.domain}`, { goodWhenHigh: false, medium: 1, high: 2 })}
                  ${renderSignalCell(row.crossDomainImports, `Cross-domain imports ${row.domain}`, { goodWhenHigh: false, medium: 1, high: 3 })}
                  ${renderSignalCell(row.scoreNow, `Score courant ${row.domain}`, { goodWhenHigh: true, medium: 75, high: 88 })}
                  <td class="portfolio-heat-cell ${trendTone(row.d30)}"><span class="mono">${safe(formatSigned(row.d30))}</span></td>
                </tr>
              `
                  )
                  .join("")
              : '<tr><td colspan="8" class="mono">Aucun domaine sur ce filtre.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

function renderPortfolioScatter(rows) {
  const points = rows.slice(0, 16);
  if (!points.length) {
    return `
      <section class="card" style="margin-top:12px">
        <h3>Scatter importance × risque</h3>
        <div class="detail-item">Aucune donnée disponible.</div>
      </section>
    `;
  }

  const width = 900;
  const height = 300;
  const padding = { top: 18, right: 18, bottom: 40, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (value) => padding.left + (Math.max(0, Math.min(100, Number(value || 0))) / 100) * innerWidth;
  const y = (value) => height - padding.bottom - (Math.max(0, Math.min(100, Number(value || 0))) / 100) * innerHeight;
  const pointColor = (quadrant) =>
    quadrant === "agir-maintenant" ? "#ff8372" : quadrant === "stabiliser" ? "#f7c46f" : quadrant === "extraire" ? "#85d3ff" : "#75d9a9";

  return `
    <section class="card" style="margin-top:12px">
      <h3>Scatter importance stratégique × risque</h3>
      <svg class="portfolio-scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="Scatter portefeuille">
        <rect x="${padding.left}" y="${padding.top}" width="${innerWidth}" height="${innerHeight}" rx="8" fill="#102a34"></rect>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#3c6573" stroke-width="1"></line>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#3c6573" stroke-width="1"></line>
        <line x1="${x(70)}" y1="${padding.top}" x2="${x(70)}" y2="${height - padding.bottom}" stroke="#5a8898" stroke-dasharray="5 5" stroke-width="1"></line>
        <line x1="${padding.left}" y1="${y(55)}" x2="${width - padding.right}" y2="${y(55)}" stroke="#5a8898" stroke-dasharray="5 5" stroke-width="1"></line>
        ${points
          .map((row) => {
            const cx = x(row.importance);
            const cy = y(row.risk);
            const radius = Math.max(4, Math.min(9, 3 + row.consumers));
            return `
              <g>
                <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${pointColor(row.quadrant)}" fill-opacity="0.92" stroke="#e9fbff" stroke-width="1.2">
                  <title>${safe(`${row.domain} · risk=${row.risk} · importance=${row.importance}`)}</title>
                </circle>
                <text x="${cx + 8}" y="${cy - 8}" fill="#d7ebf2" font-size="11">${safe(row.domain)}</text>
              </g>
            `;
          })
          .join("")}
        <text x="${padding.left}" y="${height - 10}" fill="#9db2bb" font-size="11">Importance stratégique →</text>
        <text x="10" y="${padding.top + 10}" fill="#9db2bb" font-size="11">Risque ↑</text>
      </svg>
      <div class="portfolio-scatter-legend mono">
        seuils: importance=70 · risque=55 · quadrants: agir-maintenant / stabiliser / extraire / hold
      </div>
    </section>
  `;
}

function renderPortfolioSparklines(rows) {
  const targetRows = rows.slice(0, 8);
  return `
    <section class="card" style="margin-top:12px">
      <h3>Sparklines domaines</h3>
      <div class="portfolio-sparkline-grid">
        ${
          targetRows.length
            ? targetRows
                .map(
                  (row) => `
              <article class="portfolio-sparkline-card">
                <div class="section-head">
                  <strong>${safe(row.domain)}</strong>
                  <span class="badge ${trendTone(row.d30)}">30j ${safe(formatSigned(row.d30))}</span>
                </div>
                ${renderPortfolioSparkline(row.scoreHistory)}
                <div class="mono">7j=${safe(formatSigned(row.d7))} · 90j=${safe(formatSigned(row.d90))} · score=${safe(formatCompactNumber(row.scoreNow))}</div>
              </article>
            `
                )
                .join("")
            : '<div class="detail-item">Sparklines indisponibles.</div>'
        }
      </div>
    </section>
  `;
}

function renderPortfolioReferences(rows) {
  const references = rows
    .filter((row) => row.scoreNow >= 90 && row.risk <= 45 && row.driftFindings <= 1 && row.policyViolations === 0 && row.d30 >= 0)
    .sort((a, b) => b.stabilityIndex - a.stabilityIndex)
    .slice(0, 5);

  return `
    <section class="card" style="margin-top:12px">
      <h3>Domaines modèles (références de stabilité)</h3>
      <div class="portfolio-reference-grid">
        ${
          references.length
            ? references
                .map(
                  (row) => `
              <article class="portfolio-reference-card">
                <div class="section-head">
                  <strong>${safe(row.domain)}</strong>
                  <span class="badge pass">stability ${safe(formatCompactNumber(row.stabilityIndex))}</span>
                </div>
                <div class="mono">score=${safe(formatCompactNumber(row.scoreNow))} · risk=${safe(formatCompactNumber(row.risk))} · d30=${safe(formatSigned(row.d30))}</div>
                <div class="portfolio-reference-why">Pourquoi modèle: dérive faible, discipline stable, trajectoire non dégradée.</div>
              </article>
            `
                )
                .join("")
            : '<div class="detail-item">Aucun domaine modèle strict sur le snapshot courant.</div>'
        }
      </div>
    </section>
  `;
}

function renderPortfolioView(data) {
  const rows = buildPortfolioRows(data);
  const filter = String(state.portfolioQuadrantFilter || "all");
  const filteredRows = filter === "all" ? rows : rows.filter((row) => row.quadrant === filter);
  const highRiskCount = rows.filter((row) => row.risk >= 55).length;

  return `
    <section class="card" style="margin-top:12px">
      <div class="section-head">
        <h3>Portfolio manager/architecte</h3>
        <span class="mono">domaines=${rows.length} · high-risk=${highRiskCount}</span>
      </div>
      <p class="matrix-subtitle">Vue dédiée d'arbitrage: prioriser, qualifier, puis décider <span class="mono">stabilize-first</span> vs <span class="mono">extract</span>.</p>
      <div class="portfolio-toolbar">
        <label class="mono" for="portfolio-quadrant-filter">Filtre quadrant</label>
        <select id="portfolio-quadrant-filter" data-portfolio-filter>
          <option value="all" ${filter === "all" ? "selected" : ""}>Tous</option>
          <option value="agir-maintenant" ${filter === "agir-maintenant" ? "selected" : ""}>agir-maintenant</option>
          <option value="stabiliser" ${filter === "stabiliser" ? "selected" : ""}>stabiliser</option>
          <option value="extraire" ${filter === "extraire" ? "selected" : ""}>extraire</option>
          <option value="hold" ${filter === "hold" ? "selected" : ""}>hold</option>
        </select>
        <button class="inline-btn" type="button" data-switch-view="domains" data-kpi-event="navigation,priority" data-kpi-view="domains">Ouvrir diagnostics domaine</button>
      </div>
      <table class="portfolio-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Domaine</th>
            <th>Priorité</th>
            <th>Importance</th>
            <th>Trajectoire 7/30/90</th>
            <th>Quadrant</th>
            <th>Owner</th>
            <th>Décision</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredRows.length
              ? filteredRows
                  .slice(0, 16)
                  .map(
                    (row, index) => `
                <tr>
                  <td class="mono">${row.priorityRank || index + 1}</td>
                  <td><strong>${safe(row.domain)}</strong></td>
                  <td class="${row.risk >= 55 ? "risk-high" : ""}">${safe(formatCompactNumber(row.priorityScore))}</td>
                  <td>${safe(formatCompactNumber(row.importance))}</td>
                  <td class="mono">${safe(formatSigned(row.d7))} / ${safe(formatSigned(row.d30))} / ${safe(formatSigned(row.d90))}</td>
                  <td><span class="badge ${row.quadrant === "agir-maintenant" ? "fail" : row.quadrant === "stabiliser" ? "warn" : "pass"}">${safe(row.quadrant)}</span></td>
                  <td>${safe(row.owner)}</td>
                  <td><span class="mono">${safe(row.recommendation)}</span></td>
                </tr>
              `
                  )
                  .join("")
              : '<tr><td colspan="8" class="mono">Aucun domaine sur ce filtre.</td></tr>'
          }
        </tbody>
      </table>
    </section>
    ${renderPortfolioHeatmap(filteredRows)}
    ${renderPortfolioScatter(filteredRows)}
    ${renderPortfolioSparklines(filteredRows)}
    ${renderPortfolioReferences(filteredRows)}
  `;
}

function renderPortfolioRiskImportance(data) {
  const rows = buildPortfolioRows(data).slice(0, 8);
  return `
    <section class="card" style="margin-top:12px">
      <h3>Portefeuille risque × importance</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Risque décisionnel</th>
            <th>Importance stratégique</th>
            <th>Quadrant</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td class="${row.risk >= 55 ? "risk-high" : ""}">${safe(formatCompactNumber(row.risk))}</td>
                  <td>${safe(formatCompactNumber(row.importance))}</td>
                  <td><span class="badge ${row.quadrant === "agir-maintenant" ? "fail" : row.quadrant === "stabiliser" ? "warn" : "pass"}">${safe(row.quadrant)}</span></td>
                  <td>${safe(row.owner)}</td>
                </tr>
              `
                  )
                  .join("")
              : '<tr><td colspan="5" class="mono">Portfolio indisponible.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

function renderWhatChanged(data) {
  const snapshots = Array.isArray(state.history?.snapshots) ? state.history.snapshots : [];
  const trends = getTrendsCorrelation();
  const latestEvent = Array.isArray(trends?.notableEvents) ? trends.notableEvents[0] : null;
  const current = snapshots.at(-1);
  const previous = snapshots.at(-2);
  if (!current) {
    return `
      <section class="card" style="margin-top:12px">
        <h3>Ce qui a changé</h3>
        <div class="detail-item">Aucun snapshot historique disponible.</div>
      </section>
    `;
  }

  const currentSummary = current.summary || {};
  const previousSummary = previous?.summary || {};
  const deltaGaps = Number(currentSummary.gapCount || 0) - Number(previousSummary.gapCount || 0);
  const deltaEdges = Number(currentSummary.graphEdges || 0) - Number(previousSummary.graphEdges || 0);
  const deltaServices = Number(currentSummary.servicesCount || 0) - Number(previousSummary.servicesCount || 0);
  const currentAlerts = buildArchitectureAlerts(data).filter((row) => normalizeAlertState(row.state) !== "done").length;
  const scoreChanges = Object.entries(currentSummary.domainScores || {})
    .map(([domain, score]) => {
      const prevScore = Number(previousSummary.domainScores?.[domain] || score);
      const nowScore = Number(score || 0);
      return { domain, nowScore, delta: nowScore - prevScore };
    })
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  return `
    <section class="card" style="margin-top:12px">
      <h3>Ce qui a changé</h3>
      <div class="changes-grid">
        <article class="change-card">
          <div class="change-label">Dernier snapshot</div>
          <div class="change-value">${safe(formatMediumDate(current.generatedAt))}</div>
          <div class="change-meta mono">${safe(formatShortTime(current.generatedAt))}</div>
        </article>
        <article class="change-card">
          <div class="change-label">Alertes actives</div>
          <div class="change-value ${currentAlerts > 0 ? "risk-high" : ""}">${currentAlerts}</div>
          <div class="change-meta mono">open + in-progress</div>
        </article>
        <article class="change-card">
          <div class="change-label">Delta gaps</div>
          <div class="change-value ${deltaGaps > 0 ? "risk-high" : ""}">${deltaGaps > 0 ? `+${deltaGaps}` : deltaGaps}</div>
          <div class="change-meta mono">vs snapshot précédent</div>
        </article>
        <article class="change-card">
          <div class="change-label">Delta graph edges</div>
          <div class="change-value">${deltaEdges > 0 ? `+${deltaEdges}` : deltaEdges}</div>
          <div class="change-meta mono">delta dépendances</div>
        </article>
        <article class="change-card">
          <div class="change-label">Delta services externes</div>
          <div class="change-value">${deltaServices > 0 ? `+${deltaServices}` : deltaServices}</div>
          <div class="change-meta mono">surface fournisseur</div>
        </article>
        <article class="change-card">
          <div class="change-label">Événement marquant</div>
          <div class="change-value">${latestEvent ? safe(latestEvent.impactLevel) : (scoreChanges.length ? "variation" : "stable")}</div>
          <div class="change-meta mono">
            ${
              latestEvent
                ? `${latestEvent.whatChanged} · impact=${latestEvent.impactScore}`
                : scoreChanges.length
                  ? scoreChanges.map((row) => `${row.domain}:${row.delta > 0 ? "+" : ""}${row.delta}`).join(" | ")
                  : "aucun changement de score"
            }
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderDataArchitectureBlueprint() {
  const profiles = Array.isArray(state.data?.domainProfiles) ? state.data.domainProfiles : [];
  const total = Math.max(profiles.length, 1);
  const ratio = (predicate) => Math.round((profiles.filter(predicate).length / total) * 100);
  const metrics = [
    {
      label: "Contrats d'abord",
      value: ratio((profile) => profile?.badges?.contractsFirst === "pass"),
      short: "contracts-first",
    },
    {
      label: "Write-path canonique",
      value: ratio((profile) => profile?.badges?.canonicalWritePath === "pass"),
      short: "write-path",
    },
    {
      label: "Projection canonique",
      value: ratio((profile) => profile?.badges?.projectionCanonical === "pass"),
      short: "projection",
    },
    {
      label: "Pas de duplication métier",
      value: ratio((profile) => profile?.badges?.noDuplicatedBusinessLogic === "pass"),
      short: "duplication",
    },
    {
      label: "Observabilité prête",
      value: ratio((profile) => profile?.badges?.otelReady === "pass"),
      short: "otel",
    },
    {
      label: "Modules prêts",
      value: ratio((profile) => profile?.badges?.moduleReady === "pass"),
      short: "module",
    },
  ];

  return `
    <section class="governance-grid">
      ${metrics
        .map((metric) => {
          const level = metric.value >= 85 ? "pass" : metric.value >= 70 ? "warn" : "fail";
          return `
            <article class="card governance-card">
              <div class="governance-head">
                <strong>${safe(metric.label)}</strong>
                <span class="badge ${level}">${metric.value}%</span>
              </div>
              <div class="governance-track"><div class="governance-fill ${level}" style="width:${metric.value}%"></div></div>
              <div class="governance-meta">Couverture domaines (${safe(metric.short)})</div>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function buildActionPlanner(data) {
  const { focus } = buildFocusInspirationLists(data);
  const criticalDomains = state.driftReport?.summary?.criticalDomains || [];
  const criticalByDomain = new Map(
    criticalDomains.map((entry) => [String(entry.domain).toLowerCase(), entry])
  );
  const hotspots = (data.repos || [])
    .flatMap((repo) =>
      (repo.hotspots || [])
        .slice(0, 4)
        .map((hotspot) => ({ repo: repo.name, ...hotspot }))
    )
    .sort((a, b) => Number(b.loc || 0) - Number(a.loc || 0))
    .slice(0, 4);
  const roadmap = [...(data.roadmap || [])].sort((a, b) => Number(b.readiness || 0) - Number(a.readiness || 0));

  const immediate = focus.slice(0, 4).map((item) => {
    const drift = criticalByDomain.get(String(item.domain).toLowerCase());
    const projected = drift?.projectedScore;
    const findings = drift?.totalFindings ?? item.driftFindings;
    return {
      title: `Stabiliser ${item.domain}`,
      why: `Score=${item.score}/100 · dérive=${findings}${typeof projected === "number" ? ` · projeté=${projected}/100` : ""}`,
      impact: "Réduction immédiate du risque d'architecture et des régressions sur ce domaine.",
    };
  });

  const structural = [
    ...roadmap
      .slice(0, 3)
      .map((step) => ({
        title: step.label,
        why: `${step.domain} · readiness=${step.readiness}/100 · statut=${step.status}`,
        impact: "Accélère la trajectoire V3 avec une extraction structurée et traçable.",
      })),
    ...hotspots.slice(0, 2).map((spot) => ({
      title: `Découper ${spot.repo}`,
      why: `${spot.file} (${spot.loc} LOC)`,
      impact: "Diminue le couplage local et facilite les tests ciblés.",
    })),
  ].slice(0, 5);

  return { immediate, structural };
}

function renderActionPlanner(data) {
  const plan = buildActionPlanner(data);
  const immediateTotal = Math.max(plan.immediate.length, 1);
  const structuralTotal = Math.max(plan.structural.length, 1);
  return `
    <section class="action-grid">
      <article class="card action-column">
        <h3>Plan immédiat (7 jours)</h3>
        <p class="action-subtitle">Priorités à impact rapide (moins de texte, plus d'action).</p>
        ${plan.immediate
          .map(
            (item, index) => `
          <div class="action-item">
            <div class="action-head">
              <strong>#${index + 1} ${safe(item.title)}</strong>
              <span class="badge ${index === 0 ? "fail" : index === 1 ? "warn" : "pass"}">P${index + 1}</span>
            </div>
            <div class="action-track"><div class="action-fill" style="width:${Math.max(24, Math.round(((immediateTotal - index) / immediateTotal) * 100))}%"></div></div>
            <div class="action-why">${safe(item.why)}</div>
          </div>
        `
          )
          .join("")}
      </article>

      <article class="card action-column">
        <h3>Plan structurant (30 jours)</h3>
        <p class="action-subtitle">Chantiers de fond pour améliorer durablement l'architecture.</p>
        ${plan.structural
          .map(
            (item, index) => `
          <div class="action-item">
            <div class="action-head">
              <strong>#${index + 1} ${safe(item.title)}</strong>
              <span class="badge ${index === 0 ? "warn" : "pass"}">S${index + 1}</span>
            </div>
            <div class="action-track"><div class="action-fill" style="width:${Math.max(20, Math.round(((structuralTotal - index) / structuralTotal) * 100))}%"></div></div>
            <div class="action-why">${safe(item.why)}</div>
          </div>
        `
          )
          .join("")}
      </article>
    </section>
  `;
}

function renderDomainMatrix(data) {
  const rows = architectureRows(data)
    .map((row) => {
      const drift = getDriftDomain(row.domain);
      const projected = Number(drift?.healthImpact?.projectedScore ?? row.score);
      const findings = Number(drift?.totalFindings || 0);
      const consumers = (row.consumers || []).length;
      const riskPriority = Number(row.decisionPriority || computeFallbackDecisionPriority(row));
      const priorityRank = Number(row.decisionPriorityRank || 0) || null;
      return { ...row, projected, findings, consumers, riskPriority, priorityRank };
    })
    .sort((a, b) => {
      if (a.priorityRank && b.priorityRank) return a.priorityRank - b.priorityRank;
      if (a.priorityRank && !b.priorityRank) return -1;
      if (!a.priorityRank && b.priorityRank) return 1;
      return b.riskPriority - a.riskPriority;
    });

  return `
    <section class="card domain-matrix">
      <h3>Matrice de pilotage des domaines</h3>
      <p class="matrix-subtitle">Vision compacte: score actuel, score projeté sous dérive, pression de constats et surface de consommation.</p>
      <div class="matrix-grid">
        ${rows
          .map(
            (row) => `
          <article class="matrix-card">
            <div class="matrix-head">
              <strong>${safe(row.domain)}</strong>
              <span class="badge ${row.riskPriority >= 80 ? "fail" : row.riskPriority >= 60 ? "warn" : "pass"}">${row.priorityRank ? `#${row.priorityRank}` : "n/r"} · prio ${row.riskPriority}</span>
            </div>
            <div class="matrix-line">
              <span>Score actuel</span>
              <span class="mono">${row.score}</span>
            </div>
            <div class="matrix-track"><div class="matrix-fill" style="width:${Math.max(0, Math.min(100, row.score))}%"></div></div>
            <div class="matrix-line">
              <span>Score projeté</span>
              <span class="mono ${row.projected < 70 ? "risk-high" : ""}">${row.projected}</span>
            </div>
            <div class="matrix-track projected"><div class="matrix-fill" style="width:${Math.max(0, Math.min(100, row.projected))}%"></div></div>
            <div class="matrix-meta">constats=${row.findings} · consommateurs=${row.consumers} · write=${row.writePath} · proj=${row.projections}</div>
          </article>
        `
          )
          .join("")}
      </div>
    </section>
  `;
}

function buildDomainMasterRows(data) {
  const rows = architectureRows(data);
  const projectionsByDomain = new Map();
  for (const entry of data?.projectionRegistry || []) {
    const key = String(entry?.domain || "").toLowerCase();
    const values = projectionsByDomain.get(key) || [];
    values.push(String(entry?.projection || ""));
    projectionsByDomain.set(key, values.filter(Boolean));
  }
  const ownerByDomain = new Map(
    (data?.domainOwnership || []).map((row) => [String(row?.domain || "").toLowerCase(), String(row?.owner || "").trim()])
  );
  const gapCountByDomain = new Map();
  for (const gap of data?.gaps || []) {
    const key = String(gap?.domain || "").toLowerCase();
    gapCountByDomain.set(key, Number(gapCountByDomain.get(key) || 0) + 1);
  }

  const alertByDomain = new Map();
  for (const alert of buildArchitectureAlerts(data)) {
    const key = String(alert?.domain || "").toLowerCase();
    if (!alertByDomain.has(key)) alertByDomain.set(key, alert);
  }

  const domainNodesByName = new Map();
  for (const node of data?.graph?.nodes || []) {
    if (String(node?.type || "") !== "domain") continue;
    const key = String(node?.label || "").toLowerCase();
    const values = domainNodesByName.get(key) || [];
    values.push(String(node.id));
    domainNodesByName.set(key, values);
  }
  const edges = Array.isArray(data?.graph?.edges) ? data.graph.edges : [];
  const trends = getTrendsCorrelation();
  const domainWindows = trends?.domainWindows || {};
  const snapshots = Array.isArray(state.history?.snapshots) ? state.history.snapshots : [];
  const scoreAtOffset = (domainKey, fallback, offset) => {
    if (!snapshots.length) return fallback;
    const index = Math.max(0, snapshots.length - 1 - offset);
    const score = Number(snapshots[index]?.summary?.domainScores?.[domainKey]);
    return Number.isFinite(score) ? score : fallback;
  };

  return rows
    .map((row) => {
      const domainKey = String(row.domain || "").toLowerCase();
      const drift = getDriftDomain(domainKey);
      const owner = ownerByDomain.get(domainKey) || "owner-missing";
      const priority = Number(row.decisionPriority || computeFallbackDecisionPriority(row));
      const priorityRank = Number(row.decisionPriorityRank || 0) || null;
      const projectedScore = Number(drift?.healthImpact?.projectedScore ?? row.score);
      const strategicImportance = Number(getDecisionPriorityDomain(domainKey, data)?.signals?.strategicImportance || 0);
      const nodeIds = new Set(domainNodesByName.get(domainKey) || []);
      let incoming = 0;
      let outgoing = 0;
      let integrationLinks = 0;
      for (const edge of edges) {
        const fromInside = nodeIds.has(String(edge?.from || ""));
        const toInside = nodeIds.has(String(edge?.to || ""));
        if (fromInside && !toInside) outgoing += 1;
        if (!fromInside && toInside) incoming += 1;
        if ((fromInside || toInside) && String(edge?.kind || "") === "integration") integrationLinks += 1;
      }

      const violations =
        Number(drift?.projectionBypassCount || 0) +
        Number(drift?.unregisteredEvents || 0) +
        Number(drift?.undeclaredProjections || 0) +
        Number(drift?.ownershipViolations || 0) +
        Number(drift?.unauthorizedConsumerReads || 0);

      const gapCount = Number(gapCountByDomain.get(domainKey) || 0);
      const scoreNow = Number(row.score || 0);
      const score7 = scoreAtOffset(domainKey, scoreNow, 7);
      const score30 = scoreAtOffset(domainKey, scoreNow, 30);
      const score90 = scoreAtOffset(domainKey, scoreNow, 90);
      const trendWindow = domainWindows[domainKey] || {};
      const topAlert = alertByDomain.get(domainKey) || null;
      const nextAction = topAlert?.action || (projectedScore < 75 ? "Stabiliser write/read-path avant nouveaux changements." : "Maintenir discipline et monitorer.");
      const nextActionState = normalizeAlertState(topAlert?.state || "open");
      const plan =
        projectedScore < 75 || Number(drift?.totalFindings || 0) > 0
          ? "stabilize"
          : gapCount > 0 || incoming + outgoing >= 18 || violations > 0
            ? "extract"
            : "hold";

      return {
        domain: row.domain,
        owner,
        ownerMissing: owner === "owner-missing",
        scoreNow,
        projectedScore,
        riskLevel: String(drift?.riskLevel || (projectedScore < 75 ? "high" : "low")),
        strategicImportance,
        priority,
        priorityRank,
        trajectory: {
          d7: Number(trendWindow["7d"]?.scoreDelta ?? Number((scoreNow - score7).toFixed(1))),
          d30: Number(trendWindow["30d"]?.scoreDelta ?? Number((scoreNow - score30).toFixed(1))),
          d90: Number(trendWindow["90d"]?.scoreDelta ?? Number((scoreNow - score90).toFixed(1))),
        },
        dependencies: { incoming, outgoing, integrationLinks },
        projectionNames: projectionsByDomain.get(domainKey) || [],
        consumers: Array.isArray(row.consumers) ? row.consumers : [],
        violations,
        gapCount,
        plan,
        nextAction,
        nextActionState,
        alert: topAlert,
      };
    })
    .sort((a, b) => {
      if (a.priorityRank && b.priorityRank) return a.priorityRank - b.priorityRank;
      if (a.priorityRank && !b.priorityRank) return -1;
      if (!a.priorityRank && b.priorityRank) return 1;
      return b.priority - a.priority;
    });
}

function renderDomainMaster(data) {
  const rows = buildDomainMasterRows(data);
  const activeFilter = state.domainMasterFilter || "all";
  const filteredRows = activeFilter === "all" ? rows : rows.filter((row) => String(row.domain) === activeFilter);
  const selected = rows.find((row) => String(row.domain) === String(state.activeDomainProofDomain || "")) || null;
  const options = ["all", ...rows.map((row) => String(row.domain))];

  return `
    <section class="card" style="margin-top:12px">
      <div class="section-head">
        <h3>Fiche Domaine maître</h3>
        <div class="alert-select-group">
          <label class="mono" for="domain-master-filter">domain</label>
          <select id="domain-master-filter" class="alert-select" data-domain-master-filter>
            ${options.map((value) => `<option value="${safe(value)}" ${activeFilter === value ? "selected" : ""}>${safe(value)}</option>`).join("")}
          </select>
        </div>
      </div>
      <p class="matrix-subtitle">Diagnostic local complet sans passer par Graph/Radar: santé, trajectoire, dépendances, plan, owner, action.</p>
      <div class="domain-master-grid">
        ${
          filteredRows.length
            ? filteredRows
                .map((row) => {
                  const alertProofHref = resolveProofHref(row.alert?.proofLink);
                  const domainToken = encodeURIComponent(String(row.domain));
                  return `
                    <article class="domain-master-card">
                      <div class="domain-master-head">
                        <strong>${safe(row.domain)}</strong>
                        <span class="badge ${row.priority >= 70 ? "fail" : row.priority >= 55 ? "warn" : "pass"}">${row.priorityRank ? `#${row.priorityRank}` : "n/r"} · prio ${row.priority}</span>
                      </div>
                      <div class="domain-master-kpis">
                        <span>score=${row.scoreNow}</span>
                        <span class="${row.projectedScore < 75 ? "risk-high" : ""}">proj=${row.projectedScore}</span>
                        <span>importance=${row.strategicImportance}</span>
                        <span>risque=${safe(row.riskLevel)}</span>
                      </div>
                      <div class="domain-master-kpis mono">
                        <span>7j=${row.trajectory.d7 > 0 ? "+" : ""}${row.trajectory.d7}</span>
                        <span>30j=${row.trajectory.d30 > 0 ? "+" : ""}${row.trajectory.d30}</span>
                        <span>90j=${row.trajectory.d90 > 0 ? "+" : ""}${row.trajectory.d90}</span>
                      </div>
                      <div class="domain-master-kpis mono">
                        <span>deps in=${row.dependencies.incoming}</span>
                        <span>deps out=${row.dependencies.outgoing}</span>
                        <span>integrations=${row.dependencies.integrationLinks}</span>
                      </div>
                      <div class="domain-master-owner ${row.ownerMissing ? "risk-high" : ""}">
                        owner=${safe(row.ownerMissing ? "missing (escalade requise)" : row.owner)}
                      </div>
                      <div class="domain-master-kpis mono">
                        <span>projections=${safe(row.projectionNames.join(", ") || "n/d")}</span>
                        <span>consumers=${safe(row.consumers.join(", ") || "n/d")}</span>
                        <span class="${row.violations > 0 ? "risk-high" : ""}">violations=${row.violations}</span>
                      </div>
                      <div class="domain-master-action">
                        <span class="badge ${row.plan === "stabilize" ? "fail" : row.plan === "extract" ? "warn" : "pass"}">${safe(row.plan)}</span>
                        <span class="badge ${alertStateBadgeClass(row.nextActionState)}">${safe(alertStateLabel(row.nextActionState))}</span>
                        <span class="domain-master-next">${safe(row.nextAction)}</span>
                      </div>
                      <div class="domain-master-links">
                        <div class="domain-master-link-actions">
                          <button type="button" class="inline-btn" data-domain-proof-open="${domainToken}" data-kpi-event="priority,rationale,drilldown" data-kpi-domain="${safe(row.domain)}">Voir preuves</button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-evidence-context="${domainToken}"
                            data-evidence-source="domain-master"
                            data-evidence-proof-path="${encodeURIComponent(String(row.alert?.proofLink || ""))}"
                            data-evidence-alert-id="${safe(row.alert?.id || "")}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Espace preuves
                          </button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-graph-context="${domainToken}"
                            data-context-source="domain-master"
                            data-context-alert-id="${safe(row.alert?.id || "")}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Enquête graphe
                          </button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-radar-context="${domainToken}"
                            data-context-source="domain-master"
                            data-context-alert-id="${safe(row.alert?.id || "")}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Radar domaine
                          </button>
                        </div>
                        ${
                          alertProofHref
                            ? `<a class="mono" href="${safe(alertProofHref)}" target="_blank" rel="noreferrer noopener" data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(row.domain)}">Source preuve</a>`
                            : `<span class="mono">${safe(row.alert?.proofLink || "preuve n/d")}</span>`
                        }
                      </div>
                    </article>
                  `;
                })
                .join("")
            : '<div class="detail-item"><span class="mono">Aucun domaine pour le filtre courant.</span></div>'
        }
      </div>
      ${
        selected
          ? `
            <div class="alert-proof-drawer">
              <div class="section-head">
                <strong>Preuves domaine · ${safe(selected.domain)}</strong>
                <button type="button" class="inline-btn" data-domain-proof-close>Fermer</button>
              </div>
              <div class="mono">owner=${safe(selected.owner)} · plan=${safe(selected.plan)} · state=${safe(alertStateLabel(selected.nextActionState))}</div>
              <div style="margin-top:6px">${safe(selected.alert?.explanation || selected.nextAction)}</div>
              <div style="margin-top:8px">
                ${
                  resolveProofHref(selected.alert?.proofLink)
                    ? `<a class="mono" href="${safe(resolveProofHref(selected.alert?.proofLink))}" target="_blank" rel="noreferrer noopener" data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(selected.domain)}">Ouvrir la preuve</a>`
                    : `<span class="mono">${safe(selected.alert?.proofLink || "preuve n/d")}</span>`
                }
              </div>
              <div style="margin-top:8px">
                <button
                  type="button"
                  class="inline-btn"
                  data-open-evidence-context="${encodeURIComponent(String(selected.domain || ""))}"
                  data-evidence-source="domain-proof-drawer"
                  data-evidence-proof-path="${encodeURIComponent(String(selected.alert?.proofLink || ""))}"
                  data-evidence-alert-id="${safe(selected.alert?.id || "")}"
                  data-kpi-event="priority,rationale,drilldown"
                  data-kpi-domain="${safe(selected.domain)}"
                >
                  Ouvrir dans l'espace preuves
                </button>
              </div>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderOverview(data) {
  const totalLoc = data.repos.reduce((acc, repo) => acc + repo.loc, 0);
  const totalRoutes = data.repos.reduce((acc, repo) => acc + repo.routes.length, 0);
  const totalTests = data.repos.reduce((acc, repo) => acc + repo.tests.length, 0);
  const rows = architectureRows(data);
  const driftSummary = state.driftReport?.summary || { domainsWithDrift: 0, totalFindings: 0, criticalDomains: [] };
  const averageDomainScore = Math.round(average(rows.map((row) => row.score)));
  const topDomains = [...rows]
    .map((row) => ({
      ...row,
      priorityScore: Number(row.decisionPriority || computeFallbackDecisionPriority(row)),
      priorityRank: Number(row.decisionPriorityRank || 0) || null,
    }))
    .sort((a, b) => {
      if (a.priorityRank && b.priorityRank) return a.priorityRank - b.priorityRank;
      if (a.priorityRank && !b.priorityRank) return -1;
      if (!a.priorityRank && b.priorityRank) return 1;
      return b.priorityScore - a.priorityScore;
    })
    .slice(0, 6);
  const critical = rows.filter((row) => row.score < 70);

  return `
    <section class="grid">
      <article class="card">
        <div class="kpi">${data.repos.length}</div>
        <div class="kpi-caption">Dépôts analysés</div>
      </article>
      <article class="card">
        <div class="kpi">${totalLoc.toLocaleString()}</div>
        <div class="kpi-caption">Lignes de code scannées (fichiers code)</div>
      </article>
      <article class="card">
        <div class="kpi">${totalRoutes.toLocaleString()}</div>
        <div class="kpi-caption">Surfaces de routes détectées</div>
      </article>
      <article class="card">
        <div class="kpi">${totalTests.toLocaleString()}</div>
        <div class="kpi-caption">Tests détectés (unitaires + E2E)</div>
      </article>
      <article class="card">
        <div class="kpi">${data.gaps.length}</div>
        <div class="kpi-caption">Écarts d'architecture ouverts</div>
      </article>
      <article class="card">
        <div class="kpi">${averageDomainScore}</div>
        <div class="kpi-caption">Score moyen de santé des domaines</div>
      </article>
      <article class="card">
        <div class="kpi">${driftSummary.domainsWithDrift}</div>
        <div class="kpi-caption">Domaines avec dérive</div>
      </article>
      <article class="card">
        <div class="kpi">${driftSummary.totalFindings}</div>
        <div class="kpi-caption">Total des constats de dérive</div>
      </article>
    </section>

    ${
      runtime.embedded
        ? ""
        : `
    <section class="card" style="margin-top:12px">
      <h3>Doctrine d'architecture</h3>
      <div class="mono">${safe(data.doctrine.slogan)}</div>
      <div style="margin-top:10px">
        ${data.doctrine.principles.map((p) => `<span class="tag">${safe(p)}</span>`).join("")}
      </div>
    </section>
    `
    }

    <section style="margin-top:12px">
      <h3>Scorecards domaines (priorité décisionnelle)</h3>
      <div class="grid">
        ${topDomains
          .map(
            (domain) => `
          <article class="card domain-card">
            <h4>${safe(domain.domain)} · ${domain.priorityRank ? `#${domain.priorityRank}` : "n/r"} · prio ${domain.priorityScore}</h4>
            ${scoreBar(domain.score)}
            <div class="badge-row" style="margin-top:10px">
              <span class="badge ${badgeClass(domain.domainIsolation >= 85 ? "pass" : domain.domainIsolation >= 70 ? "warn" : "fail")}">Iso ${domain.domainIsolation}</span>
              <span class="badge ${badgeClass(domain.writePath >= 85 ? "pass" : domain.writePath >= 70 ? "warn" : "fail")}">Write ${domain.writePath}</span>
              <span class="badge ${badgeClass(domain.projections >= 85 ? "pass" : domain.projections >= 70 ? "warn" : "fail")}">Proj ${domain.projections}</span>
              <span class="badge ${badgeClass(domain.contracts >= 85 ? "pass" : domain.contracts >= 70 ? "warn" : "fail")}">Contrats ${domain.contracts}</span>
            </div>
            <div style="margin-top:8px;font-size:0.83rem;color:var(--muted)">
              Score santé: ${domain.score}/100 · Consommateurs: ${(domain.consumers || []).join(", ") || "n/d"} · Alertes: ${domain.warnings.length}
            </div>
          </article>
        `
          )
          .join("")}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Alertes santé architecture</h3>
      ${
        critical.length
          ? critical
              .map(
                (row) => `
        <div class="detail-item risk-high">
          <div style="width:100%">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <strong>${safe(row.domain)}</strong>
              <span class="badge fail">${row.score}/100</span>
            </div>
            <div class="action-track" style="margin-top:6px"><div class="action-fill" style="width:${Math.max(8, 100 - Number(row.score || 0))}%"></div></div>
            <div class="mono" style="margin-top:5px">${safe((row.warnings || []).slice(0, 2).join(" | "))}</div>
          </div>
        </div>
      `
              )
              .join("")
          : '<div class="detail-item">Aucun domaine sous 70/100.</div>'
      }
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Alertes dérive architecture</h3>
      ${
        (driftSummary.criticalDomains || []).length
          ? driftSummary.criticalDomains
              .slice(0, 8)
              .map(
                (row) => `
        <div class="detail-item ${row.riskLevel === "critical" ? "risk-critical" : "risk-high"}">
          <div style="width:100%">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <strong>${safe(row.domain)}</strong>
              <span class="badge ${row.riskLevel === "critical" ? "fail" : "warn"}">${safe(row.riskLevel)}</span>
            </div>
            <div class="matrix-line" style="margin-top:5px">
              <span>score projeté</span>
              <span class="mono">${row.projectedScore}/100</span>
            </div>
            <div class="matrix-track projected"><div class="matrix-fill" style="width:${Math.max(0, Math.min(100, Number(row.projectedScore || 0)))}%"></div></div>
            <div class="mono" style="margin-top:5px">constats=${row.totalFindings}</div>
          </div>
        </div>
      `
              )
              .join("")
          : '<div class="detail-item">Aucune dérive high/critical détectée.</div>'
      }
    </section>
  `;
}

function renderGraph() {
  const zoomPercent = Math.round(state.graphZoom * 100);
  const context = getInvestigationContext();
  const contextBanner = context
    ? `
      <div class="graph-context-banner">
        <strong>${iconSvg("info", "inline-icon")} Enquête contextuelle</strong>
        <span class="mono">domain=${safe(context.domain)} · source=${safe(context.source)}${context.alertId ? ` · alert=${safe(context.alertId)}` : ""}</span>
        <div class="graph-context-actions">
          <button type="button" class="inline-btn" data-open-radar-context="${encodeURIComponent(context.domain)}" data-context-source="${safe(context.source)}" data-context-alert-id="${safe(context.alertId || "")}">
            Ouvrir radar contextuel
          </button>
          <button type="button" class="inline-btn" data-clear-investigation-context data-next-view="domains">Sortir de l'enquête</button>
        </div>
      </div>
    `
    : `
      <div class="graph-context-banner">
        <strong>${iconSvg("info", "inline-icon")} Enquête libre (L3)</strong>
        <span class="mono">Accède au graphe depuis Alerts ou Domaines pour charger un contexte préfiltré.</span>
        <div class="graph-context-actions">
          <button type="button" class="inline-btn" data-switch-view="alerts" data-kpi-event="navigation,priority" data-kpi-view="alerts">Ouvrir Alerts</button>
          <button type="button" class="inline-btn" data-switch-view="domains" data-kpi-event="navigation,priority" data-kpi-view="domains">Ouvrir Domaines</button>
        </div>
      </div>
    `;

  return `
    <section id="graph-wrap">
      <div id="graph-controls" class="card">
        <div class="graph-controls-left">
          <strong>${iconSvg("graph", "inline-icon")} Filtres</strong>
          ${["repo", "domain", "projection", "provider"]
            .map(
              (type) => `
              <label class="graph-filter-label">
                <input type="checkbox" data-graph-filter="${type}" ${state.graphFilter.has(type) ? "checked" : ""} />
                ${iconSvg(NODE_META[type].icon, "tiny-icon")} <span>${
                  type === "repo"
                    ? "Dépôts"
                    : type === "domain"
                      ? "Domaines"
                      : type === "projection"
                        ? "Projections"
                        : "Fournisseurs"
                }</span>
              </label>
            `
            )
            .join("")}
        </div>
        <div class="graph-controls-right">
          <div class="graph-zoom-group">
            <button id="graph-zoom-out" class="graph-zoom-btn" type="button">−</button>
            <button id="graph-zoom-reset" class="graph-zoom-btn" type="button">${zoomPercent}%</button>
            <button id="graph-zoom-in" class="graph-zoom-btn" type="button">+</button>
          </div>
          <label class="graph-zoom-label">
            <span>Niveau</span>
            <input id="graph-zoom" type="range" min="55" max="220" value="${zoomPercent}" />
          </label>
        </div>
      </div>
      ${contextBanner}
      <div id="graph-canvas" aria-label="Canvas de la carte d'architecture"></div>
      <div class="legend">
        <span><span class="dot" style="background:#5ec8ff"></span>${iconSvg("repo", "tiny-icon")} Dépôt</span>
        <span><span class="dot" style="background:#6ce6ad"></span>${iconSvg("domain", "tiny-icon")} Domaine</span>
        <span><span class="dot" style="background:#ffc36a"></span>${iconSvg("projection", "tiny-icon")} Projection</span>
        <span><span class="dot" style="background:#f88377"></span>${iconSvg("external", "tiny-icon")} Fournisseur</span>
      </div>
    </section>
  `;
}

function renderCoreProjectionApps(data) {
  const rows = architectureRows(data);
  const byDomain = new Map(rows.map((row) => [String(row.domain).toLowerCase(), row]));
  const title = runtime.embedded
    ? "Règles d’architecture par domaine"
    : "Core décide / Projections expliquent / Apps affichent";
  return `
    <section class="card">
      <h3>${safe(title)}</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>AHS</th>
            <th>Ce que décide le Core</th>
            <th>État projection</th>
            <th>Rendu côté Apps uniquement</th>
            <th>Consommateurs</th>
            <th>Signaux de dérive</th>
          </tr>
        </thead>
        <tbody>
          ${data.domainProfiles
            .map((profile) => {
              const driftProfile = getDriftDomain(profile.domain);
              const drift = Number(driftProfile?.totalFindings || profile.evidence.driftSignals.length || 0);
              const driftRisk = driftProfile?.riskLevel || "low";
              const projectedScore = driftProfile?.healthImpact?.projectedScore;
              const arch = byDomain.get(String(profile.domain).toLowerCase());
              const ahs = arch?.score ?? profile.overallScore;
              return `
                <tr>
                  <td><strong>${safe(profile.domain)}</strong></td>
                  <td class="${ahs < 70 ? "risk-high" : ""}">${ahs}</td>
                  <td>${safe(profile.coreDecidesProjectionRender.coreDecides)}</td>
                  <td>${safe(profile.coreDecidesProjectionRender.projectionsExplain)}</td>
                  <td>${safe(profile.coreDecidesProjectionRender.appsRenderOnly)}</td>
                  <td>${safe((profile.consumers || []).join(", "))}</td>
                  <td class="${drift > 0 ? "risk-high" : ""}">
                    ${drift}
                    <div class="mono" style="font-size:0.73rem;margin-top:4px">risque=${safe(driftRisk)}${typeof projectedScore === "number" ? ` · projeté=${projectedScore}` : ""}</div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function bindExternalControlChannel() {
  if (externalControlBound) return;
  window.addEventListener("message", (event) => {
    const payload = event?.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "atlas-help-mode") {
      setHelpMode(Boolean(payload.enabled));
    }
  });
  externalControlBound = true;
}

function renderWriteRead(data) {
  return `
    <section class="card">
      <h3>Discipline write-path / read-path</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Write-path canonique</th>
            <th>Écritures hors Core</th>
            <th>Signaux de projection</th>
            <th>Constats de dérive</th>
            <th>Consommateurs</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${data.domainProfiles
            .map((profile) => {
              const writeCount = profile.evidence.writeSignals.length;
              const writeOutside = profile.evidence.writeOutsideCore.length;
              const projections = profile.evidence.projectionSignals.length;
              const drift = getDriftDomain(profile.domain);
              const driftFindings = Number(drift?.totalFindings || 0);
              const projectionBypassCount = Number(drift?.projectionBypassCount || 0);
              const status = profile.badges.canonicalWritePath;
              return `
                <tr>
                  <td>${safe(profile.domain)}</td>
                  <td>${writeCount}</td>
                  <td class="${writeOutside ? "risk-high" : ""}">${writeOutside}</td>
                  <td>${projections}</td>
                  <td class="${driftFindings > 0 ? "risk-high" : ""}">
                    ${driftFindings}
                    <div class="mono" style="font-size:0.73rem;margin-top:4px">contournementsProjection=${projectionBypassCount}</div>
                  </td>
                  <td>${safe((profile.consumers || []).join(", "))}</td>
                  <td><span class="badge ${badgeClass(status)}">${badgeIcon(status)} ${status}</span></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderExternal(data) {
  return `
    <section class="card">
      <h3>Services externes</h3>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Dépôts</th>
            <th>Domaines</th>
            <th>Risque Human-Only</th>
            <th>Maturité</th>
          </tr>
        </thead>
        <tbody>
          ${data.externalServices
            .map(
              (svc) => `
            <tr>
              <td>${safe(svc.service)}</td>
              <td>${safe((svc.repos || []).join(", "))}</td>
              <td>${safe((svc.domains || []).join(", "))}</td>
              <td>${svc.humanOnlyRisk ? "Présent" : "Faible"}</td>
              <td>${safe(svc.maturity)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderSecurity(data) {
  return `
    <section class="grid">
      ${data.repos
        .map(
          (repo) => `
          <article class="card">
            <h4>${safe(repo.name)}</h4>
            <div style="margin-bottom:8px;color:var(--muted)">Signaux sécurité / authentification</div>
            ${(repo.securitySignals || [])
              .map(
                (signal) =>
                  `<div class="detail-item"><strong>${safe(signal.signal)}</strong> · <span class="mono">${signal.count}</span> occurrence(s)</div>`
              )
              .join("")}
          </article>
        `
        )
        .join("")}
    </section>
  `;
}

function renderValidation(data) {
  return `
    <section class="card">
      <h3>Matrice validation & preuves</h3>
      <table>
        <thead>
          <tr>
            <th>Dépôt</th>
            <th>Commandes de validation</th>
            <th>Tests trouvés</th>
            <th>E2E trouvés</th>
          </tr>
        </thead>
        <tbody>
          ${data.repos
            .map((repo) => {
              const testCount = repo.tests.length;
              const e2eCount = repo.tests.filter((t) => t.kind === "e2e").length;
              return `
                <tr>
                  <td>${safe(repo.name)}</td>
                  <td>
                    ${(repo.validation || []).map((cmd) => `<div class="mono">${safe(cmd)}</div>`).join("")}
                  </td>
                  <td>${testCount}</td>
                  <td>${e2eCount}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function buildAuditCheckRows(data, artifacts) {
  const freshness = resolveFreshnessContract(data, state.history);
  const alerts = buildArchitectureAlerts(data);
  const completeAlerts = alerts.filter(
    (row) => String(row.owner || "").trim() && String(row.action || "").trim() && String(row.proofLink || "").trim()
  ).length;
  const snapshotCount = Number(state.history?.snapshots?.length || 0);
  const snapshotArtifacts = artifacts.filter((row) => row.type === "snapshot").length;
  const snapshotCoverage = snapshotCount > 0 ? Math.round((snapshotArtifacts / snapshotCount) * 100) : 0;
  const projectionRows = Array.isArray(data?.projectionRegistry) ? data.projectionRegistry : [];
  const canonicalProjectionCount = projectionRows.filter((row) => Boolean(row?.canonical)).length;
  const staleCount = Number(freshness?.staleDatasetCount || 0);

  return [
    {
      id: "check:freshness",
      label: "Fraîcheur datasets",
      value: `${freshnessLabel(String(freshness?.globalStatus || "stale"))} (${staleCount} stale)`,
      status: staleCount > 0 ? "fail" : String(freshness?.globalStatus || "stale") === "degraded" ? "warn" : "pass",
      detail: `datasets=${Number(freshness?.datasets?.length || 0)}`,
      proofPath: "data/atlas-data.json",
    },
    {
      id: "check:alerts-taxonomy",
      label: "Taxonomie alertes complètes",
      value: `${completeAlerts}/${alerts.length || 0}`,
      status: completeAlerts === alerts.length ? "pass" : completeAlerts > 0 ? "warn" : "fail",
      detail: "owner/action/proof",
      proofPath: "data/atlas-data.json",
    },
    {
      id: "check:snapshots",
      label: "Couverture snapshots bruts",
      value: `${snapshotArtifacts}/${snapshotCount}`,
      status: snapshotCoverage >= 100 ? "pass" : snapshotCoverage >= 70 ? "warn" : "fail",
      detail: `coverage=${snapshotCoverage}%`,
      proofPath: "data/atlas-history.json",
    },
    {
      id: "check:projections",
      label: "Projections canoniques",
      value: `${canonicalProjectionCount}/${projectionRows.length || 0}`,
      status: projectionRows.length > 0 && canonicalProjectionCount === projectionRows.length ? "pass" : "warn",
      detail: "registry coverage",
      proofPath: "docs/projection-registry.md",
    },
  ];
}

function buildEvidenceArtifacts(data) {
  const auditIndex = resolveAuditIndex(data, state.history);
  const baseArtifacts = Array.isArray(auditIndex?.artifacts) ? auditIndex.artifacts : [];
  const alerts = buildArchitectureAlerts(data).slice(0, 200);
  const latestSnapshot = Array.isArray(state.history?.snapshots) ? state.history.snapshots[state.history.snapshots.length - 1] : null;
  const domainScores = latestSnapshot?.summary?.domainScores || {};

  const alertArtifacts = alerts.map((row) => ({
    id: `alert:${row.id}`,
    type: "alert-proof",
    source: "alerts",
    label: `${row.domain} · ${row.type}`,
    path: String(row.proofLink || ""),
    generatedAt: state.data?.generatedAt || state.history?.snapshots?.at(-1)?.generatedAt || new Date().toISOString(),
    sizeBytes: null,
    domain: String(row.domain || "platform"),
    metadata: {
      severity: row.severity,
      owner: row.owner,
      alertId: row.id,
      sourceFile: row.sourceFile || "",
      sourcePath: row.sourcePath || "",
    },
  }));

  const domainArtifacts = Object.entries(domainScores).map(([domain, score]) => ({
    id: `domain-score:${domain}`,
    type: "domain-proof",
    source: "history",
    label: `Score brut snapshot · ${domain}`,
    path: latestSnapshot?.file ? `data/${latestSnapshot.file}` : "data/atlas-history.json",
    generatedAt: latestSnapshot?.generatedAt || new Date().toISOString(),
    sizeBytes: null,
    domain: String(domain),
    metadata: {
      score: Number(score || 0),
      snapshotFile: latestSnapshot?.file || "",
    },
  }));

  const map = new Map();
  for (const row of [...baseArtifacts, ...alertArtifacts, ...domainArtifacts]) {
    if (!row || !row.id) continue;
    if (map.has(row.id)) continue;
    map.set(row.id, row);
  }

  return [...map.values()].sort((a, b) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime());
}

function matchesEvidenceFilters(row, searchValue) {
  const typeFilter = String(state.evidenceTypeFilter || "all");
  const domainFilter = String(state.evidenceDomainFilter || "all");
  const sourceFilter = String(state.evidenceSourceFilter || "all");
  if (typeFilter !== "all" && String(row.type || "") !== typeFilter) return false;
  if (domainFilter !== "all" && String(row.domain || "") !== domainFilter) return false;
  if (sourceFilter !== "all" && String(row.source || "") !== sourceFilter) return false;
  if (!searchValue) return true;
  const haystack = [
    row.id,
    row.label,
    row.path,
    row.type,
    row.source,
    row.domain,
    row.metadata?.owner,
    row.metadata?.alertId,
    row.metadata?.sourcePath,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchValue);
}

function renderEvidenceAudit(data) {
  const context = state.evidenceContext;
  const artifacts = buildEvidenceArtifacts(data);
  const checks = buildAuditCheckRows(data, artifacts);
  const searchValue = String(state.evidenceSearch || "").trim().toLowerCase();
  const filteredArtifacts = artifacts.filter((row) => matchesEvidenceFilters(row, searchValue));
  const typeOptions = ["all", ...new Set(artifacts.map((row) => String(row.type || "unknown"))).values()];
  const domainOptions = ["all", ...new Set(artifacts.map((row) => String(row.domain || "platform"))).values()].sort((a, b) => a.localeCompare(b));
  const sourceOptions = ["all", ...new Set(artifacts.map((row) => String(row.source || "unknown"))).values()];
  const selected = filteredArtifacts.find((row) => String(row.id) === String(state.activeEvidenceId || "")) || null;
  const snapshots = Array.isArray(state.history?.snapshots) ? [...state.history.snapshots].reverse().slice(0, 15) : [];

  return `
    <section class="card">
      <div class="section-head">
        <h3>Espace Preuves / Audit (P4)</h3>
        <span class="mono">artefacts=${artifacts.length} · filtres=${filteredArtifacts.length}</span>
      </div>
      <p class="matrix-subtitle">Preuve brute isolée du cockpit: checks détaillés, snapshots, inventaire exhaustif, exports JSON.</p>
      ${
        context
          ? `
            <div class="graph-context-banner">
              <strong>${iconSvg("info", "inline-icon")} Contexte de drill-down</strong>
              <span class="mono">domain=${safe(context.domain || "n/d")} · source=${safe(context.source || "n/d")}${context.alertId ? ` · alert=${safe(context.alertId)}` : ""}</span>
              <span class="mono">proof=${safe(context.proofPath || "n/d")}</span>
              <div class="graph-context-actions">
                <button type="button" class="inline-btn" data-evidence-clear-context>Réinitialiser contexte</button>
              </div>
            </div>
          `
          : ""
      }
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Check</th>
            <th>Valeur</th>
            <th>Détail</th>
            <th>Preuve</th>
          </tr>
        </thead>
        <tbody>
          ${checks
            .map((row) => {
              const href = resolveProofHref(row.proofPath);
              return `
                <tr>
                  <td>${safe(row.label)}</td>
                  <td><span class="badge ${row.status}">${safe(row.value)}</span></td>
                  <td class="mono">${safe(row.detail)}</td>
                  <td>${href ? `<a class="mono" href="${safe(href)}" target="_blank" rel="noreferrer noopener">ouvrir</a>` : `<span class="mono">${safe(row.proofPath)}</span>`}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>

    <section class="card" style="margin-top:12px">
      <div class="section-head">
        <h3>Inventaire des artefacts d'audit</h3>
        <span class="mono">export JSON direct</span>
      </div>
      <div class="evidence-toolbar">
        <input type="search" value="${safe(state.evidenceSearch || "")}" placeholder="Rechercher (domain/type/path/owner...)" data-evidence-search />
        <select data-evidence-type-filter>
          ${typeOptions.map((value) => `<option value="${safe(value)}" ${String(state.evidenceTypeFilter || "all") === value ? "selected" : ""}>type:${safe(value)}</option>`).join("")}
        </select>
        <select data-evidence-domain-filter>
          ${domainOptions.map((value) => `<option value="${safe(value)}" ${String(state.evidenceDomainFilter || "all") === value ? "selected" : ""}>domain:${safe(value)}</option>`).join("")}
        </select>
        <select data-evidence-source-filter>
          ${sourceOptions.map((value) => `<option value="${safe(value)}" ${String(state.evidenceSourceFilter || "all") === value ? "selected" : ""}>source:${safe(value)}</option>`).join("")}
        </select>
      </div>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Type</th>
            <th>Domaine</th>
            <th>Artefact</th>
            <th>Généré</th>
            <th>Taille</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredArtifacts.length
              ? filteredArtifacts
                  .slice(0, 250)
                  .map((row) => {
                    const href = resolveProofHref(row.path);
                    const rowToken = encodeURIComponent(String(row.id));
                    return `
                      <tr>
                        <td><span class="tag">${safe(row.type)}</span></td>
                        <td class="mono">${safe(row.domain || "platform")}</td>
                        <td>
                          <div>${safe(row.label || row.id)}</div>
                          <div class="mono">${safe(row.path || "n/d")}</div>
                        </td>
                        <td class="mono">${safe(formatMediumDate(row.generatedAt))} ${safe(formatShortTime(row.generatedAt))}</td>
                        <td class="mono">${safe(formatBytes(row.sizeBytes))}</td>
                        <td class="evidence-actions-cell">
                          <button type="button" class="inline-btn" data-evidence-open="${rowToken}" data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(row.domain || "platform")}">détail</button>
                          ${
                            href
                              ? `<a class="mono" href="${safe(href)}" target="_blank" rel="noreferrer noopener" download data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(row.domain || "platform")}">json</a>`
                              : `<span class="mono">n/d</span>`
                          }
                        </td>
                      </tr>
                    `;
                  })
                  .join("")
              : '<tr><td colspan="6" class="mono">Aucun artefact pour les filtres courants.</td></tr>'
          }
        </tbody>
      </table>
      ${
        selected
          ? `
            <div class="alert-proof-drawer">
              <div class="section-head">
                <strong>Détail artefact · ${safe(selected.id)}</strong>
                <button type="button" class="inline-btn" data-evidence-open="">Fermer</button>
              </div>
              <div class="mono">type=${safe(selected.type)} · domain=${safe(selected.domain || "platform")} · source=${safe(selected.source || "unknown")}</div>
              <div class="mono">generatedAt=${safe(selected.generatedAt || "n/d")} · size=${safe(formatBytes(selected.sizeBytes))}</div>
              <div class="mono">path=${safe(selected.path || "n/d")}</div>
              <div style="margin-top:6px">${safe(selected.label || "n/d")}</div>
              <div style="margin-top:8px">
                ${
                  selected.metadata
                    ? `<span class="mono">meta=${safe(JSON.stringify(selected.metadata))}</span>`
                    : ""
                }
              </div>
            </div>
          `
          : ""
      }
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Snapshots bruts récents</h3>
      <table>
        <thead>
          <tr>
            <th>Instant</th>
            <th>Fichier</th>
            <th>Résumé</th>
            <th>Export</th>
          </tr>
        </thead>
        <tbody>
          ${
            snapshots.length
              ? snapshots
                  .map((row) => {
                    const pathValue = `data/${row.file}`;
                    const href = resolveProofHref(pathValue);
                    return `
                      <tr>
                        <td class="mono">${safe(formatMediumDate(row.generatedAt))} ${safe(formatShortTime(row.generatedAt))}</td>
                        <td class="mono">${safe(row.file)}</td>
                        <td class="mono">gaps=${Number(row.summary?.gapCount || 0)} · nodes=${Number(row.summary?.graphNodes || 0)} · edges=${Number(row.summary?.graphEdges || 0)}</td>
                        <td>${href ? `<a class="mono" href="${safe(href)}" target="_blank" rel="noreferrer noopener" download data-kpi-event="rationale,drilldown">json</a>` : '<span class="mono">n/d</span>'}</td>
                      </tr>
                    `;
                  })
                  .join("")
              : '<tr><td colspan="4" class="mono">Aucun snapshot brut disponible.</td></tr>'
          }
        </tbody>
      </table>
    </section>
  `;
}

function renderHotspots(data) {
  const hotspots = data.repos
    .flatMap((repo) => repo.hotspots.slice(0, 6).map((h) => ({ ...h, repo: repo.name })))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 20);
  const risks = data.repos.flatMap((repo) => repo.risks.map((risk) => ({ ...risk, repo: repo.name })));
  const driftDomains = Object.entries(state.driftReport?.domains || {})
    .map(([domain, row]) => ({ domain, ...row }))
    .filter((row) => Number(row.totalFindings || 0) > 0)
    .sort((a, b) => Number(b.totalFindings || 0) - Number(a.totalFindings || 0))
    .slice(0, 12);
  return `
    <section class="grid">
      <article class="card">
        <h3>Fichiers hotspot prioritaires</h3>
        <table>
          <thead><tr><th>Dépôt</th><th>Fichier</th><th>LOC</th></tr></thead>
          <tbody>
            ${hotspots
              .map(
                (h) => `
                <tr>
                  <td>${safe(h.repo)}</td>
                  <td class="mono">${safe(h.file)}</td>
                  <td>${h.loc}</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </article>
      <article class="card">
        <h3>Risques détectés</h3>
        ${risks
          .map(
            (risk) => `
            <div class="detail-item ${risk.severity === "critical" ? "risk-critical" : risk.severity === "high" ? "risk-high" : ""}">
              <strong>${safe(risk.repo)}</strong> · ${safe(risk.severity || "info")}<br />
              ${safe(risk.message)}
            </div>
          `
          )
          .join("")}
      </article>
      <article class="card">
        <h3>Avertissements de dérive architecture</h3>
        ${
          driftDomains.length
            ? `
              <table>
                <thead>
                  <tr>
                    <th>Domaine</th>
                    <th>Constats</th>
                    <th>Risque</th>
                    <th>Score projeté</th>
                  </tr>
                </thead>
                <tbody>
                  ${driftDomains
                    .map(
                      (row) => `
                    <tr>
                      <td>${safe(row.domain)}</td>
                      <td class="${row.totalFindings > 0 ? "risk-high" : ""}">${row.totalFindings}</td>
                      <td class="${row.riskLevel === "critical" ? "risk-critical" : row.riskLevel === "high" ? "risk-high" : ""}">${safe(row.riskLevel || "inconnu")}</td>
                      <td>${row.healthImpact?.projectedScore ?? "n/d"}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            `
            : '<div class="detail-item">Aucune dérive détectée.</div>'
        }
      </article>
    </section>
  `;
}

function renderRoadmap(data) {
  return `
    <section class="card">
      <h3>Trajectoire d'extraction V3</h3>
      <table>
        <thead>
          <tr>
            <th>Étape</th>
            <th>Domaine</th>
            <th>Ticket</th>
            <th>Prêt à exécuter</th>
            <th>Statut</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${data.roadmap
            .map(
              (step) => `
            <tr>
              <td>${safe(step.label)}</td>
              <td>${safe(step.domain)}</td>
              <td>${safe(step.ticket)}</td>
              <td>${step.readiness}/100</td>
              <td>${safe(step.status)}</td>
              <td>${safe((step.notes || []).join(" | "))}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderProjectionRegistry(data) {
  const rows = Array.isArray(data.projectionRegistry) ? data.projectionRegistry : [];
  return `
    <section class="card">
      <h3>Registre des projections ${tip("Source: docs/projection-registry.md. Chaque projection multi-consumer doit être canonique, déclarée, et stable.")}</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Projection</th>
            <th>Consommateurs</th>
            <th>Responsable</th>
            <th>Canonique</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const status = String(row.status || "unknown");
              const klass = status === "canonical" ? "pass" : status === "duplicate" ? "warn" : "fail";
              const icon = status === "canonical" ? "✔" : status === "duplicate" ? "⚠" : "❌";
              const statusLabel =
                status === "canonical"
                  ? "canonique"
                  : status === "duplicate"
                    ? "dupliquée"
                    : status === "missing"
                      ? "manquante"
                      : status;
              return `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td class="mono">${safe(row.projection)}</td>
                  <td>${safe((row.consumers || []).join(", ") || "n/d")}</td>
                  <td>${safe(row.owner || "n/d")}</td>
                  <td><span class="badge ${row.canonical ? "pass" : "fail"}">${row.canonical ? "oui" : "non"}</span></td>
                  <td><span class="badge ${klass}">${icon} ${safe(statusLabel)}</span></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderDomainOwnership(data) {
  const ownership = Array.isArray(data.domainOwnership) ? data.domainOwnership : [];
  const scoreByDomain = new Map(architectureRows(data).map((row) => [String(row.domain).toLowerCase(), row.score]));

  return `
    <section class="card">
      <h3>Responsabilités des domaines ${tip("Chaque domaine a un responsable unique. Les consommateurs lisent via projection canonique, sans redécider le métier.")}</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Responsable</th>
            <th>Consommateurs</th>
            <th>Score</th>
            <th>Risques</th>
            <th>Couverture projection</th>
          </tr>
        </thead>
        <tbody>
          ${ownership
            .map((row) => {
              const score = Number(scoreByDomain.get(String(row.domain).toLowerCase()) || 0);
              const drift = getDriftDomain(row.domain);
              const riskCount = Number(drift?.totalFindings || 0);
              const projCoverage = Array.isArray(row.projections) && row.projections.length > 0 ? "couverte" : "manquante";
              return `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td>${safe(row.owner || "n/d")}</td>
                  <td>${safe((row.consumers || []).join(", ") || "n/d")}</td>
                  <td class="${score < 70 ? "risk-high" : ""}">${score || "n/d"}</td>
                  <td class="${riskCount > 0 ? "risk-high" : ""}">${riskCount}</td>
                  <td><span class="badge ${projCoverage === "couverte" ? "pass" : "fail"}">${projCoverage}</span></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderRadar(data) {
  const context = getInvestigationContext();
  const allDomains = (data.domainProfiles || []).slice().sort((a, b) => a.domain.localeCompare(b.domain));
  const domains = context
    ? allDomains.filter((domain) => normalizeDomainToken(domain.domain) === context.domain)
    : allDomains;
  const scoreMap = new Map(architectureRows(data).map((row) => [String(row.domain).toLowerCase(), row]));
  const dims = [
    { key: "architectureHealth", label: "Santé architecture" },
    { key: "projectionDiscipline", label: "Discipline projection" },
    { key: "validationMaturity", label: "Maturité validation" },
    { key: "extractionReadiness", label: "Prêt pour extraction" },
  ];

  return `
    <section class="card">
      <h3>Radar d'architecture ${tip("Radar simplifié par domaine sur 4 axes de pilotage. Permet d’identifier immédiatement les domaines à risque.")}</h3>
      ${
        context
          ? `
            <div class="graph-context-banner">
              <strong>${iconSvg("info", "inline-icon")} Radar contextuel</strong>
              <span class="mono">domain=${safe(context.domain)} · source=${safe(context.source)}</span>
              <div class="graph-context-actions">
                <button type="button" class="inline-btn" data-open-graph-context="${encodeURIComponent(context.domain)}" data-context-source="${safe(context.source)}" data-context-alert-id="${safe(context.alertId || "")}">
                  Ouvrir graphe contextuel
                </button>
                <button type="button" class="inline-btn" data-clear-investigation-context data-next-view="domains">Sortir de l'enquête</button>
              </div>
            </div>
          `
          : ""
      }
      <div class="radar-grid">
        ${domains
          .map((domain) => {
            const scoreRow = scoreMap.get(String(domain.domain).toLowerCase());
            const bars = dims
              .map((dim) => {
                const value =
                  dim.key === "architectureHealth"
                    ? Number(scoreRow?.domainIsolation || domain.scores?.architectureHealth?.score || 0)
                    : dim.key === "projectionDiscipline"
                      ? Number(scoreRow?.projections || domain.scores?.projectionDiscipline?.score || 0)
                      : dim.key === "validationMaturity"
                        ? Number(scoreRow?.contracts || domain.scores?.validationMaturity?.score || 0)
                        : Number(domain.scores?.extractionReadiness?.score || 0);
                return `
                  <div class="radar-bar">
                    <div class="radar-label">${safe(dim.label)}</div>
                    <div class="radar-track"><div class="radar-fill" style="width:${value}%"></div></div>
                    <div class="radar-value ${value < 70 ? "risk-high" : ""}">${value}</div>
                  </div>
                `;
              })
              .join("");

            return `
              <article class="card radar-card">
                <h4>${safe(domain.domain)} · ${Number(scoreRow?.score || domain.overallScore || 0)}/100</h4>
                ${bars}
              </article>
            `;
          })
          .join("")}
      </div>
      ${
        context && !domains.length
          ? `<div class="detail-item"><span class="mono">Aucun domaine radar pour le contexte ${safe(context.domain)}.</span></div>`
          : ""
      }
    </section>
  `;
}

function buildArchitectureAlerts(data) {
  const ownerByDomain = new Map(
    (data?.domainOwnership || []).map((row) => [String(row?.domain || "").toLowerCase(), String(row?.owner || "atlas-ops")])
  );
  const resolveOwner = (domain) => ownerByDomain.get(String(domain || "").toLowerCase()) || "atlas-ops";
  const taxonomyAlerts = Array.isArray(data?.alertsTaxonomy?.alerts) ? data.alertsTaxonomy.alerts : [];
  if (taxonomyAlerts.length) {
    const normalized = taxonomyAlerts.map((row, index) => {
      const id = String(row?.id || `taxonomy:${index}`);
      const overrideState = state.alertStateOverrides[id];
      return {
        id,
        type: String(row?.type || "unknown"),
        domain: String(row?.domain || "platform"),
        owner: String(row?.owner || resolveOwner(row?.domain)),
        severity: String(row?.severity || "medium").toLowerCase(),
        explanation: String(row?.explanation || ""),
        action: String(row?.action || "Traiter l'alerte selon le playbook Atlas."),
        projectedImpact: String(row?.projectedImpact || "n/d"),
        proofLink: String(row?.proofLink || ""),
        state: normalizeAlertState(overrideState || row?.state || "open"),
        priorityScore: Number(row?.priorityScore || 0),
        sourceFile: String(row?.sourceFile || ""),
        sourcePath: String(row?.sourcePath || ""),
      };
    });

    normalized.sort((a, b) => {
      const delta = Number(b.priorityScore || 0) - Number(a.priorityScore || 0);
      if (delta !== 0) return delta;
      return severityRankValue(b.severity) - severityRankValue(a.severity);
    });
    return normalized.slice(0, 120);
  }

  const alerts = [];
  const freshness = resolveFreshnessContract(data, state.history);
  const priorityByAlertId = new Map(
    (data?.decisionPriority?.alerts || []).map((entry) => [String(entry.id), Number(entry.score || 0)])
  );
  const priorityByDomain = new Map(
    (data?.decisionPriority?.domains || []).map((entry) => [String(entry.domain).toLowerCase(), Number(entry.score || 0)])
  );

  for (const [domain, row] of Object.entries(state.driftReport?.domains || {})) {
    const findings = Number(row.totalFindings || 0);
    if (findings <= 0) continue;
    const severity = row.riskLevel === "critical" ? "critical" : row.riskLevel === "high" ? "high" : "medium";
    alerts.push({
      id: `drift:${domain}`,
      type: "domain-drift",
      domain,
      owner: resolveOwner(domain),
      severity,
      explanation: `Dérive détectée (${findings} constats): bypass projection=${row.projectionBypassCount}, events non enregistrés=${row.unregisteredEvents}, cross-domain=${row.crossDomainImports}.`,
      action: "Créer/traiter un ticket d’isolation + projection canonique + contract tests.",
      projectedImpact: `Derive active (${findings} constats)`,
      proofLink: "/Users/mohyi/atlas/data/architecture-drift.json",
    });
  }

  for (const gap of data.gaps || []) {
    alerts.push({
      id: `gap:${gap.domain}:${gap.type}`,
      type: "high-gap-unresolved",
      domain: gap.domain,
      owner: resolveOwner(gap.domain),
      severity: gap.severity || "medium",
      explanation: gap.message,
      action: "Corriger la structure domaine/write-path/read-path avant nouvelles features.",
      projectedImpact: `Gap ${gap.type} non traite`,
      proofLink: "/Users/mohyi/atlas/data/atlas-data.json",
    });
  }

  for (const repo of data.repos || []) {
    for (const risk of repo.risks || []) {
      alerts.push({
        id: `risk:${repo.name.toLowerCase()}:${risk.type || "generic"}`,
        type: "legacy-risk",
        domain: repo.name.toLowerCase(),
        owner: resolveOwner(repo.name.toLowerCase()),
        severity: risk.severity || "medium",
        explanation: risk.message,
        action: "Réduire la complexité locale ou déplacer la logique métier hors routes/UI.",
        projectedImpact: "Risque operatoire local",
        proofLink: "/Users/mohyi/atlas/data/atlas-data.json",
      });
    }
    for (const hotspot of (repo.hotspots || []).slice(0, 8)) {
      if (hotspot.loc < 2000) continue;
      alerts.push({
        id: `hotspot:${repo.name.toLowerCase()}:${hotspot.file}`,
        type: "legacy-hotspot",
        domain: repo.name.toLowerCase(),
        owner: resolveOwner(repo.name.toLowerCase()),
        severity: hotspot.loc >= 2800 ? "critical" : "high",
        explanation: `Hotspot volumineux: ${hotspot.file} (${hotspot.loc} LOC).`,
        action: "Découper en services d’application + ports/adapters + tests ciblés.",
        projectedImpact: `Hotspot ${hotspot.loc} LOC`,
        proofLink: "/Users/mohyi/atlas/data/atlas-data.json",
      });
    }
  }

  for (const svc of data.externalServices || []) {
    if (!svc.humanOnlyRisk) continue;
    alerts.push({
      id: `external:${svc.service}:${(svc.domains || [])[0] || "external"}`,
      type: "external-risk",
      domain: (svc.domains || [])[0] || "external",
      owner: resolveOwner((svc.domains || [])[0] || "external"),
      severity: "medium",
      explanation: `Risque fournisseur externe (${svc.service}) sur ${(svc.domains || []).join(", ") || "n/d"}.`,
      action: "Vérifier webhook/auth/secret ownership et runbook Human-Only.",
      projectedImpact: "Risque fournisseur",
      proofLink: "/Users/mohyi/atlas/data/atlas-data.json",
    });
  }

  for (const row of freshness?.alerts || []) {
    alerts.push({
      id: row.id,
      type: "snapshot-stale",
      domain: row.domain || "platform",
      owner: resolveOwner(row.domain || "platform"),
      severity: row.severity || "critical",
      explanation: `Fraicheur stale: ${row.dataset} (${row.ageHours}h, genere ${formatMediumDate(row.generatedAt)}).`,
      action: row.action || "Relancer le refresh Atlas puis rerun quality gates.",
      freshnessCritical: true,
      projectedImpact: `Snapshot stale (${row.ageHours}h)`,
      proofLink: "/Users/mohyi/atlas/data/atlas-data.json",
    });
  }

  const rank = { critical: 3, high: 2, medium: 1, low: 0 };
  for (const alert of alerts) {
    const mappedScore = priorityByAlertId.get(String(alert.id));
    const domainScore = priorityByDomain.get(String(alert.domain || "").toLowerCase()) || 0;
    const severityBonus = severityRankValue(alert.severity) * 8;
    const freshnessBoost = alert.freshnessCritical ? 40 : 0;
    alert.priorityScore = Number(((mappedScore ?? domainScore) + severityBonus + freshnessBoost).toFixed(1));
    alert.type = String(alert.type || "legacy");
    alert.owner = String(alert.owner || resolveOwner(alert.domain));
    alert.projectedImpact = String(alert.projectedImpact || "n/d");
    alert.proofLink = String(alert.proofLink || "/Users/mohyi/atlas/data/atlas-data.json");
    const overrideState = state.alertStateOverrides[String(alert.id)];
    alert.state = normalizeAlertState(overrideState || alert.state || "open");
    alert.action = String(alert.action || "Traiter l'alerte selon le playbook Atlas.");
  }

  alerts.sort((a, b) => {
    const delta = Number(b.priorityScore || 0) - Number(a.priorityScore || 0);
    if (delta !== 0) return delta;
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
  return alerts.slice(0, 80);
}

function renderArchitectureAlerts(data) {
  const alerts = buildArchitectureAlerts(data);
  const counts = countAlertsBySeverity(alerts);
  const activeSeverityFilter = state.alertSeverityFilter || "all";
  const activeDomainFilter = state.alertDomainFilter || "all";
  const activeOwnerFilter = state.alertOwnerFilter || "all";
  const activeTypeFilter = state.alertTypeFilter || "all";
  const activeStateFilter = state.alertStateFilter || "all";
  const stateCounts = alerts.reduce(
    (acc, row) => {
      const key = normalizeAlertState(row.state);
      if (Object.prototype.hasOwnProperty.call(acc, key)) acc[key] += 1;
      return acc;
    },
    { open: 0, "in-progress": 0, done: 0 }
  );
  const filteredAlerts = alerts.filter((row) => {
    if (activeSeverityFilter !== "all" && row.severity !== activeSeverityFilter) return false;
    if (activeDomainFilter !== "all" && String(row.domain || "") !== activeDomainFilter) return false;
    if (activeOwnerFilter !== "all" && String(row.owner || "") !== activeOwnerFilter) return false;
    if (activeTypeFilter !== "all" && String(row.type || "") !== activeTypeFilter) return false;
    if (activeStateFilter !== "all" && normalizeAlertState(row.state) !== activeStateFilter) return false;
    return true;
  });
  const filterOptions = [
    { id: "all", label: "Tout", count: alerts.length },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "high", label: "High", count: counts.high },
    { id: "medium", label: "Medium", count: counts.medium },
    { id: "low", label: "Low", count: counts.low },
  ];
  const domainOptions = ["all", ...new Set(alerts.map((row) => String(row.domain || "platform"))).values()];
  const ownerOptions = ["all", ...new Set(alerts.map((row) => String(row.owner || "atlas-ops"))).values()];
  const typeOptions = ["all", ...new Set(alerts.map((row) => String(row.type || "unknown"))).values()];
  const stateOptions = [
    { id: "all", label: "all", count: alerts.length },
    { id: "open", label: "open", count: stateCounts.open },
    { id: "in-progress", label: "in-progress", count: stateCounts["in-progress"] },
    { id: "done", label: "done", count: stateCounts.done },
  ];
  const proofAlert = alerts.find((row) => String(row.id) === String(state.activeAlertProofId || "")) || null;
  const openCount = stateCounts.open + stateCounts["in-progress"];

  return `
    <section class="card">
      <h3>Queue opérationnelle d'alertes ${tip("Alerte = unité d'action: priorité, owner explicite, action suivante, preuve traçable.")}</h3>
      <div class="alert-toolbar">
        <div class="alert-filter-group">
          ${filterOptions
            .map(
              (option) => `
            <button type="button" class="alert-filter-btn ${activeSeverityFilter === option.id ? "active" : ""}" data-alert-filter="${option.id}">
              ${safe(option.label)} <span class="mono">${option.count}</span>
            </button>
          `
            )
            .join("")}
        </div>
        <div class="alert-select-group">
          <label class="mono" for="alert-domain-filter">domain</label>
          <select id="alert-domain-filter" class="alert-select" data-alert-domain-filter>
            ${domainOptions
              .map((value) => `<option value="${safe(value)}" ${activeDomainFilter === value ? "selected" : ""}>${safe(value)}</option>`)
              .join("")}
          </select>
          <label class="mono" for="alert-owner-filter">owner</label>
          <select id="alert-owner-filter" class="alert-select" data-alert-owner-filter>
            ${ownerOptions
              .map((value) => `<option value="${safe(value)}" ${activeOwnerFilter === value ? "selected" : ""}>${safe(value)}</option>`)
              .join("")}
          </select>
          <label class="mono" for="alert-type-filter">type</label>
          <select id="alert-type-filter" class="alert-select" data-alert-type-filter>
            ${typeOptions
              .map((value) => `<option value="${safe(value)}" ${activeTypeFilter === value ? "selected" : ""}>${safe(value)}</option>`)
              .join("")}
          </select>
          <label class="mono" for="alert-state-filter">state</label>
          <select id="alert-state-filter" class="alert-select" data-alert-state-filter>
            ${stateOptions
              .map((value) => `<option value="${safe(value.id)}" ${activeStateFilter === value.id ? "selected" : ""}>${safe(value.label)} (${value.count})</option>`)
              .join("")}
          </select>
        </div>
        <div class="alert-summary mono">open=${stateCounts.open} · in-progress=${stateCounts["in-progress"]} · done=${stateCounts.done} · actives=${openCount}</div>
      </div>
      <div class="alert-queue">
        ${
          filteredAlerts.length
            ? filteredAlerts
                .map((row) => {
                  const normalizedState = normalizeAlertState(row.state);
                  const proofHref = resolveProofHref(row.proofLink);
                  const rowIdToken = encodeURIComponent(String(row.id));
                  return `
                    <article class="alert-queue-card">
                      <div class="alert-queue-head">
                        <strong>${safe(row.domain)} · ${safe(row.type)}</strong>
                        <div class="alert-queue-badges">
                          <span class="badge ${alertStateBadgeClass(normalizedState)}">${safe(alertStateLabel(normalizedState))}</span>
                          <span class="badge ${row.severity === "critical" ? "fail" : row.severity === "high" ? "warn" : "pass"}">${safe(row.severity)}</span>
                          <span class="badge ${Number(row.priorityScore || 0) >= 80 ? "fail" : Number(row.priorityScore || 0) >= 60 ? "warn" : "pass"}">${Number(row.priorityScore || 0)}</span>
                        </div>
                      </div>
                      <div class="alert-queue-meta mono">owner=${safe(row.owner)} · impact=${safe(row.projectedImpact || "n/d")}</div>
                      <div class="alert-queue-change">${safe(row.explanation)}</div>
                      <div class="alert-queue-action"><strong>Action:</strong> ${safe(row.action)}</div>
                      <div class="alert-state-actions">
                        <button type="button" class="alert-state-btn ${normalizedState === "open" ? "active" : ""}" data-alert-id="${rowIdToken}" data-alert-next-state="open" data-kpi-event="owner-action,priority" data-kpi-domain="${safe(row.domain)}">open</button>
                        <button type="button" class="alert-state-btn ${normalizedState === "in-progress" ? "active" : ""}" data-alert-id="${rowIdToken}" data-alert-next-state="in-progress" data-kpi-event="owner-action,priority" data-kpi-domain="${safe(row.domain)}">in-progress</button>
                        <button type="button" class="alert-state-btn ${normalizedState === "done" ? "active" : ""}" data-alert-id="${rowIdToken}" data-alert-next-state="done" data-kpi-event="owner-action,priority" data-kpi-domain="${safe(row.domain)}">done</button>
                      </div>
                      <div class="alert-queue-links">
                        <div class="alert-context-actions">
                          <button type="button" class="inline-btn" data-alert-proof-open="${rowIdToken}" data-kpi-event="priority,rationale,drilldown" data-kpi-domain="${safe(row.domain)}">Voir preuves</button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-evidence-context="${encodeURIComponent(String(row.domain || ""))}"
                            data-evidence-source="alerts"
                            data-evidence-proof-path="${encodeURIComponent(String(row.proofLink || ""))}"
                            data-evidence-alert-id="${rowIdToken}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Espace preuves
                          </button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-graph-context="${encodeURIComponent(String(row.domain || ""))}"
                            data-context-source="alerts"
                            data-context-alert-id="${rowIdToken}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Enquête graphe
                          </button>
                          <button
                            type="button"
                            class="inline-btn"
                            data-open-radar-context="${encodeURIComponent(String(row.domain || ""))}"
                            data-context-source="alerts"
                            data-context-alert-id="${rowIdToken}"
                            data-kpi-event="priority,rationale,drilldown"
                            data-kpi-domain="${safe(row.domain)}"
                          >
                            Radar domaine
                          </button>
                        </div>
                        ${
                          proofHref
                            ? `<a class="mono" href="${safe(proofHref)}" target="_blank" rel="noreferrer noopener" data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(row.domain)}">Ouvrir source</a>`
                            : `<span class="mono">${safe(row.proofLink || "preuve n/d")}</span>`
                        }
                      </div>
                    </article>
                  `;
                })
                .join("")
            : `<div class="detail-item"><span class="mono">Aucune alerte pour severity=${safe(activeSeverityFilter)}, domain=${safe(activeDomainFilter)}, owner=${safe(activeOwnerFilter)}, type=${safe(activeTypeFilter)}, state=${safe(activeStateFilter)}.</span></div>`
        }
      </div>
      ${
        proofAlert
          ? `
            <div class="alert-proof-drawer">
              <div class="section-head">
                <strong>Preuve · ${safe(proofAlert.domain)} · ${safe(proofAlert.type)}</strong>
                <button type="button" class="inline-btn" data-alert-proof-close>Fermer</button>
              </div>
              <div class="mono">sourceFile=${safe(proofAlert.sourceFile || "n/d")} · sourcePath=${safe(proofAlert.sourcePath || "n/d")}</div>
              <div style="margin-top:6px">${safe(proofAlert.explanation || "")}</div>
              <div style="margin-top:8px">
                ${
                  resolveProofHref(proofAlert.proofLink)
                    ? `<a class="mono" href="${safe(resolveProofHref(proofAlert.proofLink))}" target="_blank" rel="noreferrer noopener" data-kpi-event="rationale,drilldown" data-kpi-domain="${safe(proofAlert.domain)}">Ouvrir le fichier de preuve</a>`
                    : `<span class="mono">${safe(proofAlert.proofLink || "preuve n/d")}</span>`
                }
              </div>
              <div style="margin-top:8px">
                <button
                  type="button"
                  class="inline-btn"
                  data-open-evidence-context="${encodeURIComponent(String(proofAlert.domain || ""))}"
                  data-evidence-source="alert-proof-drawer"
                  data-evidence-proof-path="${encodeURIComponent(String(proofAlert.proofLink || ""))}"
                  data-evidence-alert-id="${encodeURIComponent(String(proofAlert.id || ""))}"
                  data-kpi-event="priority,rationale,drilldown"
                  data-kpi-domain="${safe(proofAlert.domain)}"
                >
                  Ouvrir dans l'espace preuves
                </button>
              </div>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function averageDomainScoreFromMap(domainScores) {
  const values = Object.values(domainScores || {}).map((value) => Number(value || 0)).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
}

function renderTimeMachine() {
  const snapshots = Array.isArray(state.timeMachine?.snapshots) ? state.timeMachine.snapshots.slice(0, 12) : [];
  if (!snapshots.length) {
    return `
      <section class="card">
        <h3>Machine à remonter l'architecture</h3>
        <p>Aucun historique de snapshots disponible. Exécute <span class="mono">npm run atlas:scan</span> pour générer la timeline.</p>
      </section>
    `;
  }

  const recent = snapshots.slice(0, 4);
  const timelineCards = recent
    .map((snap, index) => {
      const prev = recent[index + 1];
      const avgScore = averageDomainScoreFromMap(snap.domainScores);
      const prevScore = prev ? averageDomainScoreFromMap(prev.domainScores) : avgScore;
      const scoreDelta = avgScore - prevScore;
      const locDelta = Number(snap.loc || 0) - Number(prev?.loc || snap.loc || 0);
      const gapDelta = Number(snap.gapCount || 0) - Number(prev?.gapCount || snap.gapCount || 0);

      let trend = "✔ amélioration";
      let trendClass = "pass";
      if (scoreDelta < 0 || gapDelta > 0 || locDelta > 0) {
        trend = scoreDelta <= -2 || gapDelta >= 2 ? "❌ dégradation" : "⚠ dérive";
        trendClass = scoreDelta <= -2 || gapDelta >= 2 ? "fail" : "warn";
      }

      return `
        <article class="card timeline-card">
          <div class="timeline-label">${index === 0 ? "N" : `N-${index}`}</div>
          <div class="mono">${safe(new Date(snap.generatedAt).toLocaleString())}</div>
          <div class="timeline-metrics">
            <span>score=${avgScore}</span>
            <span>projections=${snap.projections?.count ?? 0}</span>
            <span>gaps=${snap.gapCount ?? 0}</span>
            <span>services=${snap.externalServicesCount ?? 0}</span>
            <span>loc=${snap.loc ?? 0}</span>
          </div>
          <span class="badge ${trendClass}">${trend}</span>
        </article>
      `;
    })
    .join("");

  return `
    <section class="card">
      <h3>Machine à remonter l'architecture ${tip("Timeline N → N-1 → N-2 → N-3. Compare score, complexité et dette architecture entre snapshots.")}</h3>
      <div class="timeline-grid">${timelineCards}</div>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Instantané</th>
            <th>Score moyen</th>
            <th>Projections</th>
            <th>Écarts</th>
            <th>Services</th>
            <th>LOC</th>
            <th>Routes</th>
            <th>Tests</th>
          </tr>
        </thead>
        <tbody>
          ${snapshots
            .slice(0, 12)
            .map((snap, index) => `
              <tr>
                <td>${index === 0 ? "N" : `N-${index}`}</td>
                <td>${averageDomainScoreFromMap(snap.domainScores)}</td>
                <td>${snap.projections?.count ?? 0}</td>
                <td>${snap.gapCount ?? 0}</td>
                <td>${snap.externalServicesCount ?? 0}</td>
                <td>${snap.loc ?? 0}</td>
                <td>${snap.routeCount ?? 0}</td>
                <td>${snap.testCount ?? 0}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderGaps(data) {
  return `
    <section class="card">
      <h3>Écarts actuels vs cible V3</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Type</th>
            <th>Sévérité</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          ${data.gaps
            .map(
              (gap) => `
            <tr>
              <td>${safe(gap.domain)}</td>
              <td>${safe(gap.type)}</td>
              <td class="${gap.severity === "critical" ? "risk-critical" : gap.severity === "high" ? "risk-high" : ""}">
                ${safe(gap.severity)}
              </td>
              <td>${safe(gap.message)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderHistory(data) {
  const history = state.history;
  const prev = state.previousSnapshot;
  if (!history || !Array.isArray(history.snapshots) || history.snapshots.length < 2 || !prev) {
    return `
      <section class="card">
        <h3>Historique / Diff</h3>
        <p>Aucun snapshot précédent disponible. Relance <span class="mono">npm run atlas:scan</span> pour créer le diff N vs N-1.</p>
      </section>
    `;
  }

  const currentSummary = history.snapshots[history.snapshots.length - 1].summary || {};
  const prevSummary = history.snapshots[history.snapshots.length - 2].summary || {};

  const currentScores = Object.fromEntries(data.domainProfiles.map((d) => [d.domain, d.overallScore]));
  const previousScores = prevSummary.domainScores || {};
  const allDomains = [...new Set([...Object.keys(currentScores), ...Object.keys(previousScores)])].sort((a, b) => a.localeCompare(b));

  const rows = allDomains
    .map((domain) => {
      const now = currentScores[domain];
      const before = previousScores[domain];
      const delta = typeof now === "number" && typeof before === "number" ? now - before : null;
      const cls = delta === null ? "" : delta < 0 ? "risk-high" : delta > 0 ? "" : "mono";
      return `
        <tr>
          <td>${safe(domain)}</td>
          <td>${typeof now === "number" ? now : "n/d"}</td>
          <td>${typeof before === "number" ? before : "n/d"}</td>
          <td class="${cls}">${delta === null ? "n/d" : `${delta > 0 ? "+" : ""}${delta}`}</td>
        </tr>
      `;
    })
    .join("");

  const currentRepoStats = Object.fromEntries(
    data.repos.map((repo) => [
      repo.name,
      {
        loc: repo.loc,
        routes: repo.routes.length,
        tests: repo.tests.length,
      },
    ])
  );
  const prevRepoStats = Object.fromEntries(
    (prev.repos || []).map((repo) => [
      repo.name,
      {
        loc: repo.loc,
        routes: repo.routes?.length || 0,
        tests: repo.tests?.length || 0,
      },
    ])
  );
  const repoNames = [...new Set([...Object.keys(currentRepoStats), ...Object.keys(prevRepoStats)])].sort((a, b) => a.localeCompare(b));

  return `
    <section class="grid">
      <article class="card">
        <h3>Résumé snapshot (N vs N-1)</h3>
        <div class="detail-item">Actuel: <span class="mono">${safe(new Date(data.generatedAt).toLocaleString())}</span></div>
        <div class="detail-item">Précédent: <span class="mono">${safe(new Date(prev.generatedAt).toLocaleString())}</span></div>
        <div class="detail-item">Nombre d'écarts: <strong>${currentSummary.gapCount ?? data.gaps.length}</strong> (${deltaLabel(currentSummary.gapCount ?? data.gaps.length, prevSummary.gapCount ?? prev.gaps?.length ?? 0)})</div>
        <div class="detail-item">Nœuds graphe: <strong>${currentSummary.graphNodes ?? data.graph.nodes.length}</strong> (${deltaLabel(currentSummary.graphNodes ?? data.graph.nodes.length, prevSummary.graphNodes ?? prev.graph?.nodes?.length ?? 0)})</div>
        <div class="detail-item">Liens graphe: <strong>${currentSummary.graphEdges ?? data.graph.edges.length}</strong> (${deltaLabel(currentSummary.graphEdges ?? data.graph.edges.length, prevSummary.graphEdges ?? prev.graph?.edges?.length ?? 0)})</div>
        <div class="detail-item">Services détectés: <strong>${currentSummary.servicesCount ?? data.externalServices.length}</strong> (${deltaLabel(currentSummary.servicesCount ?? data.externalServices.length, prevSummary.servicesCount ?? prev.externalServices?.length ?? 0)})</div>
      </article>

      <article class="card">
        <h3>Timeline d'historique</h3>
        ${(history.snapshots || [])
          .slice(-10)
          .reverse()
          .map(
            (snap, idx) => `
            <div class="detail-item">
              <strong>${idx === 0 ? "N" : idx === 1 ? "N-1" : `N-${idx}`}</strong>
              <span class="mono"> ${safe(new Date(snap.generatedAt).toLocaleString())}</span><br />
              écarts=${snap.summary?.gapCount ?? "n/d"}, domaines=${snap.summary?.domainCount ?? "n/d"}, services=${snap.summary?.servicesCount ?? "n/d"}
            </div>
          `
          )
          .join("")}
      </article>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Diff des scores par domaine</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Actuel</th>
            <th>Précédent</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Delta par dépôt</h3>
      <table>
        <thead>
          <tr>
            <th>Dépôt</th>
            <th>LOC Δ</th>
            <th>Routes Δ</th>
            <th>Tests Δ</th>
          </tr>
        </thead>
        <tbody>
          ${repoNames
            .map((name) => {
              const current = currentRepoStats[name] || { loc: 0, routes: 0, tests: 0 };
              const before = prevRepoStats[name] || { loc: 0, routes: 0, tests: 0 };
              return `
                <tr>
                  <td>${safe(name)}</td>
                  <td>${deltaLabel(current.loc, before.loc)}</td>
                  <td>${deltaLabel(current.routes, before.routes)}</td>
                  <td>${deltaLabel(current.tests, before.tests)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderScoresPanel(data) {
  const rows = architectureRows(data).sort((a, b) => b.score - a.score);
  return `
    <section class="card" style="margin-top:12px">
      <h3>Scores de santé par domaine</h3>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Global</th>
            <th>Isolation domaine</th>
            <th>Write-path canonique</th>
            <th>Discipline projection</th>
            <th>Stabilité événements</th>
            <th>Discipline contrats</th>
            <th>Observabilité</th>
            <th>Constats dérive</th>
            <th>Score projeté</th>
            <th>Alertes</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (d) => {
                const drift = getDriftDomain(d.domain);
                const driftFindings = Number(drift?.totalFindings || 0);
                const projected = drift?.healthImpact?.projectedScore;
                return `
            <tr>
              <td>${safe(d.domain)}</td>
              <td class="${d.score < 70 ? "risk-high" : ""}">${d.score}</td>
              <td>${d.domainIsolation}</td>
              <td>${d.writePath}</td>
              <td>${d.projections}</td>
              <td>${d.events}</td>
              <td>${d.contracts}</td>
              <td>${d.observability}</td>
              <td class="${driftFindings > 0 ? "risk-high" : ""}">${driftFindings}</td>
              <td class="${typeof projected === "number" && projected < 70 ? "risk-high" : ""}">${typeof projected === "number" ? projected : "n/d"}</td>
              <td>${d.warnings.length}</td>
            </tr>
          `;
              }
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function bindAlertFilters() {
  document.querySelectorAll("[data-alert-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.alertSeverityFilter = button.dataset.alertFilter || "all";
      render();
    });
  });

  document.querySelectorAll("[data-alert-domain-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.alertDomainFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-alert-owner-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.alertOwnerFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-alert-type-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.alertTypeFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-alert-state-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.alertStateFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-alert-id][data-alert-next-state]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-alert-id") || "";
      const nextState = normalizeAlertState(button.getAttribute("data-alert-next-state"));
      if (!token) return;
      const alertId = decodeURIComponent(token);
      state.alertStateOverrides[alertId] = nextState;
      render();
    });
  });

  document.querySelectorAll("[data-alert-proof-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-alert-proof-open") || "";
      if (!token) return;
      state.activeAlertProofId = decodeURIComponent(token);
      render();
    });
  });

  document.querySelectorAll("[data-alert-proof-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAlertProofId = null;
      render();
    });
  });
}

function bindViewSwitches() {
  document.querySelectorAll("[data-switch-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.getAttribute("data-switch-view");
      if (!nextView) return;
      switchViewSafely(nextView);
      render();
    });
  });
}

function bindDomainMasterActions() {
  document.querySelectorAll("[data-domain-master-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.domainMasterFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-domain-proof-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-domain-proof-open") || "";
      if (!token) return;
      state.activeDomainProofDomain = decodeURIComponent(token);
      render();
    });
  });

  document.querySelectorAll("[data-domain-proof-close]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeDomainProofDomain = null;
      render();
    });
  });
}

function bindInvestigationActions() {
  document.querySelectorAll("[data-open-evidence-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-open-evidence-context") || "";
      const source = button.getAttribute("data-evidence-source") || "context";
      const proofPathToken = button.getAttribute("data-evidence-proof-path") || "";
      const alertIdToken = button.getAttribute("data-evidence-alert-id") || "";
      const domain = token ? decodeURIComponent(token) : "";
      const proofPath = proofPathToken ? decodeURIComponent(proofPathToken) : "";
      const alertId = alertIdToken ? decodeURIComponent(alertIdToken) : null;
      setEvidenceContext({ domain, source, proofPath, alertId });
    });
  });

  document.querySelectorAll("[data-open-graph-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-open-graph-context") || "";
      if (!token) return;
      const source = button.getAttribute("data-context-source") || "context";
      const alertIdToken = button.getAttribute("data-context-alert-id") || "";
      const domain = decodeURIComponent(token);
      const alertId = alertIdToken ? decodeURIComponent(alertIdToken) : null;
      setInvestigationContext({ domain, source, alertId, view: "graph" });
    });
  });

  document.querySelectorAll("[data-open-radar-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-open-radar-context") || "";
      if (!token) return;
      const source = button.getAttribute("data-context-source") || "context";
      const alertIdToken = button.getAttribute("data-context-alert-id") || "";
      const domain = decodeURIComponent(token);
      const alertId = alertIdToken ? decodeURIComponent(alertIdToken) : null;
      setInvestigationContext({ domain, source, alertId, view: "radar" });
    });
  });

  document.querySelectorAll("[data-clear-investigation-context]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.getAttribute("data-next-view") || "domains";
      clearInvestigationContext(nextView);
    });
  });
}

function bindEvidenceControls() {
  document.querySelectorAll("[data-evidence-search]").forEach((input) => {
    input.addEventListener("input", () => {
      state.evidenceSearch = input.value || "";
      render();
    });
  });

  document.querySelectorAll("[data-evidence-type-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.evidenceTypeFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-evidence-domain-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.evidenceDomainFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-evidence-source-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.evidenceSourceFilter = select.value || "all";
      render();
    });
  });

  document.querySelectorAll("[data-evidence-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const token = button.getAttribute("data-evidence-open") || "";
      state.activeEvidenceId = token ? decodeURIComponent(token) : null;
      render();
    });
  });

  document.querySelectorAll("[data-evidence-clear-context]").forEach((button) => {
    button.addEventListener("click", () => {
      clearEvidenceContext();
    });
  });
}

function bindPortfolioControls() {
  document.querySelectorAll("[data-portfolio-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.portfolioQuadrantFilter = select.value || "all";
      render();
    });
  });
}

function bindTrendInteractions() {
  document.querySelectorAll("[data-trend-window]").forEach((button) => {
    button.addEventListener("click", () => {
      const windowSize = button.getAttribute("data-trend-window") || "14";
      state.trendWindow = windowSize;
      render();
    });
  });

  document.querySelectorAll("[data-trend-chart][data-trend-index]").forEach((node) => {
    node.addEventListener("click", () => {
      const chartId = node.getAttribute("data-trend-chart");
      const index = Number(node.getAttribute("data-trend-index"));
      if (!chartId || !Number.isInteger(index)) return;
      state.trendSelection[chartId] = index;
      render();
    });
  });
}

function bindDecisionKpiEvents() {
  if (state.decisionKpiListenerBound) return;
  const appRoot = document.getElementById("app");
  if (!appRoot) return;
  appRoot.addEventListener("click", (event) => {
    const resetNode = event.target.closest("[data-kpi-reset]");
    if (resetNode) {
      event.preventDefault();
      resetDecisionKpiSession();
      render();
      return;
    }

    const node = event.target.closest("[data-kpi-event]");
    if (!node) return;
    const kinds = node.getAttribute("data-kpi-event") || "";
    if (!kinds) return;
    trackDecisionKpiInteraction(kinds, {
      source: node.getAttribute("data-kpi-source") || "ui",
      view: node.getAttribute("data-kpi-view") || state.activeView,
      domain: node.getAttribute("data-kpi-domain") || "",
    });
  });
  state.decisionKpiListenerBound = true;
}

function bindDecisionKpiLifecycle() {
  if (state.decisionKpiLifecycleBound) return;
  window.addEventListener(
    "beforeunload",
    () => {
      finalizeDecisionKpiTelemetry();
    },
    { capture: true }
  );
  state.decisionKpiLifecycleBound = true;
}

function renderView() {
  const view = document.getElementById("view");
  const data = state.data;
  const guide = renderViewGuide(state.activeView);
  let html = "";
  switch (state.activeView) {
    case "overview":
      html =
        renderDoctrineBanner() +
        guide +
        renderMigrationBanner() +
        renderExecutiveBoard(data) +
        renderTopActionsNow(data) +
        (isFeatureEnabled("decisionKpiEnabled") ? renderDecisionKpiDashboard() : "") +
        renderExecutiveTrendPreview() +
        renderPortfolioRiskImportance(data) +
        renderWhatChanged(data) +
        renderDataArchitectureBlueprint() +
        renderActionPlanner(data) +
        renderOverview(data) +
        renderFocusInspiration(data) +
        renderScoresPanel(data);
      break;
    case "graph":
      html = renderDoctrineBanner() + guide + renderGraph();
      break;
    case "radar":
      html = renderDoctrineBanner() + guide + renderRadar(data);
      break;
    case "projections":
      html = renderDoctrineBanner() + guide + renderProjectionRegistry(data);
      break;
    case "domains":
      html =
        renderDoctrineBanner() +
        guide +
        renderDomainMaster(data) +
        renderDomainMatrix(data) +
        renderDomainOwnership(data) +
        renderCoreProjectionApps(data) +
        renderWriteRead(data);
      break;
    case "alerts":
      html = renderDoctrineBanner() + guide + renderArchitectureAlerts(data) + renderHotspots(data) + renderSecurity(data) + renderValidation(data);
      break;
    case "portfolio":
      html = renderDoctrineBanner() + guide + renderPortfolioView(data);
      break;
    case "evidence":
      html = renderDoctrineBanner() + guide + renderEvidenceAudit(data);
      break;
    case "history":
      html =
        renderDoctrineBanner() +
        guide +
        renderEvolutionTrends(data) +
        renderTrendsCorrelation() +
        renderTimeMachine() +
        renderHistory(data);
      break;
    case "roadmap":
      html = renderDoctrineBanner() + guide + renderRoadmap(data) + renderGaps(data);
      break;
    default:
      html = renderDoctrineBanner() + guide + renderOverview(data);
  }
  view.innerHTML = html;
  if (state.activeView === "graph") initGraph();
  if (state.activeView === "alerts") bindAlertFilters();
  if (state.activeView === "portfolio") bindPortfolioControls();
  if (state.activeView === "evidence") bindEvidenceControls();
  if (state.activeView === "domains") bindDomainMasterActions();
}

function updateDetail(nodeId, data) {
  if (!nodeId) {
    showDetailPanel({
      title: "Détail du graphe",
      definition: "Clique sur un nœud pour voir son rôle dans l’architecture.",
      why: "Le graphe sert à visualiser les dépendances entre dépôts, domaines, projections et fournisseurs.",
      governance: "Objectif V3: rendre explicites write-path, read-path et ownership.",
      action: "Active/désactive les filtres puis clique un nœud pour inspecter les liens.",
    });
    return;
  }
  const node = data.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const links = data.graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
  const drift =
    node.type === "domain"
      ? getDriftDomain(String(node.label || "").toLowerCase())
      : null;
  const kindFr = node.type === "repo" ? "Dépôt" : node.type === "domain" ? "Domaine" : node.type === "projection" ? "Projection" : "Fournisseur";
  showDetailPanel({
    title: `${node.label}`,
    category: node.type === "repo" ? "repo" : node.type === "domain" ? "domain" : node.type === "projection" ? "projection" : "external",
    definition: `Type: ${kindFr}. Ce nœud possède ${links.length} connexion(s) dans la carte.`,
    why: "Comprendre ce nœud aide à éviter les décisions locales qui cassent la cohérence globale.",
    governance: "Rappel: le Core décide, les projections expliquent, les apps affichent.",
    action:
      drift && typeof drift.totalFindings === "number"
        ? `Dérive=${drift.totalFindings}, risque=${drift.riskLevel}, scoreProjeté=${drift.healthImpact?.projectedScore ?? "n/d"} | ${links.length ? `Relations: ${links
            .slice(0, 6)
            .map((edge) => `${edge.from} → ${edge.to} (${edge.kind})`)
            .join(" | ")}` : "Aucune relation détectée sur le filtre actuel."}`
        : links.length
          ? `Relations principales: ${links
              .slice(0, 6)
              .map((edge) => `${edge.from} → ${edge.to} (${edge.kind})`)
              .join(" | ")}`
          : "Aucune relation détectée sur le filtre actuel.",
  });
}

function initGraph() {
  const data = state.data;
  const activeTypes = new Set([...state.graphFilter]);
  const context = getInvestigationContext();

  let sourceNodes = data.graph.nodes.filter((node) => activeTypes.has(node.type));
  let sourceNodeIds = new Set(sourceNodes.map((n) => n.id));
  let sourceEdges = data.graph.edges.filter((edge) => sourceNodeIds.has(edge.from) && sourceNodeIds.has(edge.to));

  if (context) {
    const domainNodeIds = new Set(
      data.graph.nodes
        .filter((node) => String(node?.type || "") === "domain" && normalizeDomainToken(node?.label) === context.domain)
        .map((node) => String(node.id))
    );

    if (domainNodeIds.size) {
      const contextualNodeIds = new Set(domainNodeIds);
      for (const edge of data.graph.edges || []) {
        const from = String(edge?.from || "");
        const to = String(edge?.to || "");
        if (domainNodeIds.has(from)) contextualNodeIds.add(to);
        if (domainNodeIds.has(to)) contextualNodeIds.add(from);
      }

      sourceNodes = sourceNodes.filter((node) => contextualNodeIds.has(String(node.id)));
      sourceNodeIds = new Set(sourceNodes.map((n) => n.id));
      sourceEdges = sourceEdges.filter((edge) => sourceNodeIds.has(edge.from) && sourceNodeIds.has(edge.to));
    }
  }
  const canvas = document.getElementById("graph-canvas");
  if (!sourceNodes.length) {
    canvas.innerHTML = `<div class="card">Aucun nœud visible avec les filtres actuels${context ? ` pour le contexte ${safe(context.domain)}` : ""}.</div>`;
    return;
  }

  const grouped = {
    repo: sourceNodes.filter((n) => n.type === "repo"),
    domain: sourceNodes.filter((n) => n.type === "domain"),
    projection: sourceNodes.filter((n) => n.type === "projection"),
    provider: sourceNodes.filter((n) => n.type === "provider"),
  };
  const maxRows = Math.max(...Object.values(grouped).map((arr) => arr.length), 1);
  const width = Math.max(980, Math.round((canvas.getBoundingClientRect().width || 1200) - 6));
  const height = Math.max(920, maxRows * 78 + 220);
  const cols = [
    { type: "repo", x: Math.round(width * 0.11) },
    { type: "domain", x: Math.round(width * 0.31) },
    { type: "projection", x: Math.round(width * 0.52) },
    { type: "provider", x: Math.round(width * 0.71) },
  ];

  const nodePos = new Map();
  for (const col of cols) {
    const arr = grouped[col.type];
    if (!arr.length) continue;
    arr.forEach((node, index) => {
      const y = 95 + index * ((height - 180) / Math.max(arr.length, 1));
      nodePos.set(node.id, { x: col.x, y });
    });
  }

  const edgeColor = (kind) => {
    if (kind === "integration") return "#ffb8b0";
    if (kind === "consumer") return "#aef6cf";
    if (kind === "read-model") return "#ffe4b5";
    return "#9dbfd0";
  };

  const edgesSvg = sourceEdges
    .map((edge) => {
      const from = nodePos.get(edge.from);
      const to = nodePos.get(edge.to);
      if (!from || !to) return "";
      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${edgeColor(edge.kind)}" stroke-opacity="0.38" stroke-width="1.25" />`;
    })
    .join("");

  const nodesSvg = sourceNodes
    .map((node) => {
      const pos = nodePos.get(node.id);
      if (!pos) return "";
      const meta = NODE_META[node.type] || { marker: "?", color: "#999", icon: "info" };
      const labelWidth = Math.max(110, node.label.length * 8.1 + 26);
      return `
        <g class="atlas-node explainable" data-node-id="${node.id}" data-detail-text="${safe(`${node.label} ${node.type}`)}" style="cursor:pointer">
          <circle cx="${pos.x}" cy="${pos.y}" r="24" fill="${meta.color}" fill-opacity="0.98" stroke="#d8f2ff" stroke-width="1.7" />
          <text x="${pos.x}" y="${pos.y + 6}" text-anchor="middle" font-size="12" font-weight="700">${meta.marker}</text>
          <rect x="${pos.x + 32}" y="${pos.y - 14}" width="${labelWidth}" height="26" rx="8" fill="#102831" fill-opacity="0.86" stroke="#5d8391" stroke-opacity="0.62" />
          <text x="${pos.x + 44}" y="${pos.y + 3}" fill="#f3fbff" font-size="13.4" font-weight="600">${safe(node.label)}</text>
          <title>${safe(`${node.label} (${node.type})`)}</title>
        </g>
      `;
    })
    .join("");

  canvas.innerHTML = `
    <div id="graph-scroll-wrap">
      <div id="graph-pan-stage" data-base-width="${width}" data-base-height="${height}">
        <svg id="graph-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMinYMin meet">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#101f26"></rect>
          ${edgesSvg}
          ${nodesSvg}
        </svg>
      </div>
    </div>
  `;

  const clampZoom = (z) => Math.min(2.2, Math.max(0.55, z));
  const applyZoom = () => {
    const stage = document.getElementById("graph-pan-stage");
    const svg = document.getElementById("graph-svg");
    const slider = document.getElementById("graph-zoom");
    const reset = document.getElementById("graph-zoom-reset");
    if (!stage) return;
    const baseW = Number(stage.getAttribute("data-base-width") || "1600");
    const baseH = Number(stage.getAttribute("data-base-height") || "900");
    const scaledW = Math.round(baseW * state.graphZoom);
    const scaledH = Math.round(baseH * state.graphZoom);
    stage.style.width = `${scaledW}px`;
    stage.style.height = `${scaledH}px`;
    if (svg) {
      svg.setAttribute("width", String(scaledW));
      svg.setAttribute("height", String(scaledH));
      svg.style.display = "block";
    }
    if (slider) slider.value = String(Math.round(state.graphZoom * 100));
    if (reset) reset.textContent = prettyPercent(state.graphZoom);
  };

  const slider = document.getElementById("graph-zoom");
  const zoomIn = document.getElementById("graph-zoom-in");
  const zoomOut = document.getElementById("graph-zoom-out");
  const zoomReset = document.getElementById("graph-zoom-reset");
  if (slider) {
    slider.oninput = () => {
      state.graphZoom = clampZoom(Number(slider.value || 100) / 100);
      applyZoom();
    };
  }
  if (zoomIn) {
    zoomIn.onclick = () => {
      state.graphZoom = clampZoom(state.graphZoom + 0.15);
      applyZoom();
    };
  }
  if (zoomOut) {
    zoomOut.onclick = () => {
      state.graphZoom = clampZoom(state.graphZoom - 0.15);
      applyZoom();
    };
  }
  if (zoomReset) {
    zoomReset.onclick = () => {
      state.graphZoom = 1;
      applyZoom();
    };
  }
  const wrap = document.getElementById("graph-scroll-wrap");
  if (wrap) {
    wrap.addEventListener(
      "wheel",
      (event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        const direction = event.deltaY > 0 ? -0.08 : 0.08;
        state.graphZoom = clampZoom(state.graphZoom + direction);
        applyZoom();
      },
      { passive: false }
    );
  }
  applyZoom();

  document.querySelectorAll("[data-graph-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.graphFilter.add(input.dataset.graphFilter);
      else state.graphFilter.delete(input.dataset.graphFilter);
      render();
    });
  });
}

function updateTopbarContext() {
  const activeAlertsNode = document.getElementById("active-alerts-status");
  const scopeNode = document.getElementById("scope-status");
  const periodNode = document.getElementById("period-status");
  if (!activeAlertsNode || !scopeNode || !periodNode) return;

  if (!state.data) {
    activeAlertsNode.textContent = "Alertes actives: -";
    scopeNode.textContent = "Scope: -";
    periodNode.textContent = "Période: -";
    return;
  }

  const alerts = buildArchitectureAlerts(state.data);
  const activeAlerts = alerts.filter((row) => normalizeAlertState(row.state) !== "done").length;
  activeAlertsNode.textContent = `Alertes actives: ${activeAlerts}`;
  activeAlertsNode.classList.remove("pass", "warn", "fail");
  activeAlertsNode.classList.add(activeAlerts > 8 ? "fail" : activeAlerts > 3 ? "warn" : "pass");

  const repoCount = Number(state.data.repos?.length || 0);
  const domainCount = Number(state.data.domainProfiles?.length || 0);
  scopeNode.textContent = `Scope: ${repoCount} repos · ${domainCount} domaines`;

  const periodByWindow = { 7: "7j", 14: "14j", 30: "30j", 90: "90j" };
  const periodLabel = periodByWindow[state.trendWindow] || `${state.trendWindow}j`;
  const snapshotCount = Number(state.history?.snapshots?.length || 0);
  periodNode.textContent = `Période: ${periodLabel} · ${snapshotCount} snapshots`;
}

function render() {
  ensureDecisionKpiSession();
  state.activeView = resolveVisibleFallbackView(state.activeView);
  renderNav();
  renderView();
  updateTopbarContext();
  bindViewSwitches();
  bindInvestigationActions();
  bindGlobalDetailInteractions();
  bindTrendInteractions();
  bindDecisionKpiEvents();
}

async function loadData() {
  const response = await fetch("./data/atlas-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load atlas data: ${response.status}`);
  return await response.json();
}

async function loadArchitectureScore() {
  const response = await fetch("./data/architecture-score.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load architecture score: ${response.status}`);
  return await response.json();
}

async function loadArchitectureDrift() {
  const response = await fetch("./data/architecture-drift.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load architecture drift: ${response.status}`);
  return await response.json();
}

async function loadArchitectureTimeMachine() {
  const response = await fetch("./data/architecture-time-machine.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load architecture time machine: ${response.status}`);
  return await response.json();
}

async function loadHistory() {
  const response = await fetch("./data/atlas-history.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load history data: ${response.status}`);
  return await response.json();
}

async function loadServiceOpsReport() {
  const response = await fetch("./data/architecture-service-ops-live-report.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load service ops report: ${response.status}`);
  return await response.json();
}

async function loadAuditIndex() {
  const response = await fetch("./data/history/atlas-audit-index.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load audit index: ${response.status}`);
  return await response.json();
}

async function loadSnapshot(relativePath) {
  const response = await fetch(`./data/${relativePath}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load snapshot: ${response.status}`);
  return await response.json();
}

async function reloadDataIntoState() {
  state.rolloutFlags = resolveRolloutFlags();
  const data = await loadData();
  state.data = data;
  try {
    state.architectureScore = await loadArchitectureScore();
  } catch {
    state.architectureScore = null;
  }
  try {
    state.driftReport = await loadArchitectureDrift();
  } catch {
    state.driftReport = null;
  }
  try {
    state.timeMachine = await loadArchitectureTimeMachine();
  } catch {
    state.timeMachine = null;
  }
  try {
    const history = await loadHistory();
    state.history = history;
    if (history?.snapshots?.length >= 2) {
      const prevMeta = history.snapshots[history.snapshots.length - 2];
      state.previousSnapshot = await loadSnapshot(prevMeta.file);
    } else {
      state.previousSnapshot = null;
    }
  } catch {
    state.history = null;
    state.previousSnapshot = null;
  }
  try {
    state.auditIndex = await loadAuditIndex();
  } catch {
    state.auditIndex = null;
  }
  try {
    state.serviceOpsReport = await loadServiceOpsReport();
    state.decisionKpiContract = state.serviceOpsReport?.decisionKpis || null;
  } catch {
    state.serviceOpsReport = null;
    state.decisionKpiContract = null;
  }
  state.freshnessContract = resolveFreshnessContract(state.data, state.history);
  document.getElementById("generated-at").textContent = `Généré: ${new Date(data.generatedAt).toLocaleString()}`;
  updateFreshnessPill(state.freshnessContract);
}

async function bootstrap() {
  const health = document.getElementById("data-health");
  const freshnessNode = document.getElementById("freshness-status");
  bindExternalControlChannel();
  bindDecisionKpiLifecycle();
  try {
    await reloadDataIntoState();
    initializeDecisionKpiTelemetry();
    if (state.architectureScore?.domains && state.driftReport?.domains && state.timeMachine?.snapshots) {
      health.textContent = "Statut: complet";
      health.classList.add("pass");
    } else {
      health.textContent = "Statut: partiel";
      health.classList.add("warn");
    }
    if (freshnessNode) updateFreshnessPill(state.freshnessContract);
    render();
    setHelpMode(false);
  } catch (error) {
    health.textContent = "Statut: erreur";
    health.classList.add("fail");
    if (freshnessNode) {
      freshnessNode.classList.remove("pass", "warn");
      freshnessNode.classList.add("fail");
      freshnessNode.textContent = "Fraicheur: indisponible";
    }
    document.getElementById("view").innerHTML = `
      <article class="card">
        <h3>Données Atlas indisponibles</h3>
        <p class="mono">${safe(error.message)}</p>
        <p>Lance d'abord le scan et la génération des fichiers.</p>
      </article>
    `;
  }
}

bootstrap();
