// netlify/functions/link-preview.js
//
// A nice preview for a link saved on a note or list: title, who made it, and the
// cover image (sent back as image data so the app can keep its own copy, since
// TikTok/Instagram image links expire).
//
// Body: { url } -> { kind, url, title, author, site, isVideo, image: { mimeType, data } | null }

const { readLink, safeUrl, UA } = require("../lib/linkread.cjs");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

async function imageData(url) {
  if (!url || !safeUrl(url)) return null;
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: c.signal });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 2_500_000) return null;
    return { mimeType: type, data: buf.toString("base64") };
  } catch { return null; } finally { clearTimeout(t); }
}

const handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed" });
  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Not authenticated" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad request" }); }
  const u = safeUrl(body.url);
  if (!u) return reply(400, { error: "That doesn't look like a web link." });
  try {
    const { src } = await readLink(u);
    const isVideo = ["tiktok", "instagram", "youtube"].includes(src.kind) || /\/(reel|reels|tv|shorts|video)\//i.test(src.url);
    const title = String(src.title || "").replace(/\s+/g, " ").trim().slice(0, 140);
    return reply(200, { kind: src.kind, url: src.url, title, author: src.author || "", site: src.site || u.hostname.replace(/^www\./, ""), isVideo, image: await imageData(src.thumbnail) });
  } catch (err) {
    console.error("link-preview failed:", err.message);
    return reply(200, { kind: "web", url: u.toString(), title: "", author: "", site: u.hostname.replace(/^www\./, ""), isVideo: false, image: null });
  }
};

// A preview isn't an AI use, so it doesn't count toward the monthly limit.
exports.handler = handler;
