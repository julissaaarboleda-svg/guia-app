// PLACEHOLDER — the real src/lib/cityData.js was never sent as source, so this
// is a minimal working stand-in, not a faithful port. It has enough countries/cities
// to test the New Journey flow, but you'll likely want a real dataset (or a proper
// geo package) here eventually.

const COUNTRIES = [
  "United States", "Brazil", "Colombia", "Mexico", "Portugal", "Spain", "France",
  "Italy", "United Kingdom", "Japan", "Thailand", "Peru", "Argentina", "Canada",
  "Germany", "Netherlands", "Greece", "Costa Rica", "Morocco", "Vietnam",
];

const CITIES_BY_COUNTRY = {
  "United States": ["Houston", "New York", "Los Angeles", "Miami", "Chicago", "Austin"],
  "Brazil": ["São Paulo", "Rio de Janeiro", "Uberlândia", "Salvador", "Brasília"],
  "Colombia": ["Bogotá", "Medellín", "Cartagena", "Cali"],
  "Mexico": ["Mexico City", "Cancún", "Guadalajara", "Oaxaca"],
  "Portugal": ["Lisbon", "Porto", "Faro"],
  "Spain": ["Madrid", "Barcelona", "Seville", "Valencia"],
  "France": ["Paris", "Nice", "Lyon", "Marseille"],
  "Italy": ["Rome", "Florence", "Venice", "Milan"],
  "United Kingdom": ["London", "Edinburgh", "Manchester"],
  "Japan": ["Tokyo", "Kyoto", "Osaka"],
};

export function searchCountries(query) {
  const q = query.toLowerCase();
  return COUNTRIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
}

export function searchCities(query, selectedCountries = []) {
  const q = query.toLowerCase();
  const pool = selectedCountries.length
    ? selectedCountries.flatMap((c) => CITIES_BY_COUNTRY[c] || [])
    : Object.values(CITIES_BY_COUNTRY).flat();
  return [...new Set(pool)].filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
}
