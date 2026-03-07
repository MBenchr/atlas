const VIEWS = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "graph", label: "Graph", icon: "graph" },
  { id: "radar", label: "Radar", icon: "radar" },
  { id: "projections", label: "Projections", icon: "projection" },
  { id: "domains", label: "Domains", icon: "domain" },
  { id: "alerts", label: "Alerts", icon: "risk" },
  { id: "history", label: "History", icon: "history" },
  { id: "roadmap", label: "Roadmap", icon: "roadmap" },
];

const BADGE_LABELS = {
  contractsFirst: "Contracts-first",
  canonicalWritePath: "Canonical write-path",
  projectionCanonical: "Projection canonique",
  noDuplicatedBusinessLogic: "No duplicated business logic",
  otelReady: "OTel-ready",
  pkceReady: "PKCE-ready",
  e2eProof: "E2E proof",
  moduleReady: "Module-ready",
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
  detailListenerBound: false,
  helpMode: false,
  refreshInFlight: false,
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
  if (typeof now !== "number" || typeof prev !== "number") return "n/a";
  const delta = now - prev;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
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
        governance: `Doctrine: Core decides. Projections explain. Apps render. Les consumers (${(profile.consumers || []).join(", ") || "n/a"}) ne doivent pas redécider la logique métier.`,
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
        governance: "V3 pousse des routes fines et une séparation domain/application/ports/adapters.",
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
        definition: "Vue stable dérivée du canon, destinée aux consumers.",
        why: "Permet aux apps d’afficher sans recalculer localement la logique métier.",
        governance: "Core decides. Projections explain. Apps render.",
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
            governance: "Utiliser la commande npm run atlas:serve pour activer l’API locale.",
            action: "Terminal: npm --prefix /Users/mohyi/mcp run atlas:serve",
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

function renderNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = `
    <h3>Atlas Views</h3>
    ${VIEWS.map(
      (view) => `
      <button class="${state.activeView === view.id ? "active" : ""}" data-view="${view.id}">
        <span class="nav-btn-content">${iconSvg(view.icon, "nav-icon")}<span>${view.label}</span></span>
      </button>
    `
    ).join("")}
  `;
  nav.querySelectorAll("button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      render();
    });
  });
}

