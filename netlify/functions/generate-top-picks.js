// netlify/functions/generate-top-picks.js
//
// Replaces: base44.integrations.Core.InvokeLLM (called from src/lib/savedAi.js -> generateTopPicks)
// Powers: the "Top Picks" carousel on the Saved tab of a trip.
//
// Your React app should call this via fetch() instead of the Base44 SDK. See
// the bottom of this file for the exact client-side replacement code.

const { GoogleGenAI } = require("@google/genai");

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const CATEGORIES = [
  "restaurant", "cafe", "museum", "attractions",
  "nature", "experience", "nightlife", "shopping", "relax",
];

// Same season logic as your original journeyAi.js getSeason()
function getSeason(dateStr) {
  if (!dateStr) return "unknown";
  const m = new Date(dateStr).getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

// Gemini's grounding tool doesn't reliably combine with strict JSON schema mode,
// so we ask for JSON in the prompt and parse it defensively out of the response text.
function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response");
  return JSON.parse(raw.slice(start, end + 1));
}

exports.handler = async (event) => {
  // Browsers send an OPTIONS preflight before the real POST for cross-origin calls.
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let trip, city;
  try {
    ({ trip, city } = JSON.parse(event.body));
    if (!city) throw new Error("Missing 'city'");
  } catch (err) {
    console.error("generate-top-picks.js bad request:", err);
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Bad request: ${err.message}` }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "GEMINI_API_KEY is not set on this Netlify site" }) };
  }

  const season = getSeason(trip?.start_date);
  const seed = Math.floor(Math.random() * 100000);

  const prompt = `You are a luxury travel curator for the Guía app. The traveler is visiting ${city}${trip?.country ? ", " + trip.country : ""} during ${season} season.

Use live web knowledge to return REAL, well-known places in ${city}. You MUST include the city's most iconic landmarks and must-see sights under the "attractions" category — never omit the famous sights.

Return exactly 1 pick for EACH of these categories (9 total): ${CATEGORIES.join(", ")}.
Each pick: { "name": real place name, "category": one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}, "aiBadge": one of "Highly Recommended"/"Hidden Gem"/"Popular with Locals", "description": one sentence under 80 chars, "neighborhood": string, "rating": number like 4.7, "reviewCount": integer like 1240, "price": "$" to "$$$$" or "" for museums/landmarks, "website": real https URL or "", "imagePrompt": short editorial travel photo prompt (subject, warm golden light, no text, no people, no watermark) }.

Variety seed: ${seed}. Favor variety — mix iconic staples with genuine local favorites.

Respond with ONLY a JSON object in this exact shape, no markdown, no commentary:
{ "picks": [ /* exactly 9 objects, 1 per category, in the order listed above */ ] }`;

  const ai = new GoogleGenAI({ apiKey });

  // Mirror the original's retry-with-backoff behavior — grounded calls are flakier.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const text = response.text;
      const parsed = extractJson(text);
      if (!parsed.picks || !parsed.picks.length) throw new Error("Model returned empty picks");
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ picks: parsed.picks }),
      };
    } catch (err) {
      lastErr = err;
      console.error(`generate-top-picks.js attempt ${attempt + 1} failed:`, err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  console.error("generate-top-picks.js all 3 attempts failed:", lastErr);
  return {
    statusCode: 502,
    headers: CORS,
    body: JSON.stringify({ error: `Gemini call failed after 3 attempts: ${lastErr.message}` }),
  };
};

/* ============================================================
   CLIENT-SIDE REPLACEMENT — paste this into your Base44-hosted
   src/lib/savedAi.js, replacing the existing generateTopPicks
   function. Everything else in that file (caching helpers) stays.
   ============================================================

   const NETLIFY_FN_URL = "https://YOUR-NEW-SITE-NAME.netlify.app/.netlify/functions/generate-top-picks";

   export async function generateTopPicks(trip, city) {
     const res = await fetch(NETLIFY_FN_URL, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ trip, city }),
     });
     if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.error || `Request failed: ${res.status}`);
     }
     return res.json(); // { picks: [...] }
   }
*/
