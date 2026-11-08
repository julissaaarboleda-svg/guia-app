// netlify/functions/backup.js
//
// Full-data backup / restore for the signed-in user.
//   GET  /backup                 -> every record the user owns, grouped by entity
//   POST /backup/restore         -> body { data, mode: "merge" | "replace" }
//   GET  /backup/auto            -> list the automatic backups kept for this user
//   POST /backup/auto            -> take an automatic backup if the last one is 7+ days old
//   GET  /backup/auto/:key       -> one automatic backup (same shape as GET /backup)
//
// Live data lives in the "guia-data" store as {userId}/{entity}/{id}; automatic
// backups live in a separate "guia-backups" store so a bad write can't touch both.

const { getStore, connectLambda } = require("@netlify/blobs");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

const KEEP_AUTO = 4;
const WEEK = 7 * 86400000;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SKIP_ENTITIES = new Set(["Feedback"]);

async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function exportAll(store, userId) {
  const prefix = `${userId}/`;
  const { blobs } = await store.list({ prefix });
  const rows = await inChunks(blobs, 25, async (b) => {
    const parts = b.key.slice(prefix.length).split("/");
    if (parts.length !== 2 || SKIP_ENTITIES.has(parts[0])) return null;
    const rec = await store.get(b.key, { type: "json" });
    return rec ? [parts[0], rec] : null;
  });
  const data = {};
  let count = 0;
  for (const r of rows) {
    if (!r) continue;
    (data[r[0]] = data[r[0]] || []).push(r[1]);
    count++;
  }
  return { data, count };
}

const countOf = (data) => Object.values(data || {}).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);

async function saveAuto(backups, userId, label, payload) {
  const key = `${userId}/${label}`;
  await backups.setJSON(key, payload);
  return key;
}

exports.handler = async (event, context) => {
  connectLambda(event); // must be first — see technical notes on Netlify Blobs
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "Not authenticated" });
  const userId = user.sub || user.email;

  const parts = event.path.replace(/^.*\/backup\/?/, "").split("/").filter(Boolean);
  const [action, arg] = parts;

  const store = getStore("guia-data");
  const backups = getStore("guia-backups");
  const bPrefix = `${userId}/`;

  try {
    // ---- full export -----------------------------------------------------
    if (event.httpMethod === "GET" && !action) {
      const { data, count } = await exportAll(store, userId);
      return json(200, { app: "guia", version: 1, exported_at: new Date().toISOString(), email: user.email, count, data });
    }

    // ---- restore ---------------------------------------------------------
    if (event.httpMethod === "POST" && action === "restore") {
      const body = JSON.parse(event.body || "{}");
      const data = body.data;
      const mode = body.mode === "replace" ? "replace" : "merge";
      if (!data || typeof data !== "object" || Array.isArray(data)) return json(400, { error: "That file isn't a Guía backup." });
      for (const [name, list] of Object.entries(data)) {
        if (!NAME_RE.test(name) || !Array.isArray(list)) return json(400, { error: "That file isn't a Guía backup." });
      }
      if (countOf(data) === 0) return json(400, { error: "The backup is empty, so nothing was changed." });

      // Safety copy of what's there right now, so a restore can itself be undone.
      const current = await exportAll(store, userId);
      if (current.count > 0) {
        await saveAuto(backups, userId, `${new Date().toISOString()}__before-restore`, {
          app: "guia", version: 1, exported_at: new Date().toISOString(), email: user.email, count: current.count, data: current.data,
        });
      }

      const wanted = new Set();
      const writes = [];
      for (const [name, list] of Object.entries(data)) {
        if (SKIP_ENTITIES.has(name)) continue;
        for (const rec of list) {
          if (!rec || typeof rec !== "object" || !ID_RE.test(String(rec.id || ""))) continue;
          const key = `${userId}/${name}/${rec.id}`;
          wanted.add(key);
          writes.push([key, rec]);
        }
      }
      await inChunks(writes, 25, ([key, rec]) => store.setJSON(key, rec));

      let removed = 0;
      if (mode === "replace") {
        const { blobs } = await store.list({ prefix: bPrefix });
        const stale = blobs.filter((b) => !wanted.has(b.key) && !SKIP_ENTITIES.has(b.key.slice(bPrefix.length).split("/")[0]));
        await inChunks(stale, 25, (b) => store.delete(b.key));
        removed = stale.length;
      }
      return json(200, { restored: writes.length, removed, mode });
    }

    // ---- automatic backups -----------------------------------------------
    if (action === "auto") {
      if (event.httpMethod === "GET" && !arg) {
        const { blobs } = await backups.list({ prefix: bPrefix });
        const list = blobs
          .map((b) => b.key.slice(bPrefix.length))
          .sort()
          .reverse()
          .map((k) => ({ key: k, date: k.slice(0, 10), kind: k.includes("__before-restore") ? "before-restore" : "weekly" }));
        return json(200, list);
      }
      if (event.httpMethod === "GET" && arg) {
        const key = decodeURIComponent(arg);
        if (!/^[0-9T:.\-Z_a-z]+$/.test(key)) return json(400, { error: "Bad backup name" });
        const snap = await backups.get(`${userId}/${key}`, { type: "json" });
        if (!snap) return json(404, { error: "Backup not found" });
        return json(200, snap);
      }
      if (event.httpMethod === "POST") {
        const { blobs } = await backups.list({ prefix: bPrefix });
        const weekly = blobs.map((b) => b.key.slice(bPrefix.length)).filter((k) => !k.includes("__before-restore")).sort();
        const last = weekly[weekly.length - 1];
        if (last && Date.now() - new Date(last).getTime() < WEEK) return json(200, { taken: false, reason: "recent" });
        const { data, count } = await exportAll(store, userId);
        // Never replace a good backup with an empty one.
        if (count === 0) return json(200, { taken: false, reason: "empty" });
        const label = new Date().toISOString();
        await saveAuto(backups, userId, label, { app: "guia", version: 1, exported_at: label, email: user.email, count, data });
        const all = [...weekly, label];
        const drop = all.slice(0, Math.max(0, all.length - KEEP_AUTO));
        await Promise.all(drop.map((k) => backups.delete(`${userId}/${k}`)));
        return json(200, { taken: true, count });
      }
    }

    return json(400, { error: "Unsupported request" });
  } catch (err) {
    console.error("backup.js error:", err);
    return json(500, { error: err.message });
  }
};
