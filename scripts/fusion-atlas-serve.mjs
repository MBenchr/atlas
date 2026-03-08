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
    <title>Atlas Fusion · Modern + Legacy</title>
    <style>
      :root {
        --bg: #0c1518;
        --surface: #13262e;
        --line: #284754;
        --text: #e9f2f4;
        --muted: #9cb2ba;
        --accent: #49c39d;
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
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .title h1 { margin: 0; font-size: 1.05rem; }
      .title p { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; }
      .actions { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .btn {
        border: 1px solid #3e6978;
        border-radius: 999px;
        background: #183947;
        color: #ecf8fc;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .btn.active { border-color: #4bc29a; background: #18483b; color: #e8fff5; }
      .meta { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.74rem; }
      .layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        padding: 10px;
      }
      .viewer-single iframe {
        width: 100%;
        height: calc(100vh - 120px);
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #0f2028;
      }
      .viewer-split {
        display: none;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .viewer-split iframe {
        width: 100%;
        height: calc(100vh - 120px);
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #0f2028;
      }
      .viewer-split.active { display: grid; }
      .viewer-single.hidden { display: none; }
      @media (max-width: 980px) {
        .viewer-split.active { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="title">
        <h1>Atlas Fusion</h1>
        <p>Un seul site, deux modes: Modern UX et Legacy Map, avec refresh unifié.</p>
      </div>
      <div class="actions">
        <button id="mode-modern" class="btn active" type="button">Mode Modern</button>
        <button id="mode-legacy" class="btn" type="button">Mode Legacy</button>
        <button id="mode-split" class="btn" type="button">Comparaison</button>
        <button id="refresh" class="btn" type="button">Mettre à jour</button>
        <span id="status" class="meta">status=idle</span>
      </div>
    </header>

    <main class="layout">
      <section id="single" class="viewer-single">
        <iframe id="single-frame" src="/modern/" title="Atlas modern"></iframe>
      </section>
      <section id="split" class="viewer-split">
        <iframe id="modern-frame" src="/modern/" title="Atlas modern split"></iframe>
        <iframe id="legacy-frame" src="/legacy/" title="Atlas legacy split"></iframe>
      </section>
    </main>

    <script>
      const modeModern = document.getElementById("mode-modern");
      const modeLegacy = document.getElementById("mode-legacy");
      const modeSplit = document.getElementById("mode-split");
      const single = document.getElementById("single");
      const split = document.getElementById("split");
      const singleFrame = document.getElementById("single-frame");
      const modernFrame = document.getElementById("modern-frame");
      const legacyFrame = document.getElementById("legacy-frame");
      const refreshBtn = document.getElementById("refresh");
      const status = document.getElementById("status");

      function setActive(which) {
        modeModern.classList.toggle("active", which === "modern");
        modeLegacy.classList.toggle("active", which === "legacy");
        modeSplit.classList.toggle("active", which === "split");
        split.classList.toggle("active", which === "split");
        single.classList.toggle("hidden", which === "split");
        if (which === "modern") singleFrame.src = "/modern/";
        if (which === "legacy") singleFrame.src = "/legacy/";
      }

      modeModern.onclick = () => setActive("modern");
      modeLegacy.onclick = () => setActive("legacy");
      modeSplit.onclick = () => setActive("split");

      refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        status.textContent = "status=refreshing";
        try {
          const res = await fetch("/api/refresh", { method: "POST" });
          const payload = await res.json();
          if (!res.ok || !payload.ok) throw new Error(payload.stderr || payload.message || ("HTTP " + res.status));
          status.textContent = "status=ok";
          singleFrame.contentWindow?.location.reload();
          modernFrame.contentWindow?.location.reload();
          legacyFrame.contentWindow?.location.reload();
        } catch (error) {
          status.textContent = "status=error";
          console.error(error);
          alert("Refresh échoué: " + String(error.message || error));
        } finally {
          refreshBtn.disabled = false;
        }
      };
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
      if (code === 0) {
        try {
          await syncLegacyDataToModern();
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
        stdout: stdout.slice(-10000),
        stderr: `${stderr.slice(-8000)}${syncError ? `\n[sync] ${syncError}` : ""}`.trim(),
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
  process.stdout.write(`[atlas-fusion] modern route: http://${HOST}:${PORT}/modern/\n`);
  process.stdout.write(`[atlas-fusion] legacy route: http://${HOST}:${PORT}/legacy/\n`);
  if (!fs.existsSync(path.join(LEGACY_ROOT, "index.html"))) {
    process.stdout.write("[atlas-fusion] warning: legacy build missing. run refresh once.\n");
  }
});

function shutdown() {
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
