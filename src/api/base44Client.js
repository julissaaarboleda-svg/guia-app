// src/api/base44Client.js
//
// DROP-IN REPLACEMENT for the real @base44/sdk client.
// Every page/component in the app imports { base44 } from this exact path and
// calls base44.auth.me(), base44.entities.Trip.list(), base44.integrations.Core.InvokeLLM(),
// etc. — this file replicates those same method shapes so NONE of that calling
// code needs to change. Only this file (and the Netlify Functions it talks to)
// are new.
//
// Requires: `npm install netlify-identity-widget`

import netlifyIdentity from "netlify-identity-widget";

netlifyIdentity.init();

const API_BASE = "/.netlify/functions";

// Phone camera photos are often 3-10MB, which base64-encodes to something even
// bigger — comfortably over Netlify Functions' payload limits, which is why
// uploads were silently hanging with no visible error. Downscale/recompress
// image files client-side before upload; leave non-image files (attachments,
// PDFs, etc.) untouched.
function compressImageIfNeeded(file, maxDimension = 1600, quality = 0.82) {
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || "");
  if (!file.type || !file.type.startsWith("image/") || file.type === "image/gif" || isHeic) {
    // HEIC (the default format for iPhone photos) is skipped deliberately —
    // canvas-based re-encoding of HEIC is unreliable across browsers even when
    // the browser CAN display it in an <img> tag, which was almost certainly
    // why uploads were spinning forever on phone: the compression step never
    // resolved. Upload these as-is instead of risking that hang.
    return Promise.resolve(file);
  }
  return new Promise((resolve) => {
    // Hard timeout — guarantees this can never hang indefinitely regardless of
    // the reason (unsupported format, decode failure that doesn't fire onerror,
    // slow device, etc.). Falls back to the original, uncompressed file.
    const timeout = setTimeout(() => resolve(file), 8000);
    const finish = (result) => { clearTimeout(timeout); resolve(result); };

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= maxDimension && height <= maxDimension && file.size < 1_500_000) {
        finish(file); // already small enough, skip re-encoding
        return;
      }
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { finish(file); return; } // fall back to original on any failure
          finish(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); finish(file); }; // fall back on load failure
    img.src = url;
  });
}

async function authHeaders() {
  const user = netlifyIdentity.currentUser();
  if (!user) throw new Error("Not authenticated");
  const token = await user.jwt(); // auto-refreshes if expired
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function checkOk(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res;
}

// ---- Generic entity CRUD, matches base44.entities.<EntityName>.<method>() ----
function makeEntity(entityName) {
  const api = {
    async list(sort, limit) {
      const headers = await authHeaders();
      const res = await checkOk(await fetch(`${API_BASE}/entities/${entityName}`, { headers }));
      let items = await res.json();
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        items = [...items].sort((a, b) => {
          const av = new Date(a[field] || 0).getTime();
          const bv = new Date(b[field] || 0).getTime();
          return desc ? bv - av : av - bv;
        });
      }
      return limit ? items.slice(0, limit) : items;
    },
    async filter(query = {}) {
      const items = await api.list();
      return items.filter((item) => Object.entries(query).every(([k, v]) => item[k] === v));
    },
    async get(id) {
      const headers = await authHeaders();
      const res = await checkOk(await fetch(`${API_BASE}/entities/${entityName}/${id}`, { headers }));
      return res.json();
    },
    async create(data) {
      const headers = await authHeaders();
      const res = await checkOk(
        await fetch(`${API_BASE}/entities/${entityName}`, { method: "POST", headers, body: JSON.stringify(data) })
      );
      return res.json();
    },
    async update(id, patch) {
      const headers = await authHeaders();
      const res = await checkOk(
        await fetch(`${API_BASE}/entities/${entityName}/${id}`, { method: "PUT", headers, body: JSON.stringify(patch) })
      );
      return res.json();
    },
    async delete(id) {
      const headers = await authHeaders();
      const res = await checkOk(
        await fetch(`${API_BASE}/entities/${entityName}/${id}`, { method: "DELETE", headers })
      );
      return res.json();
    },
    async updateMany(query, patch) {
      // Supports the one Mongo-style operator actually used in this app: $unset.
      // (src/pages/Notes.jsx uses updateMany({folder_id: id}, {$unset: {folder_id: ""}}))
      const items = await api.filter(query);
      const realPatch = { ...patch };
      if (realPatch.$unset) {
        Object.keys(realPatch.$unset).forEach((k) => { realPatch[k] = undefined; });
        delete realPatch.$unset;
      }
      return Promise.all(items.map((i) => api.update(i.id, realPatch)));
    },
    subscribe(_callback) {
      // KNOWN GAP: Netlify Blobs has no real-time push (unlike Base44).
      // Used today only in ProjectDetail.jsx for live collaborator sync.
      // Returns a no-op unsubscribe function so calling code doesn't crash.
      // See MIGRATION.md for options if live collab matters later.
      return () => {};
    },
  };
  return api;
}

const entities = new Proxy(
  {},
  { get: (_target, entityName) => makeEntity(entityName) }
);

// ---- AI + file integrations, matches base44.integrations.Core.* ----
async function InvokeLLM({ prompt, add_context_from_internet, response_json_schema, model }) {
  const headers = await authHeaders();
  const res = await checkOk(
    await fetch(`${API_BASE}/generate-text`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, grounded: !!add_context_from_internet, wantJson: !!response_json_schema }),
    })
  );
  const data = await res.json();
  return response_json_schema ? data : data.text;
}

async function GenerateImage({ prompt }) {
  const headers = await authHeaders();
  const res = await checkOk(
    await fetch(`${API_BASE}/generate-image`, { method: "POST", headers, body: JSON.stringify({ prompt }) })
  );
  return res.json(); // { url }
}

async function UploadFile({ file }) {
  const uploadFile = await compressImageIfNeeded(file);
  const base64Data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(uploadFile);
  });
  const headers = await authHeaders();
  const res = await checkOk(
    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type, base64Data }),
    })
  );
  return res.json(); // { file_url }
}

// ---- Public shape — matches the real base44 client's surface ----
export const base44 = {
  auth: {
    async me() {
      const user = netlifyIdentity.currentUser();
      if (!user) throw new Error("Not authenticated");
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
      };
    },
    login() { netlifyIdentity.open("login"); },
    signup() { netlifyIdentity.open("signup"); },
    logout() { netlifyIdentity.logout(); },
  },
  entities,
  integrations: {
    Core: { InvokeLLM, GenerateImage, UploadFile },
  },
  functions: {
    // KNOWN GAP: base44.functions.invoke("exportTripPdf", ...) (used in TripDetail.jsx)
    // was a custom Base44 server function. Not yet migrated — see MIGRATION.md.
    async invoke(name) {
      throw new Error(`base44.functions.invoke("${name}") is not yet migrated — see MIGRATION.md`);
    },
  },
};

// Call this once in your top-level App.jsx to wire up login/logout state changes.
export function initAuth({ onLogin, onLogout } = {}) {
  netlifyIdentity.on("login", (user) => onLogin && onLogin(user));
  netlifyIdentity.on("logout", () => onLogout && onLogout());
}

export { netlifyIdentity };
