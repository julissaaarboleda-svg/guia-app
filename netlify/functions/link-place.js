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
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

const strip = (html) => String(html || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const meta = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  return strip((html.match(re) || html.match(re2) || [])[1] || "");
};

// Only public web addresses: no localhost, private ranges or bare IPs.
function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":")) return null;
  return u;
}

async function fetchText(url, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow", signal: c.signal });
    const finalUrl = r.url || url;
    if (!safeUrl(finalUrl)) throw new Error("Blocked redirect");
    const text = (await r.text()).slice(0, 400000);
    return { ok: r.ok, text, finalUrl };
  } finally { clearTimeout(t); }
}

// Follow short links (tiktok.com/t/…, vm.tiktok.com, maps.app.goo.gl, instagr.am)
// to the full address, hop by hop, without loading the pages.
async function expand(u) {
  let cur = u.toString();
  for (let i = 0; i < 6; i++) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    let r;
    try { r = await fetch(cur, { method: "GET", redirect: "manual", headers: { "User-Agent": UA }, signal: c.signal }); }
    catch { break; } finally { clearTimeout(t); }
    const loc = r.headers.get("location");
    if (!(r.status >= 300 && r.status < 400) || !loc) break;
    const next = new URL(loc, cur).toString();
    if (!safeUrl(next)) break;
    cur = next;
  }
  return new URL(cur);
}

// A post's own address without tracking bits (oEmbed is picky about these).
const clean = (u) => { const x = new URL(u.toString()); x.search = ""; x.hash = ""; return x.toString(); };

// Pull the caption out of a TikTok/Instagram page's embedded data.
function embeddedCaption(html) {
  const pick = (re) => { const m = html.match(re); if (!m) return ""; try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; } };
  return [pick(/"desc"\s*:\s*"((?:[^"\\]|\\.){4,2000})"/), pick(/"caption"\s*:\s*\{[^}]*?"text"\s*:\s*"((?:[^"\\]|\\.){4,2000})"/),
    pick(/"(?:poi|location)(?:Name)?"\s*:\s*\{[^}]*?"name"\s*:\s*"((?:[^"\\]|\\.){2,200})"/)].filter(Boolean).join(" | ");
}

// Read what the link says about itself.
async function readLink(u0) {
  const short = /^(vm|vt)\.tiktok\.com$|(^|\.)tiktok\.com$|^instagr\.am$|^maps\.app\.goo\.gl$|^goo\.gl$/.test(u0.hostname.replace(/^www\./, ""))
    && (/^(vm|vt)\./.test(u0.hostname) || /^\/t\//.test(u0.pathname) || /goo\.gl|instagr\.am/.test(u0.hostname));
  const u = short ? await expand(u0) : u0;
  const host = u.hostname.replace(/^www\./, "");
  const src = { kind: "web", url: u0.toString(), title: "", thumbnail: "" };
  let text = "";
  if (/(^|\.)tiktok\.com$/.test(host)) {
    src.kind = "tiktok";
    try {
      const r = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(clean(u))}`);
      const j = JSON.parse(r.text);
      src.title = j.title || ""; src.thumbnail = j.thumbnail_url || "";
      text = `TikTok by ${j.author_name || "unknown"}: ${j.title || ""}`;
    } catch { /* fall through to the page */ }
  } else if (/(^|\.)instagram\.com$/.test(host)) {
    src.kind = "instagram";
    try {
      const r = await fetchText(`https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(clean(u))}`);
      const j = JSON.parse(r.text);
      if (!j.error) {
        src.thumbnail = j.thumbnail_url || "";
        const cap = strip(j.html || "");
        src.title = (j.title || cap).slice(0, 200);
        text = `Instagram post by ${j.author_name || "unknown"}: ${j.title || ""} ${cap}`;
      }
    } catch { /* fall through to the page */ }
  } else if (/(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/.test(host)) {
    src.kind = "maps";
  }
  if (text.replace(/\s/g, "").length < 40) {
    const r = await fetchText(u.toString());
    const html = r.text;
    const finalUrl = r.finalUrl;
    // Google Maps links name the place in the address itself.
    const m = finalUrl.match(/\/maps\/place\/([^/@?]+)/) || finalUrl.match(/[?&]q=([^&]+)/);
    if (m) text += ` Google Maps place: ${decodeURIComponent(m[1].replace(/\+/g, " "))}`;
    const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const parts = [meta(html, "og:title"), title, meta(html, "og:description"), meta(html, "description"), embeddedCaption(html)].filter(Boolean);
    if (!src.title) src.title = (parts[0] || "").slice(0, 200);
    if (!src.thumbnail) src.thumbnail = meta(html, "og:image");
    text += ` ${parts.join(" | ")}`;
    if (src.kind === "web" && text.length < 300) text += ` ${strip(html).slice(0, 3000)}`;
  }
  console.log("link-place read", { kind: src.kind, url: src.url, chars: text.trim().length, sample: text.trim().slice(0, 160) });
  return { src, text: text.trim().slice(0, 6000) };
}

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
