// Monthly AI-use limits per account.
//
// Every AI request (text, image, file import) goes through withUsage(). It looks up the
// person's plan and how many AI uses they've had this month, refuses with 402 when they're
// over, and counts the use only when the request succeeds.
//
// Netlify environment variables:
//   GUIA_LIMITS=on          turn blocking on. Without it, uses are counted and shown but never blocked.
//   GUIA_PLUS_EMAILS=a@b.com,c@d.com   accounts treated as Plus (for the owner and testers).
// A Plus plan can also be stored per account in the "plans" Blobs store ({ plan: "plus" }),
// which is where a payment webhook would write it later.
const { getStore, connectLambda } = require("@netlify/blobs");

const LIMITS = { free: 25, plus: 500 }; // Plus is "unlimited" with a fair-use ceiling
const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

const monthKey = () => new Date().toISOString().slice(0, 7);
const userId = (user) => String(user.sub || user.email || "unknown");
const enforced = () => String(process.env.GUIA_LIMITS || "").toLowerCase() === "on";

async function planFor(user) {
  const plusList = String(process.env.GUIA_PLUS_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (user.email && plusList.includes(String(user.email).toLowerCase())) return "plus";
  try {
    const rec = await getStore("plans").get(`user-${userId(user)}`, { type: "json" });
    if (rec && rec.plan === "plus" && (!rec.until || new Date(rec.until) > new Date())) return "plus";
  } catch (err) { console.error("plan lookup failed (treating as free):", err); }
  return "free";
}

async function usageFor(user) {
  const plan = await planFor(user);
  const key = `ai-${userId(user)}-${monthKey()}`;
  let used = 0;
  try { used = Number((await getStore("usage").get(key, { type: "json" }))?.count) || 0; }
  catch (err) { console.error("usage read failed:", err); }
  const now = new Date();
  const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const resets = resetDate.toISOString().slice(0, 10);
  const resetsLabel = resetDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return { plan, used, limit: LIMITS[plan], enforced: enforced(), resets, resetsLabel, key };
}

async function recordUse(key, cost) {
  if (!cost) return;
  try {
    const store = getStore("usage");
    const rec = (await store.get(key, { type: "json" })) || { count: 0 };
    rec.count = (Number(rec.count) || 0) + cost;
    await store.setJSON(key, rec);
  } catch (err) { console.error("usage write failed:", err); }
}

// costOf(event) returns how many AI uses this request counts as (0 = free).
function withUsage(inner, costOf = () => 1) {
  return async (event, context) => {
    connectLambda(event);
    const user = context.clientContext && context.clientContext.user;
    if (!user || event.httpMethod !== "POST") return inner(event, context);
    let cost = 1;
    try { cost = costOf(event); } catch { cost = 1; }
    let u = null;
    try {
      u = await usageFor(user);
      if (cost > 0 && u.enforced && u.used + cost > u.limit) {
        return {
          statusCode: 402,
          headers: CORS,
          body: JSON.stringify({
            error: u.plan === "plus"
              ? `You've reached this month's fair-use limit of ${u.limit} AI uses. It resets on ${u.resetsLabel}.`
              : `You've used all ${u.limit} free AI uses this month. Upgrade to Guía Plus for more, or wait until ${u.resetsLabel}.`,
            code: "ai_limit", plan: u.plan, used: u.used, limit: u.limit, resets: u.resets,
          }),
        };
      }
    } catch (err) { console.error("usage check failed (allowing):", err); }
    const res = await inner(event, context);
    if (u && res && res.statusCode === 200) await recordUse(u.key, cost);
    return res;
  };
}

module.exports = { withUsage, usageFor, LIMITS };
