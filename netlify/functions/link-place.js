// netlify/functions/link-place.js
//
// Turns a shared link (TikTok, Instagram, Google Maps, any public web page) or a
// screenshot into real places for Saved places.
//
// Body: { url?: string, image?: { mimeType, data (base64) } }
// Returns: { source: { kind, url, title, thumbnail }, places: [{ placeId, name, address, types, why }] }
//
// Steps: read the public post/page text (oEmbed for TikTok/Instagram, the page's
// title and description otherwise) -> AI picks out place names and cities ->
// Google Places Text Search finds each real place. The screenshot is read once
// and not stored.

const { GoogleGenAI } = require("@google/genai");
const { withUsage } = require("../lib/usage.cjs");
const { claudeEnabled, claudeText, fileBlock, CLAUDE_FAST_MODEL } = require("../lib/ai.cjs");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

const { readLink, safeUrl } = require("../lib/linkread.cjs");

const ASK = `Find the real-world places (restaurants, bars, cafes, shops, hotels, parks, attractions) named in this content.
Return only JSON: {"places":[{"name":"...","city":"...","why":"short phrase from the content, under 12 words"}]}
Rules: only places that are clearly named; include the city or neighborhood when the content gives it (or the creator's obvious city), else "";
at most 6 places; no places that are just mentioned in passing as comparisons; if none, return {"places":[]}.`;

function parseJson(text) {
  const s = String(text || ""); const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

async function extract({ text, image }) {
  if (claudeEnabled()) {
    const content = image
      ? [fileBlock(image.mimeType, image.data), { type: "text", text: `${ASK}\n\nThe image is a screenshot of a social media post or map.` }]
      : `${ASK}\n\nContent:\n${text}`;
    try { return parseJson(await claudeText({ content, model: CLAUDE_FAST_MODEL, maxTokens: 800, timeoutMs: 20000 })); } catch (e) { console.error("Claude extract failed:", e.message); }
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const parts = image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: ASK }] : [{ text: `${ASK}\n\nContent:\n${text}` }];
  const r = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: [{ role: "user", parts }] });
  return parseJson(r.text);
}

async function findPlace(apiKey, name, city) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.primaryType" },
    body: JSON.stringify({ textQuery: [name, city].filter(Boolean).join(", "), pageSize: 1, languageCode: "en" }),
  });
  const j = await res.json().catch(() => ({}));
  const p = (j.places || [])[0];
  return p ? { placeId: p.id, name: p.displayName?.text || name, address: p.formattedAddress || "", types: p.types || [], primaryType: p.primaryType || "" } : null;
}

const handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Not authenticated" });
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return reply(500, { error: "GOOGLE_PLACES_API_KEY not set" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad request" }); }
  try {
    let src = { kind: "screenshot", url: "", title: "", thumbnail: "" };
    let found;
    if (body.image && body.image.data) {
      if (String(body.image.data).length > 8_000_000) return reply(413, { error: "That picture is too large." });
      found = await extract({ image: { mimeType: body.image.mimeType || "image/jpeg", data: body.image.data } });
    } else {
      const u = safeUrl(body.url);
      if (!u) return reply(400, { error: "That doesn't look like a web link." });
      const read = await readLink(u);
      src = read.src;
      if (read.text.length < 8) return reply(200, { source: src, places: [], reason: "unreadable" });
      found = await extract({ text: read.text });
    }
    const named = ((found && found.places) || []).filter((p) => p && p.name).slice(0, 6);
    const places = [];
    for (const p of named) {
      try {
        const hit = await findPlace(apiKey, p.name, p.city);
        if (hit && !places.some((x) => x.placeId === hit.placeId)) places.push({ ...hit, why: p.why || "" });
      } catch { /* skip this one */ }
    }
    return reply(200, { source: src, places, reason: places.length ? "" : named.length ? "not_found" : "no_names" });
  } catch (err) {
    console.error("link-place failed:", err);
    return reply(500, { error: "Couldn't read that link. Try a screenshot instead." });
  }
};

exports.handler = withUsage(handler, () => 1);
