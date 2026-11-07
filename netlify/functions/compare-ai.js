// netlify/functions/compare-ai.js
//
// Runs one prompt on either Gemini or Claude so the two can be compared side
// by side in Settings > AI comparison. Needs ANTHROPIC_API_KEY (and the
// existing GEMINI_API_KEY) set in Netlify.
//
// Body: { prompt: string, provider: "gemini" | "claude" }
// Returns: { text, ms, model }

const { GoogleGenAI } = require("@google/genai");
const { getStore, connectLambda } = require("@netlify/blobs");

const RATE_LIMIT = 40;
const WINDOW_MS = 60 * 60 * 1000;
const CLAUDE_MODEL = "claude-sonnet-5-5";
const GEMINI_MODEL = "gemini-3.6-flash";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

async function runClaude(prompt, search) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("ANTHROPIC_API_KEY isn't set in Netlify yet."), { status: 500 });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: search ? 3000 : 1500,
      messages: [{ role: "user", content: prompt }],
      ...(search ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Claude request failed (${res.status})`), { status: 502 });
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

async function runGemini(prompt, search) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY isn't set in Netlify."), { status: 500 });
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt, ...(search ? { config: { tools: [{ googleSearch: {} }] } } : {}) });
  return (response.text || "").trim();
}

exports.handler = async (event, context) => {
  connectLambda(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });

  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Not authenticated" });

  let prompt, provider, search;
  try { ({ prompt, provider, search } = JSON.parse(event.body || "{}")); } catch { return reply(400, { error: "Bad request" }); }
  if (!prompt || !["gemini", "claude"].includes(provider)) return reply(400, { error: "Missing prompt or provider" });
  if (prompt.length > 20000) return reply(400, { error: "That prompt is too long." });

  try {
    const store = getStore("rate-limits");
    const key = `compare-${user.sub || user.email || "unknown"}`;
    const now = Date.now();
    let rec = await store.get(key, { type: "json" });
    if (!rec || now - rec.windowStart > WINDOW_MS) rec = { count: 0, windowStart: now };
    if (rec.count >= RATE_LIMIT) return reply(429, { error: "You've hit the comparison limit for this hour." });
    rec.count += 1;
    await store.setJSON(key, rec);
  } catch (err) { console.error("compare-ai rate limit check failed (allowing):", err); }

  const started = Date.now();
  try {
    const text = provider === "claude" ? await runClaude(prompt, !!search) : await runGemini(prompt, !!search);
    return reply(200, { text, ms: Date.now() - started, model: provider === "claude" ? CLAUDE_MODEL : GEMINI_MODEL });
  } catch (err) {
    console.error("compare-ai error:", provider, err);
    return reply(err.status || 500, { error: err.message || "That request failed." });
  }
};
