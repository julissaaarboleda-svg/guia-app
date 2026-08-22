// netlify/functions/static-map.js
//
// Returns a static map image (as a data URL) showing the trip's cities as
// labeled pins connected by a route line. Runs server-side so
// GOOGLE_PLACES_API_KEY never reaches the client — Static Maps API requires
// the key directly in the image URL, which would otherwise be visible in
// the page's network requests if called straight from the browser.

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
    const { cities, country } = JSON.parse(event.body);
    if (!cities || !cities.length) throw new Error("Missing 'cities'");

    const labeled = cities.slice(0, 10).map((c, i) => `${c}${country ? ", " + country : ""}`);
    const markerParams = labeled
      .map((loc, i) => `markers=${encodeURIComponent(`label:${String.fromCharCode(65 + i)}|color:0xA7773F|${loc}`)}`)
      .join("&");
    const pathParam = labeled.length > 1
      ? `&path=${encodeURIComponent(`color:0xA7773Fcc|weight:3|${labeled.join("|")}`)}`
      : "";

    const url = `https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=terrain${pathParam}&${markerParams}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Static Maps API error: ${res.status} ${text.slice(0, 200)}`);
    }
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ dataUrl: `data:image/png;base64,${base64}` }),
    };
  } catch (err) {
    console.error("static-map.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
