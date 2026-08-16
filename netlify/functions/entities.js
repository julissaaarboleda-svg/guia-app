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

// Only these emails can read Feedback across all users (see the GET-list
// branch below). ⚠️ REPLACE THIS with your real login email before deploying.
const ADMIN_EMAILS = ["contact@julissaa.com"];

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
      // Admin feedback inbox: only for the hardcoded admin email(s), read
      // every user's Feedback submissions — otherwise each person's
      // feedback would only ever be visible inside their own account,
      // which is useless for actually reading what beta testers send.
      if (entityName === "Feedback" && ADMIN_EMAILS.includes(user.email)) {
        const { blobs: allBlobs } = await store.list({ prefix: "" });
        const relevant = allBlobs.filter((b) => b.key.includes(`/Feedback/`));
        const items = (await Promise.all(relevant.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
        items.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        return json(200, items);
      }

      // list() / filter() — client-side filtering happens in the base44Client shim;
      // this always returns the full set for that entity, sorted by created_date desc.
      const { blobs } = await store.list({ prefix });
      const ownItems = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));

      // Collaboration support: also surface items OTHER users created where this
      // user's email is listed as a collaborator. Netlify Blobs has no cross-user
      // query, so for shareable entity types we scan the whole store for that
      // entity type and filter here — fine at this app's current scale.
      let sharedItems = [];
      if (entityName === "Project") {
        const { blobs: allBlobs } = await store.list({ prefix: "" });
        const others = allBlobs.filter((b) => b.key.includes(`/${entityName}/`) && !b.key.startsWith(prefix));
        const otherItems = await Promise.all(others.map((b) => store.get(b.key, { type: "json" })));
        sharedItems = otherItems.filter(
          (item) => item && Array.isArray(item.collaborators) && item.collaborators.includes(user.email)
        );
      }

      const items = [...ownItems, ...sharedItems];
      items.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      return json(200, items);
    }

    if (event.httpMethod === "GET" && id) {
      let item = await store.get(prefix + id, { type: "json" });
      if (!item && entityName === "Project") {
        // Not owned by this user — check whether it's a project they're a
        // collaborator on before giving up (covers opening a shared project
        // by direct link, and re-fetching after realtime update events).
        const { blobs: allBlobs } = await store.list({ prefix: "" });
        const match = allBlobs.find((b) => b.key.endsWith(`/${entityName}/${id}`));
        if (match) {
          const candidate = await store.get(match.key, { type: "json" });
          if (candidate && Array.isArray(candidate.collaborators) && candidate.collaborators.includes(user.email)) {
            item = candidate;
          }
        }
      }
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
      let existing = await store.get(prefix + id, { type: "json" });
      let realKey = prefix + id;

      if (!existing && entityName === "Project") {
        // Same cross-user lookup as GET single — a collaborator editing a
        // project they don't own (e.g. checking off a task) needs this too.
        const { blobs: allBlobs } = await store.list({ prefix: "" });
        const match = allBlobs.find((b) => b.key.endsWith(`/${entityName}/${id}`));
        if (match) {
          const candidate = await store.get(match.key, { type: "json" });
          if (candidate && Array.isArray(candidate.collaborators) && candidate.collaborators.includes(user.email)) {
            existing = candidate;
            realKey = match.key;
          }
        }
      }

      if (!existing) return json(404, { error: "Not found" });
      const updated = { ...existing, ...patch, id, updated_date: new Date().toISOString() };
      await store.setJSON(realKey, updated);
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
