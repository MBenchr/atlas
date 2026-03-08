const VIEWS = [
  { id: "overview", label: "Vue d'ensemble", icon: "overview", group: "pilotage", hint: "Décision rapide" },
  { id: "alerts", label: "Alertes", icon: "risk", group: "pilotage", hint: "Urgences architecture" },
  { id: "history", label: "Historique", icon: "history", group: "pilotage", hint: "Évolution temporelle" },
  { id: "domains", label: "Domaines", icon: "domain", group: "architecture", hint: "Ownership et discipline" },
  { id: "projections", label: "Projections", icon: "projection", group: "architecture", hint: "Read-path canonique" },
  { id: "graph", label: "Carte", icon: "graph", group: "architecture", hint: "Dépendances système" },
  { id: "radar", label: "Radar", icon: "radar", group: "architecture", hint: "Comparaison multi-axes" },
  { id: "roadmap", label: "Trajectoire", icon: "roadmap", group: "trajectoire", hint: "Plan d'exécution" },
];

const VIEW_GROUPS = [
  { id: "pilotage", label: "Pilotage" },
  { id: "architecture", label: "Architecture" },
  { id: "trajectoire", label: "Trajectoire" },
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
  previousSnapshot: null,
  activeView: "overview",
  graphFilter: new Set(["repo", "domain", "projection", "provider"]),
  graphZoom: 1,
  alertSeverityFilter: "all",
  detailListenerBound: false,
  helpMode: false,
  refreshInFlight: false,
};

const runtime = (() => {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get("embed") === "1" || params.get("embed") === "true";
  return {
    embedded,
    fusion: params.get("fusion") === "1" || params.get("fusion") === "true",
  };
})();

if (runtime.embedded) {
  document.body.classList.add("embed-mode");
}

