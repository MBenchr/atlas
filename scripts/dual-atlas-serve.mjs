#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const HOST = process.env.ATLAS_HOST || "127.0.0.1";
const MODERN_PORT = Number(process.env.ATLAS_MODERN_PORT || 4173);
const LEGACY_PORT = Number(process.env.ATLAS_LEGACY_PORT || 4174);

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

function resolveSafePath(rootDir, urlPath) {
  const clean = decodeURIComponent((urlPath || "/").split("?")[0]);
  const requested = clean === "/" ? "/index.html" : clean;
  const full = path.normalize(path.join(rootDir, requested));
  if (!full.startsWith(path.normalize(rootDir))) return null;
  return full;
}

async function serveStatic(rootDir, req, res) {
  const full = resolveSafePath(rootDir, req.url || "/");
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
      const finishedAt = new Date().toISOString();
      let syncError = "";
      if (code === 0) {
        try {
          await syncLegacyDataToModern();
        } catch (error) {
          syncError = String(error?.message || error);
        }
      }

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

function createServer(rootDir, siteName) {
  return http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const urlPath = (req.url || "/").split("?")[0];

    if (urlPath === "/api/refresh-status") {
      return sendJson(res, 200, {
        site: siteName,
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

    if (urlPath.startsWith("/api/")) {
      return sendJson(res, 404, { ok: false, message: "Unknown API route" });
    }

    return serveStatic(rootDir, req, res);
  });
}

const modernServer = createServer(MODERN_ROOT, "modern");
const legacyServer = createServer(LEGACY_ROOT, "legacy");

function startServer(server, port, label, rootDir) {
  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      process.stderr.write(`[atlas-dual] error: port ${port} already in use for ${label}.\n`);
      process.stderr.write(`[atlas-dual] hint: stop existing server or override ports with ATLAS_MODERN_PORT/ATLAS_LEGACY_PORT.\n`);
      process.exit(1);
    }
    process.stderr.write(`[atlas-dual] ${label} server error: ${String(error?.message || error)}\n`);
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    process.stdout.write(`[atlas-dual] ${label}: http://${HOST}:${port}\n`);
    if (!fs.existsSync(path.join(rootDir, "index.html"))) {
      process.stdout.write(`[atlas-dual] warning: missing index.html at ${rootDir}\n`);
    }
  });
}

startServer(modernServer, MODERN_PORT, "modern", MODERN_ROOT);
startServer(legacyServer, LEGACY_PORT, "legacy", LEGACY_ROOT);

function shutdown() {
  modernServer.close();
  legacyServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
