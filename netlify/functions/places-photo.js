// netlify/functions/places-photo.js
//
// Replaces generate-image.js for the "top picks" / wishlist photo use case.
// Instead of asking Gemini to imagine what a place looks like, this fetches a
// REAL photo of the REAL place from Google's Places database.
//
// IMPORTANT: Google's Place Photo media endpoint returns a short-lived signed
// URL (photoUri), not a permanent link. The first version of this function
// returned that URL directly, and the client cached it indefinitely — which
// worked initially, then broke (broken-image icons) once the signed URL
// expired. Fix: download the actual image bytes here and store them in our
// own Netlify Blobs, the same pattern as upload.js / generate-image.js, so we
// return a stable URL that never expires.
//
// Two-step Places API (New) flow:
//   1. Text Search — find the place, get back a photo resource name
//   2. Place Photo media — resolve that resource name into actual image bytes
//
// Google's terms require attribution to be shown alongside any Places photo
// (see authorAttributions in the response) — the client must display it,
// even briefly (e.g. a small "Photo via Google" credit on the card).

const { getStore, connectLambda } = require("@netlify/blobs");
const { randomUUID } = require("node:crypto");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
  connectLambda(event); // required for getStore() to auto-detect credentials
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

    // Step 2a: resolve the photo resource into Google's short-lived signed URL.
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoRef.name}/media?maxWidthPx=600&skipHttpRedirect=true&key=${apiKey}`
    );
    if (!photoRes.ok) throw new Error(`Places photo fetch failed: ${photoRes.status}`);
    const photoData = await photoRes.json();
    if (!photoData.photoUri) throw new Error("No photoUri returned");

    // Step 2b: immediately download the actual bytes from that signed URL —
    // this is what makes the result permanent instead of expiring.
    const imgRes = await fetch(photoData.photoUri);
    if (!imgRes.ok) throw new Error(`Failed to download photo bytes: ${imgRes.status}`);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const store = getStore("guia-files");
    const fileId = randomUUID();
    const key = `${user.sub}/places/${fileId}.jpg`;
    await store.set(key, buffer, { metadata: { contentType } });

    const attribution = (photoRef.authorAttributions || [])
      .map((a) => a.displayName)
      .filter(Boolean)
      .join(", ") || "Google";

    const siteUrl = process.env.URL || `https://${event.headers.host}`;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        url: `${siteUrl}/.netlify/functions/file?key=${encodeURIComponent(key)}`,
        attribution,
      }),
    };
  } catch (err) {
    console.error("places-photo.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
