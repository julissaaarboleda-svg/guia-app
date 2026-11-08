// netlify/functions/place-details.js
//
// Richer details for one place (hours, phone, website, map link, a few
// review snippets) from Google Places API (New) "Place Details". Fetched only
// when someone opens a place, then cached client-side, so it costs one
// request per place per browser. No AI involved.
//
// Body: { place_id: string }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const FIELDS = [
  "id", "formattedAddress", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri",
  "googleMapsUri", "regularOpeningHours", "currentOpeningHours", "editorialSummary",
  "reviews", "rating", "userRatingCount", "priceLevel",
].join(",");

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
    const { place_id } = JSON.parse(event.body || "{}");
    if (!place_id || !/^[A-Za-z0-9_-]+$/.test(place_id)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing or invalid 'place_id'" }) };
    }

    const res = await fetch(`https://places.googleapis.com/v1/places/${place_id}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELDS },
    });
    const p = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(p?.error?.message || `Place details failed (${res.status})`);

    const hours = p.regularOpeningHours || {};
    const result = {
      address: p.formattedAddress || "",
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
      website: p.websiteUri || "",
      mapsUrl: p.googleMapsUri || "",
      summary: p.editorialSummary?.text || "",
      openNow: p.currentOpeningHours?.openNow ?? hours.openNow ?? null,
      weekdayHours: hours.weekdayDescriptions || [],
      reviews: (p.reviews || []).slice(0, 3).map((r) => ({
        rating: r.rating || null,
        text: (r.text?.text || r.originalText?.text || "").slice(0, 280),
        when: r.relativePublishTimeDescription || "",
        author: r.authorAttribution?.displayName || "",
      })).filter((r) => r.text),
    };
    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
  } catch (err) {
    console.error("place-details.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
