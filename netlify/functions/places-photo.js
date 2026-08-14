// netlify/functions/places-photo.js
//
// Fetches a REAL photo of a REAL place from Google's Places database — no AI
// image generation involved.
//
// ARCHITECTURE NOTE (changed after repeated 404s in production):
// Earlier versions of this function downloaded the photo and stored it in
// Netlify Blobs, then returned a URL pointing at a separate file.js function
// to serve it back out. That introduced two extra points of failure (the
// storage write, and the second function's retrieval) that were hard to
// diagnose without visibility into file.js. This version removes that
// indirection entirely: it fetches the photo bytes here and returns them
// directly as a base64 data URL in the same response. No separate storage,
// no second function, nothing that can 404 after the fact. The client
// (savedAi.js) already caches the resulting value in localStorage, so this
// round trip to Google only happens once per place per browser anyway.
//
// Google's terms require attribution to be shown alongside any Places photo
// — the client displays the small credit returned here.

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
    const { name, city } = JSON.parse(event.body);
    if (!name) throw new Error("Missing 'name'");

    // Step 1: Text Search — find the place and ask specifically for its photos field.
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({ textQuery: city ? `${name}, ${city}` : name }),
    });
    if (!searchRes.ok) throw new Error(`Places search failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    const place = searchData.places?.[0];
    const photoRef = place?.photos?.[0];
    if (!photoRef?.name) {
      // No photo on file for this place — caller falls back to the category
      // gradient/icon placeholder rather than treating this as an error.
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: null, attribution: null }) };
    }

    // Step 2: resolve the photo resource into Google's short-lived signed URL...
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoRef.name}/media?maxWidthPx=500&skipHttpRedirect=true&key=${apiKey}`
    );
    if (!photoRes.ok) throw new Error(`Places photo fetch failed: ${photoRes.status}`);
    const photoData = await photoRes.json();
    if (!photoData.photoUri) throw new Error("No photoUri returned");

    // ...and immediately download the bytes ourselves, server-side, so the
    // browser never has to touch Google's URL (which expires) or our own
    // storage (which was the source of the 404s).
    const imgRes = await fetch(photoData.photoUri);
    if (!imgRes.ok) throw new Error(`Failed to download photo bytes: ${imgRes.status}`);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    const attribution = (photoRef.authorAttributions || [])
      .map((a) => a.displayName)
      .filter(Boolean)
      .join(", ") || "Google";

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        url: `data:${contentType};base64,${base64}`,
        attribution,
      }),
    };
  } catch (err) {
    console.error("places-photo.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
