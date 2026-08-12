// Real country/city search — routes to netlify/functions/geo-search.js, which
// uses the comprehensive country-state-city dataset server-side (250 countries,
// 150k+ cities). The old version of this file only had ~10 hardcoded countries
// as a placeholder, which is why cities you typed often silently failed to
// appear as suggestions. This is real, not a placeholder anymore.

let countryDebounce = null;
let cityDebounce = null;

export function searchCountries(query, callback) {
  clearTimeout(countryDebounce);
  countryDebounce = setTimeout(async () => {
    try {
      const res = await fetch(`/.netlify/functions/geo-search?type=countries&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      callback(data);
    } catch {
      callback([]);
    }
  }, 200);
}

export function searchCities(query, selectedCountries, callback) {
  clearTimeout(cityDebounce);
  if (!selectedCountries || selectedCountries.length === 0) { callback([]); return; }
  cityDebounce = setTimeout(async () => {
    try {
      const countriesParam = encodeURIComponent(selectedCountries.join(","));
      const res = await fetch(`/.netlify/functions/geo-search?type=cities&q=${encodeURIComponent(query)}&countries=${countriesParam}`);
      const data = await res.json();
      callback(data);
    } catch {
      callback([]);
    }
  }, 200);
}
