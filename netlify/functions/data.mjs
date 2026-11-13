// netlify/functions/data.mjs
//
// The same generic entity CRUD as entities.js, rewritten in Netlify's newer
// function format. The newer format supports "strong" reads from Netlify Blobs,
// so a change saved on one page shows up immediately on the next (the classic
// format, used by entities.js, can only read the eventually-consistent copy).
//
// Served at /api/data/:entityName/:id?  (see `config` at the bottom).
// The app only uses this when it's switched on (see base44Client.js), and it
// falls back to entities.js automatically if this ever errors.

import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const ADMIN_EMAILS = ["contact@julissaa.com"];
const isCollab = (item, email) =>
  !!item && Array.isArray(item.collaborators) && !!email &&
  item.collaborators.some((c) => String(c).toLowerCase() === String(email).toLowerCase());

const HEADERS = { "Content-Type": "application/json", "x-guia-data": "2", "Cache-Control": "no-store" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEADERS });

// Netlify Identity: the newer format doesn't decode the sign-in token for us, so ask
// Identity who the token belongs to. Cached briefly so it's one lookup per few minutes.
const userCache = new Map();
async function userFor(req) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return null;
  const hit = userCache.get(auth);
  if (hit && hit.until > Date.now()) return hit.user;
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/.netlify/identity/user`, { headers: { Authorization: auth } });
  if (!res.ok) return null;
  const u = await res.json();
  const user = u && u.id ? { sub: u.id, email: u.email } : null;
  if (user) {
    userCache.set(auth, { user, until: Date.now() + 5 * 60 * 1000 });
    if (userCache.size > 500) userCache.delete(userCache.keys().next().value);
  }
  return user;
}

export default async (req) => {
  const user = await userFor(req);
  if (!user) return json(401, { error: "Not authenticated" });
  const userId = user.sub || user.email;

  const parts = new URL(req.url).pathname.replace(/^.*\/api\/data\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [entityName, id] = parts;
  if (!entityName) return json(400, { error: "Missing entity name" });

  const store = getStore({ name: "guia-data", consistency: "strong" });
  const prefix = `${userId}/${entityName}/`;
  const method = req.method;

  try {
    if (entityName === "_health") {
      await store.list({ prefix: `${userId}/_health/` });
      return json(200, { ok: true, strong: true });
    }

    if (method === "GET" && !id) {
      if (entityName === "Feedback" && ADMIN_EMAILS.includes(user.email)) {
        const { blobs: all } = await store.list({ prefix: "" });
        const items = (await Promise.all(all.filter((b) => b.key.includes("/Feedback/")).map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
        items.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        return json(200, items);
      }
      const { blobs } = await store.list({ prefix });
      const own = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      let shared = [];
      if (entityName === "Project") {
        const { blobs: all } = await store.list({ prefix: "" });
        const others = all.filter((b) => b.key.includes(`/${entityName}/`) && !b.key.startsWith(prefix));
        shared = (await Promise.all(others.map((b) => store.get(b.key, { type: "json" })))).filter((it) => isCollab(it, user.email));
      }
      const items = [...own, ...shared].filter(Boolean);
      items.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      return json(200, items);
    }

    // Finds a record this person owns, or a Project they collaborate on.
    const findOne = async () => {
      const item = await store.get(prefix + id, { type: "json" });
      if (item) return { item, key: prefix + id };
      if (entityName === "Project") {
        const { blobs: all } = await store.list({ prefix: "" });
        const m = all.find((b) => b.key.endsWith(`/${entityName}/${id}`));
        if (m) { const c = await store.get(m.key, { type: "json" }); if (isCollab(c, user.email)) return { item: c, key: m.key }; }
      }
      return null;
    };

    if (method === "GET" && id) {
      const f = await findOne();
      return f ? json(200, f.item) : json(404, { error: "Not found" });
    }
    if (method === "POST") {
      const data = await req.json().catch(() => ({}));
      const now = new Date().toISOString();
      const record = { ...data, id: randomUUID(), created_by_id: userId, created_date: now, updated_date: now };
      await store.setJSON(prefix + record.id, record);
      return json(200, record);
    }
    if (method === "PUT" && id) {
      const patch = await req.json().catch(() => ({}));
      const f = await findOne();
      if (!f) return json(404, { error: "Not found" });
      const updated = { ...f.item, ...patch, id, updated_date: new Date().toISOString() };
      await store.setJSON(f.key, updated);
      return json(200, updated);
    }
    if (method === "DELETE" && id) {
      await store.delete(prefix + id);
      return json(200, { deleted: true });
    }
    return json(400, { error: `Unsupported ${method}` });
  } catch (err) {
    console.error("data.mjs error:", err);
    return json(500, { error: err.message });
  }
};

export const config = { path: ["/api/data", "/api/data/*"] };
