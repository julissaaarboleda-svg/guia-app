// netlify/functions/entities.js
//
// Generic replacement for base44.entities.<EntityName>.list/filter/create/update/delete/get
// One function handles every entity type (Trip, Goal, Task, Note, FinanceItem, etc.) —
// Netlify Blobs stores arbitrary JSON, so no per-entity schema/table setup is needed.
//
// URL shape: /.netlify/functions/entities/:entityName/:id?
//   GET    /entities/Trip           -> list all Trips for this user
//   GET    /entities/Trip/abc123    -> get one Trip
//   POST   /entities/Trip           -> create (body = fields)
//   PUT    /entities/Trip/abc123    -> update (body = partial fields)
//   DELETE /entities/Trip/abc123    -> delete
//
// Data is namespaced per user: {userId}/{entityName}/{id}
// so one Blobs store safely holds every user's data.

const { getStore, connectLambda } = require("@netlify/blobs");
const { randomUUID } = require("node:crypto");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

exports.handler = async (event, context) => {
  connectLambda(event); // required for getStore() to auto-detect credentials — see @netlify/blobs docs
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  // Netlify auto-decodes the Netlify Identity JWT (sent as "Authorization: Bearer <token>")
  // into context.clientContext.user when Identity is enabled on this site.
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "Not authenticated — missing or invalid Netlify Identity token" });
  const userId = user.sub || user.email;

  // Path after /entities/ -> [entityName, id?]
  const parts = event.path.replace(/^.*\/entities\/?/, "").split("/").filter(Boolean);
  const [entityName, id] = parts;
  if (!entityName) return json(400, { error: "Missing entity name in URL, e.g. /entities/Trip" });

  const store = getStore("guia-data");
  const prefix = `${userId}/${entityName}/`;

  try {
    if (event.httpMethod === "GET" && !id) {
      // list() / filter() — client-side filtering happens in the base44Client shim;
      // this always returns the full set for that entity, sorted by created_date desc.
      const { blobs } = await store.list({ prefix });
      const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      items.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      return json(200, items);
    }

    if (event.httpMethod === "GET" && id) {
      const item = await store.get(prefix + id, { type: "json" });
      if (!item) return json(404, { error: "Not found" });
      return json(200, item);
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");
      const newId = randomUUID();
      const now = new Date().toISOString();
      // created_by_id was never being set here — this is why isOwner checks
      // (used for the "Add collaborator" / delete buttons in ProjectDetail.jsx)
      // have been silently false for every project ever created.
      const record = { ...data, id: newId, created_by_id: userId, created_date: now, updated_date: now };
      await store.setJSON(prefix + newId, record);
      return json(200, record);
    }

    if (event.httpMethod === "PUT" && id) {
      const patch = JSON.parse(event.body || "{}");
      const existing = await store.get(prefix + id, { type: "json" });
      if (!existing) return json(404, { error: "Not found" });
      const updated = { ...existing, ...patch, id, updated_date: new Date().toISOString() };
      await store.setJSON(prefix + id, updated);
      return json(200, updated);
    }

    if (event.httpMethod === "DELETE" && id) {
      await store.delete(prefix + id);
      return json(200, { deleted: true });
    }

    return json(400, { error: `Unsupported ${event.httpMethod} on this path` });
  } catch (err) {
    console.error("entities.js error:", err);
    return json(500, { error: err.message });
  }
};
