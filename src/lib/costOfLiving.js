import { base44 } from "@/api/base44Client";
import { monthlyEquivalent } from "@/lib/financeHelpers";

const CACHE_KEY = "guia-col-cache-v1";
const TTL = 30 * 86400000;
const norm = (c) => String(c || "").trim().toLowerCase();
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } };
const writeCache = (c) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

// Price estimates per city (US average = 100 for the overall index), cached for 30 days.
export async function fetchCityCosts(cities) {
  const wanted = [...new Set(cities.map((c) => String(c || "").trim()).filter(Boolean))];
  const cache = readCache();
  const out = {};
  const missing = [];
  wanted.forEach((c) => {
    const hit = cache[norm(c)];
    if (hit && Date.now() - hit.at < TTL) out[norm(c)] = hit.data; else missing.push(c);
  });
  if (missing.length) {
    const prompt = `Estimate typical monthly costs for a single adult in each of these places: ${missing.join("; ")}.
Use current public cost-of-living data if you can (for example Numbeo, BEA regional price parities, recent rent listings).
For each give:
- index: overall cost of living where the US average = 100 (include rent)
- rent: typical monthly rent in USD for a 1-bedroom apartment in the city centre
- groceries: typical monthly groceries in USD for one adult
- transport: typical monthly transport cost in USD (car costs or transit pass, average)
Be realistic and consistent; round to whole numbers. Respond as JSON only:
{"cities":[{"name":"exactly as I wrote it","index":100,"rent":0,"groceries":0,"transport":0}]}`;
    let res;
    try {
      // Web-search version first (fresher); it can be slow, so fall back to the quick version if it fails.
      res = await base44.integrations.Core.InvokeLLM({ prompt, add_context_from_internet: true, response_json_schema: { type: "object" } });
    } catch (err) {
      console.warn("Grounded cost lookup failed, retrying without web search:", err);
      res = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: "object" } });
    }
    if (!Array.isArray(res?.cities) || !res.cities.length) throw new Error("No prices returned");
    (res.cities || []).forEach((c, i) => {
      const key = norm(missing.find((m) => norm(m) === norm(c.name)) || missing[i] || c.name);
      const data = { name: c.name, index: Number(c.index) || 100, rent: Number(c.rent) || 0, groceries: Number(c.groceries) || 0, transport: Number(c.transport) || 0 };
      out[key] = data;
      cache[key] = { at: Date.now(), data };
    });
    writeCache(cache);
  }
  return out;
}

// What the person's monthly bills + subscriptions come to, from their Finance tab.
export function financeBaseline(items) {
  const bills = items.filter((i) => i.type === "bill" && i.billing_cycle && i.billing_cycle !== "one_time").reduce((s, b) => s + monthlyEquivalent(b), 0);
  const subs = items.filter((i) => i.type === "subscription").reduce((s, b) => s + monthlyEquivalent(b), 0);
  return { bills: Math.round(bills), subs: Math.round(subs) };
}

// Scale the comfortable month from the home city to another city, category by category.
export function scaleBudget(profile, fin, home, city) {
  const r = (a, b) => (b > 0 && a > 0 ? a / b : 1);
  const lines = [
    { key: "bills", label: "Rent & bills", base: fin.bills, to: fin.bills * r(city.rent, home.rent) },
    { key: "subs", label: "Subscriptions", base: fin.subs, to: fin.subs },
    { key: "groceries", label: "Groceries & dining", base: Number(profile.groceries) || 0, to: (Number(profile.groceries) || 0) * r(city.groceries, home.groceries) },
    { key: "transport", label: "Transport", base: Number(profile.transport) || 0, to: (Number(profile.transport) || 0) * r(city.transport, home.transport) },
    { key: "fun", label: "Fun & savings", base: Number(profile.fun) || 0, to: (Number(profile.fun) || 0) * r(city.index, home.index) },
  ].map((l) => ({ ...l, base: Math.round(l.base), to: Math.round(l.to), diff: Math.round(l.to - l.base) }));
  const baseTotal = lines.reduce((s, l) => s + l.base, 0);
  const toTotal = lines.reduce((s, l) => s + l.to, 0);
  const ratio = baseTotal > 0 ? toTotal / baseTotal : 1;
  return { lines, baseTotal, toTotal, ratio, pct: Math.round((ratio - 1) * 100) };
}

export const money = (n) => `$${Math.round(n).toLocaleString()}`;
export const moneyK = (n) => `$${Math.round(n / 1000)}k`;
