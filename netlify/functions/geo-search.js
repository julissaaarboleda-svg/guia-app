// netlify/functions/geo-search.js
//
// Replaces the old hardcoded ~10-country placeholder in src/lib/cityData.js.
// Uses the real country-state-city dataset (250 countries, 150k+ cities) —
// but that dataset is ~8MB, so it lives here on the server, not bundled into
// the client. The browser only ever receives small, filtered result lists.
//
// GET /.netlify/functions/geo-search?type=countries&q=bra
// GET /.netlify/functions/geo-search?type=cities&q=sao&countries=Brazil,Argentina
// GET /.netlify/functions/geo-search?type=cities-worldwide&q=mia
const { Country, City } = require("country-state-city");
const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
// Strips accents so "sao paulo" matches "São Paulo" — plain string matching
// is accent-sensitive by default in JS, which is why this silently failed.
function normalize(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
let allCountries = null;
function getCountries() {
  if (!allCountries) allCountries = Country.getAllCountries();
  return allCountries;
}
// Cached once per warm function instance — filtering 150k+ cities on every
// single keystroke request would be wasteful without this.
let allCitiesWorldwide = null;
function getAllCitiesWorldwide() {
  if (!allCitiesWorldwide) allCitiesWorldwide = City.getAllCities();
  return allCitiesWorldwide;
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const params = event.queryStringParameters || {};
  const type = params.type;
  const q = normalize((params.q || "").trim());
  try {
    if (type === "countries") {
      if (!q) return { statusCode: 200, headers: CORS, body: JSON.stringify([]) };
      const matches = getCountries()
        .filter((c) => normalize(c.name).startsWith(q))
        .concat(getCountries().filter((c) => !normalize(c.name).startsWith(q) && normalize(c.name).includes(q)))
        .slice(0, 8)
        .map((c) => c.name);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(matches) };
    }
    if (type === "cities") {
      const countryNames = (params.countries || "").split(",").map((s) => s.trim()).filter(Boolean);
      const isoCodes = countryNames
        .map((name) => getCountries().find((c) => c.name === name)?.isoCode)
        .filter(Boolean);
      if (isoCodes.length === 0 || !q) return { statusCode: 200, headers: CORS, body: JSON.stringify([]) };
      let pool = [];
      for (const iso of isoCodes) {
        pool = pool.concat(City.getCitiesOfCountry(iso) || []);
      }
      const startsWith = pool.filter((c) => normalize(c.name).startsWith(q));
      const contains = pool.filter((c) => !normalize(c.name).startsWith(q) && normalize(c.name).includes(q));
      const names = [...new Set([...startsWith, ...contains].map((c) => c.name))].slice(0, 8);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(names) };
    }
    if (type === "cities-worldwide") {
      // True global search, no country required up front — this is what a
      // real flight-booking city field needs (e.g. typing "Mia" for a
      // departure city that has nothing to do with the trip's own
      // countries). Each match is a formatted display string that already
      // includes the country (and state, when it helps tell same-named
      // cities apart), since the client only expects plain strings.
      if (!q || q.length < 2) return { statusCode: 200, headers: CORS, body: JSON.stringify([]) };
      const countryByIso = new Map(getCountries().map((c) => [c.isoCode, c.name]));
      const pool = getAllCitiesWorldwide();
      const startsWith = pool.filter((c) => normalize(c.name).startsWith(q));
      const contains = pool.filter((c) => !normalize(c.name).startsWith(q) && normalize(c.name).includes(q));
      const combined = [...startsWith, ...contains].slice(0, 30);
      const seen = new Set();
      const results = [];
      for (const c of combined) {
        const countryName = countryByIso.get(c.countryCode) || c.countryCode;
        const label = c.stateCode
          ? `${c.name}, ${c.stateCode}, ${countryName}`
          : `${c.name}, ${countryName}`;
        if (seen.has(label)) continue;
        seen.add(label);
        results.push(label);
        if (results.length >= 8) break;
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify(results) };
    }
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "type must be 'countries', 'cities', or 'cities-worldwide'" }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