let externalControlBound = false;

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
      "Comparaison transversale: identifiez les écarts entre domaines.",
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
  history: {
    title: "Ce que montre cette vue",
    summary: "Évolution dans le temps entre snapshot courant et précédent.",
    bullets: [
      "Timeline N, N-1...: tendance dette et complexité.",
      "Diff domaines: variation des scores de santé.",
      "Diff dépôt: variation LOC, routes et tests.",
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

function renderTrendChart({ title, subtitle, points, series, emptyLabel = "Pas assez de données pour tracer une tendance." }) {
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

  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const innerWidth = width - padding.left - padding.right;
  const tickStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  return `
    <article class="card trend-card">
      <h4>${safe(title)}</h4>
      <p class="trend-subtitle">${safe(subtitle || "")}</p>
      <div class="trend-legend">
        ${seriesShapes
          .map(
            (shape) => `
          <span class="trend-legend-item">
            <span class="trend-swatch" style="background:${shape.color}"></span>
            <span>${safe(shape.label)}</span>
            <span class="mono">${safe(shape.lastLabel)}</span>
            <span class="badge ${shape.deltaClass}">Δ ${safe(shape.deltaLabel)}</span>
          </span>
        `
          )
          .join("")}
      </div>
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safe(title)}">
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#2f5463" stroke-width="1" />
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#2f5463" stroke-width="1" />
        ${seriesShapes
          .map(
            (shape) => `
          <path d="${shape.path}" fill="none" stroke="${shape.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="${shape.lastPoint.x}" cy="${shape.lastPoint.y}" r="4" fill="${shape.color}" />
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
    const focusPriority = (100 - row.score) + driftFindings * 4 + warningsCount * 2 + (trend < 0 ? Math.abs(trend) * 2 : 0);
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
              <span class="badge ${item.score < 70 ? "fail" : "warn"}">score ${item.score}</span>
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

function renderEvolutionTrends(data) {
  const historyPoints = buildHistoryTrendPoints().slice(-14);
  const machinePoints = buildTimeMachineTrendPoints().slice(-12);
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
    <section class="trend-grid">
      ${renderTrendChart({
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
        title: "Évolution topologie graphe",
        subtitle: "Variation des nœuds et des liens d’architecture (couplage global).",
        points: historyPoints,
        series: [
          { key: "graphNodes", label: "Nœuds", color: "#6ce6ad", better: "lower", format: (value) => `${Math.round(value)}` },
          { key: "graphEdges", label: "Liens", color: "#ffc36a", better: "lower", format: (value) => `${Math.round(value)}` },
        ],
      })}

      ${renderTrendChart({
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
        title: "Trajectoire des domaines à surveiller",
        subtitle: "Les domaines Focus sont suivis ici pour valider l'amélioration dans le temps.",
        points: historyPoints,
        series: domainSeries,
        emptyLabel: "Pas assez de données domaines pour tracer la trajectoire Focus.",
      })}
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
  const alerts = buildArchitectureAlerts(data);
  const severity = countAlertsBySeverity(alerts);
  const snapshotsCount = Array.isArray(state.history?.snapshots) ? state.history.snapshots.length : 0;
  const averageScore = Math.round(average(rows.map((row) => row.score || 0)));
  const pendingRoadmap = (data.roadmap || []).filter((step) => String(step.status || "").toLowerCase() !== "done").length;

  return {
    overview: `${averageScore}/100`,
    alerts: `${severity.critical + severity.high}`,
    history: `${snapshotsCount}`,
    domains: `${data.domainProfiles?.length || 0}`,
    projections: `${data.projectionRegistry?.length || 0}`,
    graph: `${data.graph?.nodes?.length || 0}`,
    radar: `${data.domainProfiles?.length || 0}`,
    roadmap: `${pendingRoadmap}`,
  };
}

function renderNav() {
  const nav = document.getElementById("nav");
  const indicators = buildViewIndicators(state.data);
  nav.innerHTML = `
    <h3>Vues Atlas</h3>
    ${VIEW_GROUPS.map((group) => {
      const views = VIEWS.filter((view) => view.group === group.id);
      if (!views.length) return "";
      return `
        <div class="nav-group">
          <div class="nav-group-title">${safe(group.label)}</div>
          ${views
            .map(
              (view) => `
            <button class="${state.activeView === view.id ? "active" : ""}" data-view="${view.id}">
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
  const historyPoints = buildHistoryTrendPoints().slice(-10);
  return `
    <section style="margin-top:12px">
      ${renderTrendChart({
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

function renderDataArchitectureBlueprint() {
  return `
    <section class="blueprint-grid">
      <article class="card blueprint-card">
        <h3>1) Modèle canonique (Core)</h3>
        <p class="blueprint-sub">Une source de vérité par domaine, sans recalcul métier côté apps.</p>
        <ul class="blueprint-list">
          <li>Clés métier stables + versionnage de schéma.</li>
          <li>Événements métier idempotents horodatés.</li>
          <li>Contrats d'entrée/sortie validés strictement.</li>
        </ul>
      </article>
      <article class="card blueprint-card">
        <h3>2) Projections (Read-path)</h3>
        <p class="blueprint-sub">Des vues matérialisées par usage, pas de logique métier dupliquée.</p>
        <ul class="blueprint-list">
          <li>Projection canonique par besoin multi-consommateurs.</li>
          <li>SLA de fraîcheur explicite (temps de propagation).</li>
          <li>Traçabilité: source event → projection → écran.</li>
        </ul>
      </article>
      <article class="card blueprint-card">
        <h3>3) Plan de tables recommandé</h3>
        <p class="blueprint-sub">Structuration “facts + dimensions” pour analytics et pilotage.</p>
        <ul class="blueprint-list">
          <li>Facts: transactions, workflow, événements clés.</li>
          <li>Dimensions: domaines, équipes, canaux, période.</li>
          <li>Snapshot journalier pour tendances et comparaisons.</li>
        </ul>
      </article>
      <article class="card blueprint-card">
        <h3>4) Gouvernance data</h3>
        <p class="blueprint-sub">Qualité mesurée en continu pour éviter la dérive structurelle.</p>
        <ul class="blueprint-list">
          <li>Tests de schéma + contract tests consommateurs.</li>
          <li>Data quality checks (null, duplicats, drift).</li>
          <li>Ownership explicite par domaine et projection.</li>
        </ul>
      </article>
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
  return `
    <section class="action-grid">
      <article class="card action-column">
        <h3>Plan immédiat (7 jours)</h3>
        <p class="action-subtitle">Ce qui réduit le plus vite le risque architecture.</p>
        ${plan.immediate
          .map(
            (item, index) => `
          <div class="action-item">
            <div class="action-head">
              <strong>#${index + 1} ${safe(item.title)}</strong>
            </div>
            <div class="action-why">${safe(item.why)}</div>
            <div class="action-impact">${safe(item.impact)}</div>
          </div>
        `
          )
          .join("")}
      </article>

      <article class="card action-column">
        <h3>Plan structurant (30 jours)</h3>
        <p class="action-subtitle">Les chantiers qui améliorent durablement la composition du système.</p>
        ${plan.structural
          .map(
            (item, index) => `
          <div class="action-item">
            <div class="action-head">
              <strong>#${index + 1} ${safe(item.title)}</strong>
            </div>
            <div class="action-why">${safe(item.why)}</div>
            <div class="action-impact">${safe(item.impact)}</div>
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
      const riskPriority = (100 - row.score) + findings * 3 + Math.max(0, row.score - projected);
      return { ...row, projected, findings, consumers, riskPriority };
    })
    .sort((a, b) => b.riskPriority - a.riskPriority);

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
              <span class="badge ${row.score < 70 ? "fail" : row.score < 85 ? "warn" : "pass"}">${row.score}/100</span>
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

function renderOverview(data) {
  const totalLoc = data.repos.reduce((acc, repo) => acc + repo.loc, 0);
  const totalRoutes = data.repos.reduce((acc, repo) => acc + repo.routes.length, 0);
  const totalTests = data.repos.reduce((acc, repo) => acc + repo.tests.length, 0);
  const rows = architectureRows(data);
  const driftSummary = state.driftReport?.summary || { domainsWithDrift: 0, totalFindings: 0, criticalDomains: [] };
  const averageDomainScore = Math.round(average(rows.map((row) => row.score)));
  const topDomains = [...rows].sort((a, b) => b.score - a.score).slice(0, 6);
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

    <section class="card" style="margin-top:12px">
      <h3>Doctrine d'architecture</h3>
      <div class="mono">${safe(data.doctrine.slogan)}</div>
      <div style="margin-top:10px">
        ${data.doctrine.principles.map((p) => `<span class="tag">${safe(p)}</span>`).join("")}
      </div>
    </section>

    <section style="margin-top:12px">
      <h3>Scorecards domaines (priorité)</h3>
      <div class="grid">
        ${topDomains
          .map(
            (domain) => `
          <article class="card domain-card">
            <h4>${safe(domain.domain)} · ${domain.score}/100</h4>
            ${scoreBar(domain.score)}
            <div class="badge-row" style="margin-top:10px">
              <span class="badge ${badgeClass(domain.domainIsolation >= 85 ? "pass" : domain.domainIsolation >= 70 ? "warn" : "fail")}">Iso ${domain.domainIsolation}</span>
              <span class="badge ${badgeClass(domain.writePath >= 85 ? "pass" : domain.writePath >= 70 ? "warn" : "fail")}">Write ${domain.writePath}</span>
              <span class="badge ${badgeClass(domain.projections >= 85 ? "pass" : domain.projections >= 70 ? "warn" : "fail")}">Proj ${domain.projections}</span>
              <span class="badge ${badgeClass(domain.contracts >= 85 ? "pass" : domain.contracts >= 70 ? "warn" : "fail")}">Contrats ${domain.contracts}</span>
            </div>
            <div style="margin-top:8px;font-size:0.83rem;color:var(--muted)">
              Consommateurs: ${(domain.consumers || []).join(", ") || "n/d"} · Alertes: ${domain.warnings.length}
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
          <strong>${safe(row.domain)}</strong> · ${row.score}/100<br />
          ${safe((row.warnings || []).slice(0, 3).join(" | "))}
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
          <strong>${safe(row.domain)}</strong> · risque=${safe(row.riskLevel)} · score projeté=${row.projectedScore}/100<br />
          constats=${row.totalFindings}
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
  const domains = (data.domainProfiles || []).slice().sort((a, b) => a.domain.localeCompare(b.domain));
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
    </section>
  `;
}

function buildArchitectureAlerts(data) {
  const alerts = [];

  for (const [domain, row] of Object.entries(state.driftReport?.domains || {})) {
    const findings = Number(row.totalFindings || 0);
    if (findings <= 0) continue;
    const severity = row.riskLevel === "critical" ? "critical" : row.riskLevel === "high" ? "high" : "medium";
    alerts.push({
      domain,
      severity,
      explanation: `Dérive détectée (${findings} constats): bypass projection=${row.projectionBypassCount}, events non enregistrés=${row.unregisteredEvents}, cross-domain=${row.crossDomainImports}.`,
      action: "Créer/traiter un ticket d’isolation + projection canonique + contract tests.",
    });
  }

  for (const gap of data.gaps || []) {
    alerts.push({
      domain: gap.domain,
      severity: gap.severity || "medium",
      explanation: gap.message,
      action: "Corriger la structure domaine/write-path/read-path avant nouvelles features.",
    });
  }

  for (const repo of data.repos || []) {
    for (const risk of repo.risks || []) {
      alerts.push({
        domain: repo.name.toLowerCase(),
        severity: risk.severity || "medium",
        explanation: risk.message,
        action: "Réduire la complexité locale ou déplacer la logique métier hors routes/UI.",
      });
    }
    for (const hotspot of (repo.hotspots || []).slice(0, 8)) {
      if (hotspot.loc < 2000) continue;
      alerts.push({
        domain: repo.name.toLowerCase(),
        severity: hotspot.loc >= 2800 ? "critical" : "high",
        explanation: `Hotspot volumineux: ${hotspot.file} (${hotspot.loc} LOC).`,
        action: "Découper en services d’application + ports/adapters + tests ciblés.",
      });
    }
  }

  for (const svc of data.externalServices || []) {
    if (!svc.humanOnlyRisk) continue;
    alerts.push({
      domain: (svc.domains || [])[0] || "external",
      severity: "medium",
      explanation: `Risque fournisseur externe (${svc.service}) sur ${(svc.domains || []).join(", ") || "n/d"}.`,
      action: "Vérifier webhook/auth/secret ownership et runbook Human-Only.",
    });
  }

  const rank = { critical: 3, high: 2, medium: 1, low: 0 };
  alerts.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
  return alerts.slice(0, 80);
}

function renderArchitectureAlerts(data) {
  const alerts = buildArchitectureAlerts(data);
  const counts = countAlertsBySeverity(alerts);
  const activeFilter = state.alertSeverityFilter || "all";
  const filteredAlerts = activeFilter === "all" ? alerts : alerts.filter((row) => row.severity === activeFilter);
  const filterOptions = [
    { id: "all", label: "Tout", count: alerts.length },
    { id: "critical", label: "Critical", count: counts.critical },
    { id: "high", label: "High", count: counts.high },
    { id: "medium", label: "Medium", count: counts.medium },
    { id: "low", label: "Low", count: counts.low },
  ];

  return `
    <section class="card">
      <h3>Alertes d'architecture ${tip("Alerte = violation potentielle de la doctrine: write-path hors canon, projection manquante, duplication métier, couplage cross-domain.")}</h3>
      <div class="alert-toolbar">
        <div class="alert-filter-group">
          ${filterOptions
            .map(
              (option) => `
            <button type="button" class="alert-filter-btn ${activeFilter === option.id ? "active" : ""}" data-alert-filter="${option.id}">
              ${safe(option.label)} <span class="mono">${option.count}</span>
            </button>
          `
            )
            .join("")}
        </div>
        <div class="alert-summary mono">critical=${counts.critical} · high=${counts.high} · medium=${counts.medium} · low=${counts.low}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Domaine</th>
            <th>Sévérité</th>
            <th>Explication</th>
            <th>Action recommandée</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredAlerts.length
              ? filteredAlerts
                  .map(
                    (row) => `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td class="${row.severity === "critical" ? "risk-critical" : row.severity === "high" ? "risk-high" : ""}">
                    ${row.severity === "critical" ? "❌" : row.severity === "high" ? "⚠" : "✔"} ${safe(row.severity)}
                  </td>
                  <td>${safe(row.explanation)}</td>
                  <td>${safe(row.action)}</td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="4" class="mono">Aucune alerte pour le filtre "${safe(activeFilter)}".</td></tr>`
          }
        </tbody>
      </table>
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

function bindAlertSeverityFilters() {
  document.querySelectorAll("[data-alert-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.alertSeverityFilter = button.dataset.alertFilter || "all";
      render();
    });
  });
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
        renderExecutiveBoard(data) +
        renderExecutiveTrendPreview() +
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
        renderDomainMatrix(data) +
        renderDomainOwnership(data) +
        renderCoreProjectionApps(data) +
        renderWriteRead(data);
      break;
    case "alerts":
      html = renderDoctrineBanner() + guide + renderArchitectureAlerts(data) + renderHotspots(data) + renderSecurity(data) + renderValidation(data);
      break;
    case "history":
      html =
        renderDoctrineBanner() +
        guide +
        renderEvolutionTrends(data) +
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
  if (state.activeView === "alerts") bindAlertSeverityFilters();
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

  const sourceNodes = data.graph.nodes.filter((node) => activeTypes.has(node.type));
  const sourceNodeIds = new Set(sourceNodes.map((n) => n.id));
  const sourceEdges = data.graph.edges.filter((edge) => sourceNodeIds.has(edge.from) && sourceNodeIds.has(edge.to));
  const canvas = document.getElementById("graph-canvas");
  if (!sourceNodes.length) {
    canvas.innerHTML = `<div class="card">Aucun nœud visible avec les filtres actuels.</div>`;
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

function render() {
  renderNav();
  renderView();
  bindGlobalDetailInteractions();
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

async function loadSnapshot(relativePath) {
  const response = await fetch(`./data/${relativePath}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load snapshot: ${response.status}`);
  return await response.json();
}

async function reloadDataIntoState() {
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
  document.getElementById("generated-at").textContent = `Généré: ${new Date(data.generatedAt).toLocaleString()}`;
}

async function bootstrap() {
  const health = document.getElementById("data-health");
  bindExternalControlChannel();
  try {
    await reloadDataIntoState();
    if (state.architectureScore?.domains && state.driftReport?.domains && state.timeMachine?.snapshots) {
      health.textContent = "Données: complètes";
      health.classList.add("pass");
    } else {
      health.textContent = "Données: partielles";
      health.classList.add("warn");
    }
    render();
    setHelpMode(false);
  } catch (error) {
    health.textContent = "Données: erreur";
    health.classList.add("fail");
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
