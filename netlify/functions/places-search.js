// netlify/functions/places-search.js
//
// Real place recommendations via Google Places Text Search — replaces the
// old AI-guessed "well-known places" approach in savedAi.js's
// generateTopPicks(). Runs server-side so GOOGLE_PLACES_API_KEY never
// reaches the client.
//
// Body: { city: string, country?: string, categories: string[], perCategory: number, excludeNames?: string[] }
// Returns: { results: { [category]: PickObject[] } }

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Free-text search phrase per internal category id — Google Places Text
// Search accepts natural-language queries, so this doesn't need to map to
// Places' formal "type" enum.
const CATEGORY_QUERIES = {
  restaurant: "best restaurants in",
  cafe: "best cafes and coffee shops in",
  museum: "top museums in",
  attractions: "top tourist attractions and landmarks in",
  nature: "parks and nature spots in",
  experience: "unique experiences and activities in",
  nightlife: "nightlife and bars in",
  shopping: "shopping and boutiques in",
  relax: "spas and relaxing spots in",
};

function priceLevelToSymbol(level) {
  const map = {
    PRICE_LEVEL_FREE: "",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level] || "";
}

function guessNeighborhood(address) {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim());
  // formatted_address is usually "Street, Neighborhood/District, City, Country"
  // — the second-to-last segment before city/country is the closest guess.
  return parts.length >= 3 ? parts[parts.length - 3] || "" : "";
}

function badgeFor(rating, reviewCount) {
  if (rating >= 4.6 && reviewCount >= 500) return "Highly Recommended";
  if (reviewCount > 0 && reviewCount < 100) return "Hidden Gem";
  if (reviewCount >= 100) return "Popular with Locals";
  return "";
}

async function searchCategory(apiKey, city, country, category, count) {
  const phrase = CATEGORY_QUERIES[category] || `${category} in`;
  const textQuery = `${phrase} ${city}${country ? ", " + country : ""}`;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.editorialSummary",
    },
    body: JSON.stringify({ textQuery, maxResultCount: Math.min(count, 20), languageCode: "en" }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Places API error for "${category}": ${data?.error?.message || res.status}`);
  }

  return (data.places || []).slice(0, count).map((place) => ({
    name: place.displayName?.text || "",
    category,
    aiBadge: badgeFor(place.rating || 0, place.userRatingCount || 0),
    // Real editorial summary when Google has one (a genuine written blurb,
    // in English per languageCode above) — falls back to the address only
    // when no summary exists, same as before.
    description: place.editorialSummary?.text || place.formattedAddress || "",
    address: place.formattedAddress || "",
    neighborhood: guessNeighborhood(place.formattedAddress),
    rating: place.rating || null,
    reviewCount: place.userRatingCount || 0,
    price: priceLevelToSymbol(place.priceLevel),
    website: place.websiteUri || "",
    // No API provides verified social handles, and having AI guess one
    // risks pointing someone at the wrong account entirely. This links to
    // a real Instagram search for the place's name instead — always
    // accurate, never a fabricated handle.
    instagramSearchUrl: place.displayName?.text
      ? `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(place.displayName.text)}`
      : "",
    place_id: place.id,
  }));
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
    const { city, country, categories, perCategory, excludeNames } = JSON.parse(event.body);
    if (!city || !categories?.length) throw new Error("Missing 'city' or 'categories'");

    const excludeSet = new Set((excludeNames || []).map((n) => (n || "").toLowerCase()));
    // Fetch a small buffer beyond what's needed so excluding already-saved
    // places doesn't leave a category short.
    const fetchCount = Math.min((perCategory || 1) + excludeSet.size + 3, 20);

    const entries = await Promise.all(
      categories.map(async (cat) => {
        try {
          const picks = await searchCategory(apiKey, city, country, cat, fetchCount);
          const filtered = picks.filter((p) => !excludeSet.has((p.name || "").toLowerCase()));
          return [cat, filtered.slice(0, perCategory || 1)];
        } catch (err) {
          console.error(err);
          return [cat, []];
        }
      })
    );

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ results: Object.fromEntries(entries) }) };
  } catch (err) {
    console.error("places-search.js error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
