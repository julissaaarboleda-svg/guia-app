// netlify/lib/linkread.cjs
// Reads what a public link says about itself: TikTok/Instagram captions (oEmbed,
// with short links expanded first), Google Maps place names, or a web page's
// title, description and text. Used by link-place and make-list.

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

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

// TikTok auto-captions (WebVTT), English first. Best effort: not every video has them.
async function tiktokCaptions(u) {
  const r = await fetchText(clean(u), 8000);
  const html = r.text;
  const dec = (x) => { try { return JSON.parse(`"${x}"`); } catch { return x; } };
  const infos = [...html.matchAll(/\{[^{}]*?"Format"\s*:\s*"webvtt"[^{}]*?\}/g)].map((m) => m[0]);
  const pick = infos.find((b) => /eng|en-/i.test(b)) || infos[0];
  if (!pick) return "";
  const urlM = pick.match(/"Url"\s*:\s*"([^"]+)"/);
  if (!urlM) return "";
  const vttUrl = dec(urlM[1]);
  if (!safeUrl(vttUrl)) return "";
  const v = await fetchText(vttUrl, 6000);
  return v.text.split("\n")
    .filter((l) => l.trim() && !/^WEBVTT/.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()))
    .join(" ").replace(/\s+/g, " ").slice(0, 8000);
}

// Read what the link says about itself.
async function readLink(u0, opts = {}) {
  const short = /^(vm|vt)\.tiktok\.com$|(^|\.)tiktok\.com$|^instagr\.am$|^maps\.app\.goo\.gl$|^goo\.gl$/.test(u0.hostname.replace(/^www\./, ""))
    && (/^(vm|vt)\./.test(u0.hostname) || /^\/t\//.test(u0.pathname) || /goo\.gl|instagr\.am/.test(u0.hostname));
  const u = short ? await expand(u0) : u0;
  const host = u.hostname.replace(/^www\./, "");
  const src = { kind: "web", url: u0.toString(), title: "", thumbnail: "", author: "", site: u.hostname.replace(/^www\./, "") };
  let text = "";
  if (/(^|\.)tiktok\.com$/.test(host)) {
    src.kind = "tiktok";
    try {
      const r = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(clean(u))}`);
      const j = JSON.parse(r.text);
      src.title = j.title || ""; src.thumbnail = j.thumbnail_url || ""; src.author = j.author_name ? `@${String(j.author_unique_id || j.author_name).replace(/^@/, "")}` : "";
      text = `TikTok by ${j.author_name || "unknown"}: ${j.title || ""}`;
    } catch { /* fall through to the page */ }
  } else if (/(^|\.)instagram\.com$/.test(host)) {
    src.kind = "instagram";
    try {
      const r = await fetchText(`https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(clean(u))}`);
      const j = JSON.parse(r.text);
      if (!j.error) {
        src.thumbnail = j.thumbnail_url || ""; src.author = j.author_name ? `@${String(j.author_name).replace(/^@/, "")}` : "";
        const cap = strip(j.html || "");
        src.title = (j.title || cap).slice(0, 200);
        text = `Instagram post by ${j.author_name || "unknown"}: ${j.title || ""} ${cap}`;
      }
    } catch { /* fall through to the page */ }
  } else if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) {
    src.kind = "youtube";
    try {
      const r = await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`);
      const j = JSON.parse(r.text);
      src.title = j.title || ""; src.thumbnail = j.thumbnail_url || ""; src.author = j.author_name || "";
      text = `YouTube video by ${j.author_name || "unknown"}: ${j.title || ""}`;
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
    if (src.kind === "web" && opts.fullText) {
      // Recipe sites list ingredients in structured data; grab that first.
      const ing = html.match(/"recipeIngredient"\s*:\s*(\[[\s\S]*?\])/);
      if (ing) { try { text += ` Ingredients: ${JSON.parse(ing[1]).join("; ")}`; } catch { /* ignore */ } }
      text += ` ${strip(html).slice(0, 14000)}`;
    } else if (src.kind === "web" && text.length < 300) text += ` ${strip(html).slice(0, 3000)}`;
  }
  // TikTok: when we need the whole how-to, also try the video's auto-captions
  // (what's said out loud), which TikTok includes for many videos.
  if (opts.fullText && src.kind === "tiktok") {
    try { const said = await tiktokCaptions(u); if (said) text += ` What's said in the video: ${said}`; } catch { /* captions are a bonus */ }
  }
  console.log("link-place read", { kind: src.kind, url: src.url, chars: text.trim().length, sample: text.trim().slice(0, 160) });
  return { src, text: text.trim().slice(0, opts.fullText ? 18000 : 6000) };
}


module.exports = { readLink, safeUrl, strip, fetchText, UA };
