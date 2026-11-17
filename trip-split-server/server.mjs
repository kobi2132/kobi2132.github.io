// חצי־חצי sync server. No dependencies: runs on the official node image.
// Each trip is one JSON file in DATA_DIR. The trip id is a long random string
// that only the travelers know (it is in their invite link).
//
// POST /api/trips/:id/sync  body: {settings, expenses, deleted}
//   Merges the phone's copy into the server copy and returns the merged trip.
// GET  /health
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || "/data";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://kobi2132.github.io").split(",").map(s => s.trim());
const MAX_BODY = 1024 * 1024; // 1MB per sync is thousands of expenses
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

/* ---- merge (same rules as the app) ---- */
const ts = e => Number(e?.updatedAt || e?.createdAt || 0);
export function merge(a, b) {
  a = a || {}; b = b || {};
  const deleted = { ...(a.deleted || {}) };
  for (const [k, v] of Object.entries(b.deleted || {})) if (!deleted[k] || deleted[k] < v) deleted[k] = v;
  const byId = new Map();
  for (const e of [...(a.expenses || []), ...(b.expenses || [])]) {
    if (!e || typeof e.id !== "string") continue;
    const cur = byId.get(e.id);
    if (!cur || ts(e) > ts(cur)) byId.set(e.id, e);
  }
  for (const [id, t] of Object.entries(deleted)) { const cur = byId.get(id); if (cur && t >= ts(cur)) byId.delete(id); }
  const sa = a.settings, sb = b.settings;
  const settings = !sa ? sb || null : !sb ? sa : (Number(sb.updatedAt || 0) > Number(sa.updatedAt || 0) ? sb : sa);
  return { settings, expenses: [...byId.values()], deleted };
}

function valid(body) {
  if (!body || typeof body !== "object") return false;
  if (body.settings != null && (typeof body.settings !== "object" || !Array.isArray(body.settings.people))) return false;
  if (body.expenses != null && !Array.isArray(body.expenses)) return false;
  if (body.deleted != null && typeof body.deleted !== "object") return false;
  return true;
}

/* ---- storage, one write at a time per trip ---- */
const locks = new Map();
function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(id, next.catch(() => {}));
  return next;
}
const file = id => path.join(DATA_DIR, id + ".json");
async function load(id) {
  try { return JSON.parse(await fs.readFile(file(id), "utf8")); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
async function save(id, data) {
  const tmp = file(id) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file(id));
}

/* ---- tiny per-IP rate limit ---- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), w = hits.get(ip) || { n: 0, t: now };
  if (now - w.t > 60_000) { w.n = 0; w.t = now; }
  w.n++; hits.set(ip, w);
  return w.n > 120;
}
setInterval(() => { const now = Date.now(); for (const [k, w] of hits) if (now - w.t > 120_000) hits.delete(k); }, 60_000).unref();

function send(res, code, obj, origin) {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
  if (origin) { h["access-control-allow-origin"] = origin; h["vary"] = "Origin"; }
  res.writeHead(code, h);
  res.end(obj === undefined ? "" : JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const origin = ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : null;
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (req.method === "OPTIONS") {
    res.writeHead(204, origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" } : {});
    return res.end();
  }
  const m = url.pathname.match(/^\/api\/trips\/([^/]+)\/sync$/);
  if (!m || req.method !== "POST") return send(res, 404, { error: "not_found" }, origin);
  const id = m[1];
  if (!ID_RE.test(id)) return send(res, 400, { error: "bad_id" }, origin);
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (limited(ip)) return send(res, 429, { error: "slow_down" }, origin);

  let size = 0; const chunks = [];
  try {
    for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(res, 413, { error: "too_big" }, origin); chunks.push(c); }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!valid(body)) return send(res, 400, { error: "bad_body" }, origin);
    const merged = await withLock(id, async () => {
      const cur = await load(id);
      const out = merge(cur, body);
      if (!cur || JSON.stringify(out) !== JSON.stringify(cur)) await save(id, out);
      return out;
    });
    send(res, 200, merged, origin);
  } catch (e) {
    if (e instanceof SyntaxError) return send(res, 400, { error: "bad_json" }, origin);
    console.error(e);
    send(res, 500, { error: "server" }, origin);
  }
});

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  server.listen(PORT, () => console.log("trip-split sync on", PORT));
}
export { server };
