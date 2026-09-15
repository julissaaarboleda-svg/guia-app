// netlify/functions/places-autocomplete.js
//
// Worldwide address autocomplete for the Saved Places "Address" field.
// Uses the same GOOGLE_PLACES_API_KEY already configured for
// places-photo.js — same Places API (New), different endpoint
// (:autocomplete instead of :searchText / photo media).
//
// This only returns the text predictions themselves (no lat/lng, no full
// place details fetch) — the description string returned per prediction is
// already a complete, formatted address, which is all a "Saved Places"
// address field needs. If a future feature needs coordinates (e.g. to plot
// these on a map), a Place Details call keyed by placeId would need to be
// added as a second step.

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
    const { input } = JSON.parse(event.body || "{}");
    if (!input || input.trim().length < 2) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ predictions: [] }) };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({ input: input.trim() }),
    });
    if (!res.ok) throw new Error(`Places autocomplete failed: ${res.status}`);
    const data = await res.json();

    const predictions = (data.suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        description: p.text?.text || "",
        placeId: p.placeId,
      }))
      .filter((p) => p.description)
      .slice(0, 6);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ predictions }) };
  } catch (err) {
    console.error("places-autocomplete.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
