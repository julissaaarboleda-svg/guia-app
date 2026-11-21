// netlify/functions/place-lookup.js
//
// One call that turns a picked Google place into everything a Saved Place needs:
// its name, full address, a category guess, a Maps link and one photo.
// The photo bytes are downloaded here (Google's photo links expire), the same
// way places-photo.js does it for Explore.
//
// Body: { place_id: string }
// Returns: { name, address, mapsUrl, types, primaryType, url (data URI or null), attribution }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const FIELDS = "id,displayName,formattedAddress,googleMapsUri,types,primaryTypeDisplayName,photos,websiteUri";

// Instagram and TikTok accounts linked from the place's own website (Google doesn't list them).
const SKIP = /^(p|reel|reels|explore|stories|accounts|share|sharer|intent|embed|tv|about|legal|developer|tag|music|discover)$/i;
async function socialsFrom(website) {
  const out = { instagram: "", tiktok: "" };
  if (!/^https?:\/\//i.test(website || "")) return out;
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 5000);
  try {
    const r = await fetch(website, { redirect: "follow", signal: c.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; GuiaBot/1.0)" } });
    if (!r.ok) return out;
    const html = (await r.text()).slice(0, 600000);
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?=["'?#<\s])/g)) {
      if (!SKIP.test(m[1])) { out.instagram = `https://www.instagram.com/${m[1]}/`; break; }
    }
    for (const m of html.matchAll(/https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,30})/g)) {
      out.tiktok = `https://www.tiktok.com/@${m[1]}`; break;
    }
  } catch { /* the website is a nice-to-have */ } finally { clearTimeout(t); }
  return out;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Not authenticated" }) };
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "GOOGLE_PLACES_API_KEY not set" }) };

  try {
    const { place_id, links_only } = JSON.parse(event.body || "{}");
    if (!place_id || !/^[A-Za-z0-9_-]+$/.test(place_id)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing or invalid 'place_id'" }) };
    }
    const res = await fetch(`https://places.googleapis.com/v1/places/${place_id}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELDS },
    });
    const p = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(p?.error?.message || `Place lookup failed (${res.status})`);

    const result = {
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      mapsUrl: p.googleMapsUri || "",
      types: p.types || [],
      primaryType: p.primaryTypeDisplayName?.text || "",
      url: null,
      attribution: null,
      website: p.websiteUri || "",
      instagram: "",
      tiktok: "",
    };
    const socials = await socialsFrom(result.website);
    result.instagram = socials.instagram; result.tiktok = socials.tiktok;
    if (links_only) return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };

    // The photo is a nice-to-have: any failure here still returns the place itself.
    try {
      const ref = p.photos && p.photos[0];
      if (ref && ref.name) {
        const photoRes = await fetch(`https://places.googleapis.com/v1/${ref.name}/media?maxWidthPx=640&skipHttpRedirect=true&key=${apiKey}`);
        if (photoRes.ok) {
          const photoData = await photoRes.json();
          if (photoData.photoUri) {
            const imgRes = await fetch(photoData.photoUri);
            if (imgRes.ok) {
              const contentType = imgRes.headers.get("content-type") || "image/jpeg";
              const base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
              result.url = `data:${contentType};base64,${base64}`;
              result.attribution = (ref.authorAttributions || []).map((a) => a.displayName).filter(Boolean).join(", ") || "Google";
            }
          }
        }
      }
    } catch (e) {
      console.error("place-lookup photo error:", e);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
  } catch (err) {
    console.error("place-lookup.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
