#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const HOST = process.env.ATLAS_HOST || "127.0.0.1";
const PORT = Number(process.env.ATLAS_PORT || 4173);

const MODERN_ROOT = "/Users/mohyi/atlas";
const MCP_ROOT = "/Users/mohyi/mcp";
const LEGACY_ROOT = path.join(MCP_ROOT, "generated/atlas/site");
const LEGACY_DATA_DIR = path.join(LEGACY_ROOT, "data");
const MODERN_DATA_DIR = path.join(MODERN_ROOT, "data");
const POST_SYNC_ATLAS_SCRIPTS = [
  "generate:freshness",
  "generate:priority",
  "generate:alerts",
  "generate:trends",
  "generate:audit",
  "generate:discipline",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
};

const refreshState = {
  refreshing: false,
  lastRun: null,
  currentPromise: null,
};

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function htmlShell() {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Atlas NEXORA V3 · Cockpit d'architecture</title>
    <style>
      :root {
        --bg: #0c1518;
        --surface: #13262e;
        --line: #284754;
        --text: #e9f2f4;
        --muted: #9cb2ba;
        --accent: #49c39d;
        --ok: #4fd18b;
        --warn: #f2a65a;
        --fail: #ef6c57;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
        color: var(--text);
        background: radial-gradient(circle at top right, #143846 0%, transparent 45%), var(--bg);
      }
      .topbar {
        border-bottom: 1px solid var(--line);
        background: linear-gradient(90deg, #10212a 0%, #123340 100%);
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .title h1 { margin: 0; font-size: 1rem; }
      .title p { margin: 3px 0 0; color: var(--muted); font-size: 0.8rem; }
      .topbar-right {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 7px;
      }
      .toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
      }
      .actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .btn {
        border: 1px solid #3e6978;
        border-radius: 999px;
        background: #183947;
        color: #ecf8fc;
        padding: 5px 11px;
        cursor: pointer;
        font-size: 0.78rem;
      }
      .btn.active { border-color: #4bc29a; background: #18483b; color: #e8fff5; }
      .btn:disabled { opacity: 0.7; cursor: wait; }
      .meta-line {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .meta-chip {
        border: 1px solid #355b6a;
        border-radius: 999px;
        padding: 4px 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.74rem;
        color: #d7e5ea;
        background: #173540;
      }
      .meta-chip.ok { border-color: #2f6d4d; background: #1c4832; color: #d8ffea; }
      .meta-chip.warn { border-color: #8a6336; background: #4b3722; color: #ffe8ce; }
      .meta-chip.fail { border-color: #8a3f36; background: #4b2521; color: #ffd8d4; }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        padding: 8px;
      }
      .summary-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(19, 38, 46, 0.98), rgba(15, 32, 40, 0.96));
        padding: 12px;
      }
      .summary-card h2 {
        margin: 0 0 8px;
        font-size: 0.84rem;
        color: var(--muted);
      }
      .summary-card strong {
        display: block;
        font-size: 1.15rem;
        margin-bottom: 6px;
      }
      .summary-card p {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      .layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 8px;
      }
      .viewer-frame {
        width: 100%;
        height: calc(100vh - 320px);
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #0f2028;
      }
      .viewer-single.active {
        display: grid;
      }
      .viewer-single {
        display: none;
        gap: 8px;
      }
      .viewer-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.76rem;
        color: var(--muted);
      }
      .viewer-note {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(19, 38, 46, 0.82);
        padding: 10px 12px;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }
      @media (max-width: 980px) {
        .topbar {
          flex-direction: column;
          align-items: stretch;
        }
        .topbar-right {
          align-items: stretch;
        }
        .toolbar {
          justify-content: flex-start;
          flex-wrap: wrap;
        }
        .meta-line {
          justify-content: flex-start;
        }
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .viewer-frame { height: calc(100vh - 430px); }
      }
      @media (max-width: 680px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="title">
        <h1>Atlas NEXORA V3 · Cockpit d'architecture</h1>
        <p>Entrée opératoire unique: cockpit intégré et contexte historique sans exposer plusieurs destinations produit.</p>
      </div>
      <div class="topbar-right">
        <div class="toolbar">
          <div class="actions">
            <button id="mode-cockpit" class="btn active" type="button">Cockpit</button>
            <button id="mode-legacy-lens" class="btn" type="button">Contexte historique</button>
            <button id="refresh" class="btn" type="button">Mettre à jour</button>
            <button id="help-toggle" class="btn" type="button">Aide: OFF</button>
          </div>
        </div>
        <div class="meta-line">
          <span id="meta-updated" class="meta-chip">Mise à jour: -</span>
          <span id="meta-data" class="meta-chip">Données: chargement…</span>
          <span id="meta-status" class="meta-chip">Statut: prêt</span>
          <span id="meta-urgency" class="meta-chip">Urgence: calcul…</span>
        </div>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <h2>Priorité décisionnelle</h2>
        <strong id="summary-priority">Chargement…</strong>
        <p id="summary-priority-detail">Top domaines et action immédiate.</p>
      </article>
      <article class="summary-card">
        <h2>Alertes et fraîcheur</h2>
        <strong id="summary-alerts">Chargement…</strong>
        <p id="summary-alerts-detail">Signal critique, high, stale et cohérence globale.</p>
      </article>
      <article class="summary-card">
        <h2>Service Ops</h2>
        <strong id="summary-service-ops">Chargement…</strong>
        <p id="summary-service-ops-detail">Santé fournisseur, bindings manquants et risques à traiter.</p>
      </article>
      <article class="summary-card">
        <h2>KPI décision</h2>
        <strong id="summary-kpis">Chargement…</strong>
        <p id="summary-kpis-detail">Contrat 30s/60s/2 clics et état de la source canonique.</p>
      </article>
    </section>

    <main class="layout">
      <section id="cockpit-view" class="viewer-single active">
        <div class="viewer-label">Cockpit intégré · surface principale Atlas V3</div>
        <iframe id="cockpit-frame" class="viewer-frame" src="/modern/?embed=1&fusion=1" title="Atlas cockpit"></iframe>
      </section>
      <section id="legacy-view" class="viewer-single">
        <div class="viewer-label">Contexte historique · garder l’ancien rendu comme référence documentaire, pas comme produit séparé</div>
        <div class="viewer-note">
          Cette vue sert à conserver le contexte de l’ancien rendu pendant la transition vers l’entrée Atlas unique.
          Les chemins internes de compatibilité restent masqués et ne doivent plus être utilisés comme navigation opératoire.
        </div>
        <iframe id="legacy-frame" class="viewer-frame" src="/legacy/?embed=1&fusion=1" title="Atlas historique"></iframe>
      </section>
    </main>

    <script>
      const MODERN_SRC = "/modern/?embed=1&fusion=1";
      const LEGACY_SRC = "/legacy/?embed=1&fusion=1";
      const modeCockpit = document.getElementById("mode-cockpit");
      const modeLegacyLens = document.getElementById("mode-legacy-lens");
      const cockpitView = document.getElementById("cockpit-view");
      const legacyView = document.getElementById("legacy-view");
      const cockpitFrame = document.getElementById("cockpit-frame");
      const legacyFrame = document.getElementById("legacy-frame");
      const refreshBtn = document.getElementById("refresh");
      const helpToggle = document.getElementById("help-toggle");
      const metaUpdated = document.getElementById("meta-updated");
      const metaData = document.getElementById("meta-data");
      const metaStatus = document.getElementById("meta-status");
      const metaUrgency = document.getElementById("meta-urgency");
      const summaryPriority = document.getElementById("summary-priority");
      const summaryPriorityDetail = document.getElementById("summary-priority-detail");
      const summaryAlerts = document.getElementById("summary-alerts");
      const summaryAlertsDetail = document.getElementById("summary-alerts-detail");
      const summaryServiceOps = document.getElementById("summary-service-ops");
      const summaryServiceOpsDetail = document.getElementById("summary-service-ops-detail");
      const summaryKpis = document.getElementById("summary-kpis");
      const summaryKpisDetail = document.getElementById("summary-kpis-detail");

      let helpEnabled = false;
      let currentMode = "cockpit";
      function setChip(element, text, level) {
        element.textContent = text;
        element.classList.remove("ok", "warn", "fail");
        if (level) element.classList.add(level);
      }

      function formatDate(value) {
        if (!value) return "-";
        try {
          return new Date(value).toLocaleString("fr-FR");
        } catch {
          return String(value);
        }
      }

      function safeValue(value, fallback = "n/d") {
        if (value === undefined || value === null || value === "") return fallback;
        return String(value);
      }

      function stripInnerHeader(frame) {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          const topbar = doc.querySelector(".topbar");
          if (topbar) topbar.style.display = "none";
          const app = doc.getElementById("app");
          if (app) app.style.height = "100vh";
        } catch {
        }
      }

      function postHelpMode(targetFrame) {
        try {
          targetFrame?.contentWindow?.postMessage(
            { type: "atlas-help-mode", enabled: helpEnabled },
            window.location.origin
          );
        } catch {
        }
      }

      function broadcastHelpMode() {
        [cockpitFrame, legacyFrame].forEach(postHelpMode);
      }

      function wireFrame(frame) {
        frame.addEventListener("load", () => {
          stripInnerHeader(frame);
          postHelpMode(frame);
        });
      }

      [cockpitFrame, legacyFrame].forEach(wireFrame);

      function reloadVisibleFrames() {
        cockpitFrame.src = MODERN_SRC;
        legacyFrame.src = LEGACY_SRC;
      }

      function summarizeTopPriority(payload) {
        const top = payload?.decisionPriority?.topFive?.slice(0, 3) || [];
        if (!top.length) {
          summaryPriority.textContent = "Aucune priorité";
          summaryPriorityDetail.textContent = "Le projection decision-priority n'est pas disponible.";
          return;
        }
        summaryPriority.textContent = top.map((row) => row.domain).join(" · ");
        summaryPriorityDetail.textContent = "Top 3 courant: " + top.map((row) => row.domain + " " + row.priorityScore).join(" | ");
      }

      function summarizeAlerts(payload) {
        const freshness = payload?.freshnessContract || {};
        const taxonomy = payload?.alertsTaxonomy?.summary || {};
        const stale = Number(freshness?.staleDatasetCount || 0);
        const high = Number(taxonomy?.bySeverity?.high || 0);
        const critical = Number(taxonomy?.bySeverity?.critical || 0);
        const status = freshness?.globalStatus || "unknown";
        summaryAlerts.textContent = "freshness=" + status + " · alerts=" + Number(taxonomy?.total || 0);
        summaryAlertsDetail.textContent = "critical=" + critical + " · high=" + high + " · stale=" + stale;
      }

      function summarizeServiceOps(payload) {
        const summary = payload?.summary || {};
        const coverage = payload?.serviceCoverage || {};
        summaryServiceOps.textContent =
          "healthy=" + Number(summary.healthy || 0) + " · runtime=" + Number(summary.runtimeDegraded || 0) + " · unconfigured=" + Number(summary.unconfigured || 0) + " · down=" + Number(summary.down || 0);
        summaryServiceOpsDetail.textContent =
          "coverage=" +
          String(coverage.detectionCoveragePct ?? "n/d") +
          "% · coverage-gap=" +
          Number(coverage.unexpectedMonitoredWithoutDetectionCount || 0) +
          " · platform-only=" +
          Number(coverage.platformMonitoredOnlyCount || 0) +
          " · top risk=" +
          ((summary.topRiskServices || []).slice(0, 3).join(", ") || "n/d");
      }

      function summarizeDecisionKpis(payload) {
        const contract = payload?.decisionKpis;
        if (!contract) {
          summaryKpis.textContent = "Contrat KPI manquant";
          summaryKpisDetail.textContent = "La source canonique service-ops ne publie pas decisionKpis.";
          return;
        }
        const after = contract.postRefactorBaseline || {};
        summaryKpis.textContent =
          "30/60/2 cible · " +
          [after.timeToFirstPrioritySec, after.timeToRationaleSec, after.clicksToOwnerAction]
            .map((value) => (value === undefined ? "n/d" : String(value)))
            .join(" / ");
        summaryKpisDetail.textContent =
          "drilldown=" + String(after.drilldownRate ?? "n/d") + " · source=" + String(contract.source || "service-ops");
      }

      function computeUrgencySignal(atlasPayload, serviceOpsPayload) {
        const freshness = atlasPayload?.freshnessContract || {};
        const taxonomy = atlasPayload?.alertsTaxonomy?.summary || {};
        const serviceSummary = serviceOpsPayload?.summary || {};
        const serviceCoverage = serviceOpsPayload?.serviceCoverage || {};
        const down = Number(serviceSummary.down || 0);
        const runtime = Number(serviceSummary.runtimeDegraded || 0);
        const unconfigured = Number(serviceSummary.unconfigured || 0);
        const stale = Number(freshness.staleDatasetCount || 0);
        const freshnessStatus = String(freshness.globalStatus || "unknown");
        const critical = Number(taxonomy?.bySeverity?.critical || 0);
        const high = Number(taxonomy?.bySeverity?.high || 0);
        const missingMonitoring = Number(serviceCoverage.missingMonitoringCount || 0);
        const coverageGap = Number(serviceCoverage.unexpectedMonitoredWithoutDetectionCount || 0);

        if (down > 0) {
          return { level: "fail", label: "incident", detail: "down=" + down };
        }
        if (runtime > 0) {
          return { level: "fail", label: "runtime", detail: "degraded=" + runtime };
        }
        if (unconfigured > 0) {
          return { level: "warn", label: "configuration", detail: "unconfigured=" + unconfigured };
        }
        if (stale > 0 || freshnessStatus === "stale") {
          return { level: "fail", label: "fraicheur", detail: "stale=" + stale };
        }
        if (freshnessStatus === "degraded") {
          return { level: "warn", label: "fraicheur", detail: "status=" + freshnessStatus };
        }
        if (missingMonitoring > 0) {
          return { level: "warn", label: "coverage", detail: "missing-monitoring=" + missingMonitoring };
        }
        if (coverageGap > 0) {
          return { level: "warn", label: "coverage", detail: "unexpected=" + coverageGap };
        }
        if (critical > 0) {
          return { level: "fail", label: "alertes", detail: "critical=" + critical };
        }
        if (high > 5) {
          return { level: "warn", label: "alertes", detail: "high=" + high };
        }
        return { level: "ok", label: "stable", detail: "canonical" };
      }

      async function evaluateDataCompleteness() {
        const checks = await Promise.all(
          [
            "/modern/data/atlas-data.json",
            "/modern/data/architecture-score.json",
            "/modern/data/architecture-drift.json",
            "/modern/data/architecture-time-machine.json",
          ].map(async (url) => {
            try {
              const res = await fetch(url, { cache: "no-store" });
              return res.ok;
            } catch {
              return false;
            }
          })
        );
        return checks.every(Boolean);
      }

      async function refreshSummaryCards() {
        try {
          const [atlasRes, serviceOpsRes] = await Promise.all([
            fetch("/modern/data/atlas-data.json", { cache: "no-store" }),
            fetch("/modern/data/architecture-service-ops-live-report.json", { cache: "no-store" }),
          ]);
          let atlasPayload = null;
          let serviceOpsPayload = null;
          if (atlasRes.ok) {
            atlasPayload = await atlasRes.json();
            summarizeTopPriority(atlasPayload);
          }
          if (serviceOpsRes.ok) {
            serviceOpsPayload = await serviceOpsRes.json();
            summarizeServiceOps(serviceOpsPayload);
          }
          if (atlasPayload) {
            summarizeAlerts(atlasPayload);
          }
          if (serviceOpsPayload) {
            summarizeDecisionKpis(serviceOpsPayload);
          }
          const urgency = computeUrgencySignal(atlasPayload, serviceOpsPayload);
          setChip(metaUrgency, "Urgence: " + urgency.label + " · " + urgency.detail, urgency.level);
        } catch {
          summaryPriority.textContent = "Résumé indisponible";
          summaryAlerts.textContent = "Résumé indisponible";
          summaryServiceOps.textContent = "Résumé indisponible";
          summaryKpis.textContent = "Résumé indisponible";
          setChip(metaUrgency, "Urgence: indisponible", "fail");
        }
      }

      async function refreshHeaderMeta() {
        let generatedAt = null;
        let refreshing = false;
        let lastRun = null;

        try {
          const dataRes = await fetch("/modern/data/atlas-data.json", { cache: "no-store" });
          if (dataRes.ok) {
            const payload = await dataRes.json();
            generatedAt = payload?.generatedAt || null;
          }
        } catch {
        }

        try {
          const statusRes = await fetch("/api/refresh-status", { cache: "no-store" });
          if (statusRes.ok) {
            const statusPayload = await statusRes.json();
            refreshing = Boolean(statusPayload?.refreshing);
            lastRun = statusPayload?.lastRun || null;
          }
        } catch {
        }

        const complete = await evaluateDataCompleteness();
        setChip(metaData, complete ? "Données complètes" : "Données partielles", complete ? "ok" : "warn");

        const updatedAt = lastRun?.finishedAt || generatedAt;
        setChip(metaUpdated, "Mise à jour: " + formatDate(updatedAt), updatedAt ? "ok" : null);

        if (refreshing) {
          setChip(metaStatus, "Statut: en cours", "warn");
        } else if (lastRun?.ok) {
          setChip(metaStatus, "Statut: OK", "ok");
        } else if (lastRun && !lastRun.ok) {
          setChip(metaStatus, "Statut: erreur", "fail");
        } else {
          setChip(metaStatus, "Statut: prêt", null);
        }
        await refreshSummaryCards();
      }

      function setActive(which) {
        currentMode = which;
        modeCockpit.classList.toggle("active", which === "cockpit");
        modeLegacyLens.classList.toggle("active", which === "legacy");
        cockpitView.classList.toggle("active", which === "cockpit");
        legacyView.classList.toggle("active", which === "legacy");
      }

      modeCockpit.onclick = () => setActive("cockpit");
      modeLegacyLens.onclick = () => setActive("legacy");
      helpToggle.onclick = () => {
        helpEnabled = !helpEnabled;
        helpToggle.textContent = "Aide: " + (helpEnabled ? "ON" : "OFF");
        helpToggle.classList.toggle("active", helpEnabled);
        broadcastHelpMode();
      };

      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        setChip(metaStatus, "Statut: en cours", "warn");
        try {
          const res = await fetch("/api/refresh", { method: "POST" });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload.stderr || payload.message || ("HTTP " + res.status));
          reloadVisibleFrames();
          setActive(currentMode);
          await refreshHeaderMeta();
        } catch (error) {
          setChip(metaStatus, "Statut: erreur", "fail");
          console.error(error);
          alert("Refresh échoué: " + String(error.message || error));
        } finally {
          refreshBtn.disabled = false;
        }
      };

      refreshHeaderMeta();
    </script>
  </body>
</html>`;
}

function safeJoin(rootDir, urlPath) {
  const clean = decodeURIComponent((urlPath || "/").split("?")[0]);
  const requested = clean === "/" ? "/index.html" : clean;
  const full = path.normalize(path.join(rootDir, requested));
  if (!full.startsWith(path.normalize(rootDir))) return null;
  return full;
}

async function serveStatic(rootDir, relativeUrl, res) {
  const full = safeJoin(rootDir, relativeUrl);
  if (!full) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const stat = await fsp.stat(full);
    const filePath = stat.isDirectory() ? path.join(full, "index.html") : full;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    const content = await fsp.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".json" ? "no-store" : "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function copyDirRecursive(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
    } else {
      await fsp.copyFile(from, to);
    }
  }
}

async function syncLegacyDataToModern() {
  await fsp.mkdir(MODERN_DATA_DIR, { recursive: true });
  if (typeof fsp.cp === "function") {
    await fsp.cp(LEGACY_DATA_DIR, MODERN_DATA_DIR, { recursive: true, force: true });
    return;
  }
  await copyDirRecursive(LEGACY_DATA_DIR, MODERN_DATA_DIR);
}

function runNpmScript(cwd, scriptName) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", scriptName], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });
}

async function runPostSyncAtlasTasks() {
  let stdout = "";
  let stderr = "";
  for (const scriptName of POST_SYNC_ATLAS_SCRIPTS) {
    const result = await runNpmScript(MODERN_ROOT, scriptName);
    stdout += result.stdout;
    stderr += result.stderr;
    if (!result.ok) {
      throw new Error(`post-sync atlas script failed (${scriptName})\n${stderr.trim()}`.trim());
    }
  }
  return { stdout, stderr };
}

function runRefresh() {
  if (refreshState.currentPromise) return refreshState.currentPromise;
  refreshState.refreshing = true;
  const startedAt = new Date().toISOString();

  refreshState.currentPromise = new Promise((resolve) => {
    const child = spawn("npm", ["--prefix", MCP_ROOT, "run", "atlas:generate"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", async (code) => {
      let syncError = "";
      let postSyncOutput = { stdout: "", stderr: "" };
      if (code === 0) {
        try {
          await syncLegacyDataToModern();
          postSyncOutput = await runPostSyncAtlasTasks();
        } catch (error) {
          syncError = String(error?.message || error);
        }
      }
      const finishedAt = new Date().toISOString();
      const ok = code === 0 && !syncError;
      const result = {
        ok,
        code,
        startedAt,
        finishedAt,
        stdout: `${stdout}${postSyncOutput.stdout}`.slice(-10000),
        stderr: `${stderr}${postSyncOutput.stderr}${syncError ? `\n[sync] ${syncError}` : ""}`.slice(-8000).trim(),
      };
      refreshState.lastRun = result;
      refreshState.refreshing = false;
      refreshState.currentPromise = null;
      resolve(result);
    });
  });

  return refreshState.currentPromise;
}

function subPath(urlPath, prefix) {
  const raw = (urlPath || "/").split("?")[0];
  if (raw === prefix) return "/";
  if (raw.startsWith(`${prefix}/`)) return raw.slice(prefix.length);
  return null;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (urlPath === "/api/refresh-status") {
    return sendJson(res, 200, {
      refreshing: refreshState.refreshing,
      lastRun: refreshState.lastRun,
    });
  }
  if (urlPath === "/api/refresh" && method === "POST") {
    try {
      const result = await runRefresh();
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        message: "Refresh failed",
        error: String(error),
      });
    }
  }

  if (urlPath === "/" || urlPath === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(htmlShell());
    return;
  }

  if (urlPath === "/modern/api/refresh" && method === "POST") {
    try {
      const result = await runRefresh();
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: String(error) });
    }
  }
  if (urlPath === "/legacy/api/refresh" && method === "POST") {
    try {
      const result = await runRefresh();
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: String(error) });
    }
  }
  if (urlPath === "/modern/api/refresh-status" || urlPath === "/legacy/api/refresh-status") {
    return sendJson(res, 200, {
      refreshing: refreshState.refreshing,
      lastRun: refreshState.lastRun,
    });
  }

  const modern = subPath(urlPath, "/modern");
  if (modern !== null) return serveStatic(MODERN_ROOT, modern, res);

  const legacy = subPath(urlPath, "/legacy");
  if (legacy !== null) return serveStatic(LEGACY_ROOT, legacy, res);

  if (urlPath.startsWith("/api/")) {
    return sendJson(res, 404, { ok: false, message: "Unknown API route" });
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    process.stderr.write(`[atlas-fusion] error: port ${PORT} already in use.\n`);
    process.stderr.write(`[atlas-fusion] hint: use ATLAS_PORT=4273 /Users/mohyi/atlas/run-atlas-fusion.sh\n`);
    process.exit(1);
  }
  process.stderr.write(`[atlas-fusion] server error: ${String(error?.message || error)}\n`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`[atlas-fusion] shell: http://${HOST}:${PORT}\n`);
  process.stdout.write("[atlas-fusion] internal compatibility routes remain available for diagnostics only.\n");
  if (!fs.existsSync(path.join(LEGACY_ROOT, "index.html"))) {
    process.stdout.write("[atlas-fusion] warning: historical context build missing. run refresh once.\n");
  }
});

function shutdown() {
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
