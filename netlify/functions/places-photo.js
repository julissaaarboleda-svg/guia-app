// netlify/functions/places-photo.js
//
// Replaces generate-image.js for the "top picks" / wishlist photo use case.
// Instead of asking Gemini to imagine what a place looks like, this fetches a
// REAL photo of the REAL place from Google's Places database.
//
// Two-step Places API (New) flow:
//   1. Text Search — find the place, get back a photo resource name
//   2. Place Photo media — resolve that resource name into an actual image URL
//
// Google's terms require attribution to be shown alongside any Places photo
// (see authorAttributions in the response) — the client must display it,
// even briefly (e.g. a small "Photo via Google" credit on the card).

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
    // Field mask keeps this at the Pro SKU tier (not Enterprise) since we're not
    // requesting rating/reviews/atmosphere data, just id + photos.
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
      // No photo on file for this place — caller should fall back to the
      // category gradient/icon placeholder rather than treat this as an error.
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ url: null, attribution: null }) };
    }

    // Step 2: resolve the photo resource into an actual URL.
    // skipHttpRedirect=true makes this return JSON (with photoUri) instead of
    // a 302 redirect, which is what we want from a server-side fetch.
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoRef.name}/media?maxWidthPx=600&skipHttpRedirect=true&key=${apiKey}`
    );
    if (!photoRes.ok) throw new Error(`Places photo fetch failed: ${photoRes.status}`);
    const photoData = await photoRes.json();

    const attribution = (photoRef.authorAttributions || [])
      .map((a) => a.displayName)
      .filter(Boolean)
      .join(", ") || "Google";

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ url: photoData.photoUri || null, attribution }),
    };
  } catch (err) {
    console.error("places-photo.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