function renderDoctrineBanner() {
  return `
    <section class="card doctrine-banner">
      <strong>${iconSvg("layers", "inline-icon")} Core decides. Projections explain. Apps render.</strong>
      <span class="doctrine-sub">Le cockpit signale toute reconstruction métier locale, write-path parallèle et projection non canonique.</span>
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
        <div class="kpi-caption">Repositories scanned</div>
      </article>
      <article class="card">
        <div class="kpi">${totalLoc.toLocaleString()}</div>
        <div class="kpi-caption">Scanned LOC (code files)</div>
      </article>
      <article class="card">
        <div class="kpi">${totalRoutes.toLocaleString()}</div>
        <div class="kpi-caption">Route surfaces detected</div>
      </article>
      <article class="card">
        <div class="kpi">${totalTests.toLocaleString()}</div>
        <div class="kpi-caption">Tests (unit+e2e) discovered</div>
      </article>
      <article class="card">
        <div class="kpi">${data.gaps.length}</div>
        <div class="kpi-caption">Open architectural gaps</div>
      </article>
      <article class="card">
        <div class="kpi">${averageDomainScore}</div>
        <div class="kpi-caption">Average domain health score</div>
      </article>
      <article class="card">
        <div class="kpi">${driftSummary.domainsWithDrift}</div>
        <div class="kpi-caption">Domains with drift</div>
      </article>
      <article class="card">
        <div class="kpi">${driftSummary.totalFindings}</div>
        <div class="kpi-caption">Total drift findings</div>
      </article>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Doctrine</h3>
      <div class="mono">${safe(data.doctrine.slogan)}</div>
      <div style="margin-top:10px">
        ${data.doctrine.principles.map((p) => `<span class="tag">${safe(p)}</span>`).join("")}
      </div>
    </section>

    <section style="margin-top:12px">
      <h3>Top Domain Scorecards</h3>
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
              <span class="badge ${badgeClass(domain.contracts >= 85 ? "pass" : domain.contracts >= 70 ? "warn" : "fail")}">Contract ${domain.contracts}</span>
            </div>
            <div style="margin-top:8px;font-size:0.83rem;color:var(--muted)">
              Consumers: ${(domain.consumers || []).join(", ") || "n/a"} · Warnings: ${domain.warnings.length}
            </div>
          </article>
        `
          )
          .join("")}
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Architecture Health Alerts</h3>
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
      <h3>Architecture Drift Alerts</h3>
      ${
        (driftSummary.criticalDomains || []).length
          ? driftSummary.criticalDomains
              .slice(0, 8)
              .map(
                (row) => `
        <div class="detail-item ${row.riskLevel === "critical" ? "risk-critical" : "risk-high"}">
          <strong>${safe(row.domain)}</strong> · risk=${safe(row.riskLevel)} · projected=${row.projectedScore}/100<br />
          findings=${row.totalFindings}
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
          <strong>${iconSvg("graph", "inline-icon")} Filters</strong>
          ${["repo", "domain", "projection", "provider"]
            .map(
              (type) => `
              <label class="graph-filter-label">
                <input type="checkbox" data-graph-filter="${type}" ${state.graphFilter.has(type) ? "checked" : ""} />
                ${iconSvg(NODE_META[type].icon, "tiny-icon")} <span>${type}</span>
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
            <span>Zoom</span>
            <input id="graph-zoom" type="range" min="55" max="220" value="${zoomPercent}" />
          </label>
        </div>
      </div>
      <div id="graph-canvas" aria-label="Architecture graph canvas"></div>
      <div class="legend">
        <span><span class="dot" style="background:#5ec8ff"></span>${iconSvg("repo", "tiny-icon")} Repo</span>
        <span><span class="dot" style="background:#6ce6ad"></span>${iconSvg("domain", "tiny-icon")} Domain</span>
        <span><span class="dot" style="background:#ffc36a"></span>${iconSvg("projection", "tiny-icon")} Projection</span>
        <span><span class="dot" style="background:#f88377"></span>${iconSvg("external", "tiny-icon")} Provider</span>
      </div>
    </section>
  `;
}

function renderCoreProjectionApps(data) {
  const rows = architectureRows(data);
  const byDomain = new Map(rows.map((row) => [String(row.domain).toLowerCase(), row]));
  return `
    <section class="card">
      <h3>Core Decides / Projections Explain / Apps Render</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>AHS</th>
            <th>Core decides</th>
            <th>Projection status</th>
            <th>Apps render-only</th>
            <th>Consumers</th>
            <th>Drift signals</th>
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
                    <div class="mono" style="font-size:0.73rem;margin-top:4px">risk=${safe(driftRisk)}${typeof projectedScore === "number" ? ` · projected=${projectedScore}` : ""}</div>
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

function renderWriteRead(data) {
  return `
    <section class="card">
      <h3>Write Path / Read Path Discipline</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Canonical write-path</th>
            <th>Write outside core</th>
            <th>Projection signals</th>
            <th>Drift findings</th>
            <th>Consumers</th>
            <th>Status</th>
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
                    <div class="mono" style="font-size:0.73rem;margin-top:4px">projectionBypass=${projectionBypassCount}</div>
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
      <h3>External Services</h3>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Repos</th>
            <th>Domains</th>
            <th>Human-only risk</th>
            <th>Maturity</th>
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
              <td>${svc.humanOnlyRisk ? "Possible" : "Low"}</td>
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
            <div style="margin-bottom:8px;color:var(--muted)">Security/Auth signals</div>
            ${(repo.securitySignals || [])
              .map(
                (signal) =>
                  `<div class="detail-item"><strong>${safe(signal.signal)}</strong> · <span class="mono">${signal.count}</span> hit(s)</div>`
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
      <h3>Validation & Proof Matrix</h3>
      <table>
        <thead>
          <tr>
            <th>Repo</th>
            <th>Validation commands</th>
            <th>Tests found</th>
            <th>E2E found</th>
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
        <h3>Top Hotspot Files</h3>
        <table>
          <thead><tr><th>Repo</th><th>File</th><th>LOC</th></tr></thead>
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
        <h3>Detected Risks</h3>
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
        <h3>Architecture Drift Warnings</h3>
        ${
          driftDomains.length
            ? `
              <table>
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Findings</th>
                    <th>Risk</th>
                    <th>Projected score</th>
                  </tr>
                </thead>
                <tbody>
                  ${driftDomains
                    .map(
                      (row) => `
                    <tr>
                      <td>${safe(row.domain)}</td>
                      <td class="${row.totalFindings > 0 ? "risk-high" : ""}">${row.totalFindings}</td>
                      <td class="${row.riskLevel === "critical" ? "risk-critical" : row.riskLevel === "high" ? "risk-high" : ""}">${safe(row.riskLevel || "unknown")}</td>
                      <td>${row.healthImpact?.projectedScore ?? "n/a"}</td>
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
      <h3>Roadmap / Extraction Trajectory</h3>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Domain</th>
            <th>Ticket</th>
            <th>Readiness</th>
            <th>Status</th>
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
      <h3>Projection Registry ${tip("Source: docs/projection-registry.md. Chaque projection multi-consumer doit être canonique, déclarée, et stable.")}</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Projection</th>
            <th>Consumers</th>
            <th>Owner</th>
            <th>Canonical</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const status = String(row.status || "unknown");
              const klass = status === "canonical" ? "pass" : status === "duplicate" ? "warn" : "fail";
              const icon = status === "canonical" ? "✔" : status === "duplicate" ? "⚠" : "❌";
              return `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td class="mono">${safe(row.projection)}</td>
                  <td>${safe((row.consumers || []).join(", ") || "n/a")}</td>
                  <td>${safe(row.owner || "n/a")}</td>
                  <td><span class="badge ${row.canonical ? "pass" : "fail"}">${row.canonical ? "true" : "false"}</span></td>
                  <td><span class="badge ${klass}">${icon} ${safe(status)}</span></td>
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
      <h3>Domain Ownership ${tip("Chaque domaine a un owner unique. Les consumers lisent via projection canonique, sans redécider le métier.")}</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Owner</th>
            <th>Consumers</th>
            <th>Score</th>
            <th>Risks</th>
            <th>Projection coverage</th>
          </tr>
        </thead>
        <tbody>
          ${ownership
            .map((row) => {
              const score = Number(scoreByDomain.get(String(row.domain).toLowerCase()) || 0);
              const drift = getDriftDomain(row.domain);
              const riskCount = Number(drift?.totalFindings || 0);
              const projCoverage = Array.isArray(row.projections) && row.projections.length > 0 ? "covered" : "missing";
              return `
                <tr>
                  <td>${safe(row.domain)}</td>
                  <td>${safe(row.owner || "n/a")}</td>
                  <td>${safe((row.consumers || []).join(", ") || "n/a")}</td>
                  <td class="${score < 70 ? "risk-high" : ""}">${score || "n/a"}</td>
                  <td class="${riskCount > 0 ? "risk-high" : ""}">${riskCount}</td>
                  <td><span class="badge ${projCoverage === "covered" ? "pass" : "fail"}">${projCoverage}</span></td>
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
    { key: "architectureHealth", label: "Architecture health" },
    { key: "projectionDiscipline", label: "Projection discipline" },
    { key: "validationMaturity", label: "Validation maturity" },
    { key: "extractionReadiness", label: "Extraction readiness" },
  ];

  return `
    <section class="card">
      <h3>Architecture Radar ${tip("Radar simplifié par domaine sur 4 axes de pilotage. Permet d’identifier immédiatement les domaines à risque.")}</h3>
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
      explanation: `Drift détectée (${findings} findings): bypass projection=${row.projectionBypassCount}, events non enregistrés=${row.unregisteredEvents}, cross-domain=${row.crossDomainImports}.`,
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
      explanation: `Risque fournisseur externe (${svc.service}) sur ${(svc.domains || []).join(", ") || "n/a"}.`,
      action: "Vérifier webhook/auth/secret ownership et runbook Human-Only.",
    });
  }

  const rank = { critical: 3, high: 2, medium: 1, low: 0 };
  alerts.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0));
  return alerts.slice(0, 80);
}

function renderArchitectureAlerts(data) {
  const alerts = buildArchitectureAlerts(data);
  return `
    <section class="card">
      <h3>Architecture Alerts ${tip("Alerte = violation potentielle de la doctrine: write-path hors canon, projection manquante, duplication métier, couplage cross-domain.")}</h3>
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
          ${alerts
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
            .join("")}
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
        <h3>Architecture Time Machine</h3>
        <p>Snapshot history not available yet. Run <span class="mono">npm run atlas:scan</span> to generate timeline snapshots.</p>
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
      <h3>Architecture Time Machine ${tip("Timeline N → N-1 → N-2 → N-3. Compare score, complexité et dette architecture entre snapshots.")}</h3>
      <div class="timeline-grid">${timelineCards}</div>
      <table style="margin-top:10px">
        <thead>
          <tr>
            <th>Snapshot</th>
            <th>Avg score</th>
            <th>Projections</th>
            <th>Gaps</th>
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
      <h3>Current vs Target V3 Gaps</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Gap</th>
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
        <h3>History / Diff</h3>
        <p>No previous snapshot available yet. Run <span class="mono">npm run atlas:scan</span> again to create N vs N-1 diff.</p>
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
          <td>${typeof now === "number" ? now : "n/a"}</td>
          <td>${typeof before === "number" ? before : "n/a"}</td>
          <td class="${cls}">${delta === null ? "n/a" : `${delta > 0 ? "+" : ""}${delta}`}</td>
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
        <h3>Snapshot Summary (N vs N-1)</h3>
        <div class="detail-item">Current: <span class="mono">${safe(new Date(data.generatedAt).toLocaleString())}</span></div>
        <div class="detail-item">Previous: <span class="mono">${safe(new Date(prev.generatedAt).toLocaleString())}</span></div>
        <div class="detail-item">Gap count: <strong>${currentSummary.gapCount ?? data.gaps.length}</strong> (${deltaLabel(currentSummary.gapCount ?? data.gaps.length, prevSummary.gapCount ?? prev.gaps?.length ?? 0)})</div>
        <div class="detail-item">Graph nodes: <strong>${currentSummary.graphNodes ?? data.graph.nodes.length}</strong> (${deltaLabel(currentSummary.graphNodes ?? data.graph.nodes.length, prevSummary.graphNodes ?? prev.graph?.nodes?.length ?? 0)})</div>
        <div class="detail-item">Graph edges: <strong>${currentSummary.graphEdges ?? data.graph.edges.length}</strong> (${deltaLabel(currentSummary.graphEdges ?? data.graph.edges.length, prevSummary.graphEdges ?? prev.graph?.edges?.length ?? 0)})</div>
        <div class="detail-item">Services detected: <strong>${currentSummary.servicesCount ?? data.externalServices.length}</strong> (${deltaLabel(currentSummary.servicesCount ?? data.externalServices.length, prevSummary.servicesCount ?? prev.externalServices?.length ?? 0)})</div>
      </article>

      <article class="card">
        <h3>History Timeline</h3>
        ${(history.snapshots || [])
          .slice(-10)
          .reverse()
          .map(
            (snap, idx) => `
            <div class="detail-item">
              <strong>${idx === 0 ? "N" : idx === 1 ? "N-1" : `N-${idx}`}</strong>
              <span class="mono"> ${safe(new Date(snap.generatedAt).toLocaleString())}</span><br />
              gaps=${snap.summary?.gapCount ?? "n/a"}, domains=${snap.summary?.domainCount ?? "n/a"}, services=${snap.summary?.servicesCount ?? "n/a"}
            </div>
          `
          )
          .join("")}
      </article>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Domain Score Diff</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Current</th>
            <th>Previous</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>

    <section class="card" style="margin-top:12px">
      <h3>Repo Delta</h3>
      <table>
        <thead>
          <tr>
            <th>Repo</th>
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
      <h3>Domain Health Scores</h3>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Overall</th>
            <th>Domain Isolation</th>
            <th>Canonical Write Path</th>
            <th>Projection Discipline</th>
            <th>Event Stability</th>
            <th>Contract Discipline</th>
            <th>Observability</th>
            <th>Drift Findings</th>
            <th>Projected Score</th>
            <th>Warnings</th>
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
              <td class="${typeof projected === "number" && projected < 70 ? "risk-high" : ""}">${typeof projected === "number" ? projected : "n/a"}</td>
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

function renderView() {
  const view = document.getElementById("view");
  const data = state.data;
  let html = "";
  switch (state.activeView) {
    case "overview":
      html = renderDoctrineBanner() + renderOverview(data) + renderScoresPanel(data);
      break;
    case "graph":
      html = renderDoctrineBanner() + renderGraph();
      break;
    case "radar":
      html = renderDoctrineBanner() + renderRadar(data);
      break;
    case "projections":
      html = renderDoctrineBanner() + renderProjectionRegistry(data);
      break;
    case "domains":
      html = renderDoctrineBanner() + renderDomainOwnership(data) + renderCoreProjectionApps(data) + renderWriteRead(data);
      break;
    case "alerts":
      html = renderDoctrineBanner() + renderArchitectureAlerts(data) + renderHotspots(data) + renderSecurity(data) + renderValidation(data);
      break;
    case "history":
      html = renderDoctrineBanner() + renderTimeMachine() + renderHistory(data);
      break;
    case "roadmap":
      html = renderDoctrineBanner() + renderRoadmap(data) + renderGaps(data);
      break;
    default:
      html = renderDoctrineBanner() + renderOverview(data);
  }
  view.innerHTML = html;
  if (state.activeView === "graph") initGraph();
}

function updateDetail(nodeId, data) {
  if (!nodeId) {
    showDetailPanel({
      title: "Détail du graphe",
      definition: "Clique sur un nœud pour voir son rôle dans l’architecture.",
      why: "Le graphe sert à visualiser les dépendances entre repos, domaines, projections et providers.",
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
  const kindFr = node.type === "repo" ? "Repository" : node.type === "domain" ? "Domaine" : node.type === "projection" ? "Projection" : "Provider";
  showDetailPanel({
    title: `${node.label}`,
    category: node.type === "repo" ? "repo" : node.type === "domain" ? "domain" : node.type === "projection" ? "projection" : "external",
    definition: `Type: ${kindFr}. Ce nœud possède ${links.length} connexion(s) dans la carte.`,
    why: "Comprendre ce nœud aide à éviter les décisions locales qui cassent la cohérence globale.",
    governance: "Rappel: Core decides. Projections explain. Apps render.",
    action:
      drift && typeof drift.totalFindings === "number"
        ? `Drift=${drift.totalFindings}, risk=${drift.riskLevel}, projectedScore=${drift.healthImpact?.projectedScore ?? "n/a"} | ${links.length ? `Relations: ${links
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
  document.getElementById("generated-at").textContent = `Generated: ${new Date(data.generatedAt).toLocaleString()}`;
}

async function bootstrap() {
  const health = document.getElementById("data-health");
  try {
    await reloadDataIntoState();
    if (state.architectureScore?.domains && state.driftReport?.domains && state.timeMachine?.snapshots) {
      health.textContent = "Data: loaded";
      health.classList.add("pass");
    } else {
      health.textContent = "Data: partial";
      health.classList.add("warn");
    }
    render();
    setHelpMode(false);
  } catch (error) {
    health.textContent = "Data: error";
    health.classList.add("fail");
    document.getElementById("view").innerHTML = `
      <article class="card">
        <h3>Atlas data not available</h3>
        <p class="mono">${safe(error.message)}</p>
        <p>Run scan + build first.</p>
      </article>
    `;
  }
}

bootstrap();
