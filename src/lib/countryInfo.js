// Real country facts via REST Countries — a free, public, no-API-key data
// source. Used to replace AI-guessed currency/transport info in Know Before
// You Go with actual data instead of a model's best guess.
export async function getCountryInfo(country) {
  if (!country) return null;
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=currencies,car`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const c = Array.isArray(data) ? data[0] : data;
    if (!c) return null;

    const currencyEntries = Object.entries(c.currencies || {});
    const currency = currencyEntries.length
      ? { code: currencyEntries[0][0], name: currencyEntries[0][1].name, symbol: currencyEntries[0][1].symbol }
      : null;
    const drivingSide = c.car?.side || null; // "left" or "right"

    return { currency, drivingSide };
  } catch {
    return null;
  }
}

// Builds the 4 Know Before You Go cards from real data where possible.
// Visa and Safety are the two categories where stating a specific rule with
// confidence carries real risk if it's wrong or out of date — no free,
// reliable live source exists for exact current requirements — so these
// link out to a live official search instead of asserting a fact.
export function buildKnowBeforeYouGo(country, countryInfo) {
  const currency = countryInfo?.currency
    ? {
        summary: `${countryInfo.currency.name}${countryInfo.currency.symbol ? ` (${countryInfo.currency.symbol})` : ""}`,
        detail: `The local currency is the ${countryInfo.currency.name} (${countryInfo.currency.code}). Card acceptance varies by country — it's worth carrying some local cash.`,
      }
    : { summary: "Currency info unavailable", detail: "" };

  const transportation = countryInfo?.drivingSide
    ? {
        summary: `Drives on the ${countryInfo.drivingSide}`,
        detail: `Vehicles drive on the ${countryInfo.drivingSide} side of the road here. Worth remembering when crossing streets or renting a car.`,
      }
    : { summary: "Transport info unavailable", detail: "" };

  const visa = {
    summary: "Tap to check current requirements",
    detail: "Visa requirements depend on your passport and trip length, and can change. Tap to see current official guidance.",
    searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${country} visa requirements for US citizens`)}`,
  };

  const safety = {
    summary: "Tap for current advisories",
    detail: "Safety conditions can change — tap to see the latest official travel advisory for this destination.",
    searchUrl: `https://www.google.com/search?q=${encodeURIComponent(`${country} travel advisory`)}`,
  };

  return { currency, transportation, visa, safety };
}
