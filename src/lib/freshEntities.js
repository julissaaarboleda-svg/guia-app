import { base44 } from "@/api/base44Client";

// The data service can return a stale list for a moment after a write, so a
// freshly added item may be missing (or a deleted one still shown) until the
// page is reopened. This wraps base44.entities so recent writes are layered
// over whatever the service returns, for long enough for it to catch up.
const TTL = 30000;
const store = {};
const slot = (name) => store[name] || (store[name] = { added: new Map(), patched: new Map(), removed: new Set() });
const expire = (fn) => setTimeout(fn, TTL);

const matches = (r, crit) => !crit || Object.entries(crit).every(([k, v]) => r[k] === v);

function overlay(name, list, crit) {
  const s = slot(name);
  const withPatch = (r) => (s.patched.has(r.id) ? { ...r, ...s.patched.get(r.id) } : r);
  const out = (list || []).filter((r) => !s.removed.has(r.id)).map(withPatch);
  const ids = new Set(out.map((r) => r.id));
  const extra = [...s.added.values()]
    .filter((r) => !ids.has(r.id) && !s.removed.has(r.id))
    .map(withPatch)
    .filter((r) => matches(r, crit));
  return [...extra, ...out];
}

function wrap(name) {
  const api = base44.entities[name];
  const over = {
    list: async (...args) => overlay(name, await api.list(...args)),
    filter: async (crit, ...rest) => overlay(name, await api.filter(crit, ...rest), crit),
    create: async (data) => {
      const rec = await api.create(data);
      if (rec && rec.id) {
        const s = slot(name);
        s.added.set(rec.id, rec);
        expire(() => s.added.delete(rec.id));
      }
      return rec;
    },
    update: async (id, data) => {
      const res = await api.update(id, data);
      const s = slot(name);
      s.patched.set(id, { ...(s.patched.get(id) || {}), ...data });
      expire(() => s.patched.delete(id));
      return res;
    },
    delete: async (id) => {
      const res = await api.delete(id);
      const s = slot(name);
      s.removed.add(id);
      s.added.delete(id);
      expire(() => s.removed.delete(id));
      return res;
    },
  };
  return new Proxy(api, {
    get: (t, p) => (p in over ? over[p] : typeof t[p] === "function" ? t[p].bind(t) : t[p]),
  });
}

export const ent = new Proxy({}, { get: (_, name) => wrap(name) });
