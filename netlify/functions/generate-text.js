// netlify/functions/generate-text.js
//
// Generic replacement for the simpler base44.integrations.Core.InvokeLLM calls
// (ones that don't need Google Search grounding — e.g. generateTravelBrief,
// FinanceSummary's insights, generatePackingList, the AI Assistant chat).
//
// Body: { prompt: string, grounded?: boolean }
// Grounded calls (weather, top picks, suggestions, "know before you go") should
// use their own dedicated functions like generate-top-picks.js instead, since
// those need specific structured-output handling — this one is for everything else.

const { GoogleGenAI } = require("@google/genai");
const { getStore, connectLambda } = require("@netlify/blobs");

// --- Rate limit settings (same approach as Chapter I's gemini-proxy.js) ---
const RATE_LIMIT = 30;              // max requests allowed per window, per IP
const WINDOW_MS = 60 * 60 * 1000;   // window length: 1 hour

// Grounded (Google Search) requests cost more per call than a plain text
// generation, so they get their own, tighter budget on top of the general
// limit above — protects against runaway search cost specifically, even if
// someone's well within the general 30/hour limit.
const GROUNDED_RATE_LIMIT = 8;      // max grounded requests per window, per user

const { claudeEnabled, claudeText, fileBlock } = require("../lib/ai");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

// Shared helper for both the general and grounded limits — same
// check-and-increment logic, just a different store key and cap.
async function checkAndIncrement(store, key, limit, now) {
  let record = await store.get(key, { type: "json" });
  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { count: 0, windowStart: now };
  }
  if (record.count >= limit) {
    const retryAfterMin = Math.ceil((WINDOW_MS - (now - record.windowStart)) / 60000);
    return { limited: true, retryAfterMin };
  }
  record.count += 1;
  await store.setJSON(key, record);
  return { limited: false };
}

exports.handler = async (event, context) => {
  connectLambda(event);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Not authenticated" }) };

  const apiKey = process.env.GEMINI_API_KEY;
  const useClaude = claudeEnabled();
  if (!apiKey && !useClaude) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "No AI key set" }) };

  const { prompt, grounded, wantJson, files } = JSON.parse(event.body || "{}");
  const attachments = (Array.isArray(files) ? files : []).slice(0, 3).filter((f) => f && f.base64Data);
  if (!prompt) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing 'prompt'" }) };

  // --- Rate limiting: check this before doing anything else ---
  // Keyed by logged-in user id rather than IP, since Guía requires auth
  // (unlike Chapter I, which is anonymous) — this gives each person their
  // own 30/hour budget instead of everyone behind the same office wifi
  // sharing one bucket. Uses connectLambda(event) above for auto-detected
  // credentials — Guía's proven Blobs pattern, no separate site/token env
  // vars needed.
  try {
    const store = getStore("rate-limits");
    const userKey = `user-${user.sub || user.email || "unknown"}`;
    const now = Date.now();

    const general = await checkAndIncrement(store, userKey, RATE_LIMIT, now);
    if (general.limited) {
      return {
        statusCode: 429,
        headers: CORS,
        body: JSON.stringify({
          error: `You've hit the request limit. Please try again in about ${general.retryAfterMin} minute(s).`,
        }),
      };
    }

    if (grounded) {
      const groundedKey = `${userKey}-grounded`;
      const groundedCheck = await checkAndIncrement(store, groundedKey, GROUNDED_RATE_LIMIT, now);
      if (groundedCheck.limited) {
        return {
          statusCode: 429,
          headers: CORS,
          body: JSON.stringify({
            error: `You've hit the search limit for this hour. Please try again in about ${groundedCheck.retryAfterMin} minute(s), or ask without needing current info.`,
          }),
        };
      }
    }
  } catch (err) {
    // Never let a rate-limit bug block a legitimate request.
    console.error("Rate limit check failed (allowing request):", err);
  }
  // --- End rate limiting ---

  try {
    let text;
    if (useClaude && !grounded) {
      try {
        const instruction = wantJson ? `${prompt}\n\nReturn only valid JSON, with no commentary or code fences.` : prompt;
        text = await claudeText({
          content: attachments.length ? [...attachments.map((f) => fileBlock(f.mimeType, f.base64Data)), { type: "text", text: instruction }] : instruction,
        });
      } catch (claudeErr) {
        console.error("generate-text Claude failed, falling back to Gemini:", claudeErr);
        if (!apiKey) throw claudeErr;
      }
    }
    if (text === undefined) {
      const ai = new GoogleGenAI({ apiKey });
      const contents = attachments.length
        ? [{ role: "user", parts: [{ text: prompt }, ...attachments.map((f) => ({ inlineData: { mimeType: f.mimeType || "image/jpeg", data: f.base64Data } }))] }]
        : prompt;
      const request = { contents, ...(grounded ? { config: { tools: [{ googleSearch: {} }] } } : {}) };
      // The AI service is sometimes briefly overloaded; try once more, on a second model, before giving up.
      let response;
      try {
        response = await ai.models.generateContent({ model: "gemini-3.6-flash", ...request });
      } catch (firstErr) {
        console.error("generate-text first attempt failed, retrying:", firstErr);
        response = await ai.models.generateContent({ model: "gemini-3.5-flash", ...request });
      }
      text = response.text;
    }

    if (wantJson) {
      const parsed = extractJson(text);
      if (!parsed) throw new Error("Model response did not contain valid JSON");
      return { statusCode: 200, headers: CORS, body: JSON.stringify(parsed) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ text }) };
  } catch (err) {
    console.error("generate-text.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
