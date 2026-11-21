// Daily welcome: weather, "your day" and a thought, shown each time the app is opened fresh.
import { dayKey, isScheduled, completeOn, stepsFor, streaks } from "@/lib/routines";
import { dueInfo, isPaid } from "@/lib/financeHelpers";
import { todayPriorities } from "@/lib/homeData";

export const SEEN_KEY = "guia-welcome-session";
export const CHIMES_KEY = "guia-welcome-chimes";

export const partOfDay = (d = new Date()) => (d.getHours() < 12 ? "morning" : d.getHours() < 17 ? "afternoon" : "evening");

// Weather by Open-Meteo (free while Guía is in beta; needs their paid licence once Plus is sold).
const WX = [
  [[0], "Clear", "sun"], [[1], "Mostly sunny", "sunCloud"], [[2], "Partly cloudy", "sunCloud"], [[3], "Cloudy", "cloud"],
  [[45, 48], "Foggy", "fog"], [[51, 53, 55, 56, 57], "Drizzle", "drizzle"], [[61, 63, 65, 66, 67], "Rain", "rain"],
  [[71, 73, 75, 77, 85, 86], "Snow", "snow"], [[80, 81, 82], "Showers", "rain"], [[95, 96, 99], "Thunderstorms", "storm"],
];
export const describeWx = (code) => { const m = WX.find(([cs]) => cs.includes(Number(code))); return m ? { label: m[1], icon: m[2] } : { label: "", icon: "cloud" }; };

export async function findPlaces(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  if (!r.ok) throw new Error("search failed");
  const j = await r.json();
  return (j.results || []).map((p) => ({ name: p.name, region: [p.admin1, p.country_code === "US" ? "" : p.country].filter(Boolean).join(", "), lat: p.latitude, lon: p.longitude, us: p.country_code === "US" }));
}

export async function getWeather(place) {
  if (!place || place.lat == null) return null;
  const cacheKey = `guia-wx-${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  try { const c = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); if (c && Date.now() - c.at < 3600000) return c.data; } catch { /* ignore */ }
  const f = place.us !== false; // Fahrenheit for US places
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&hourly=precipitation_probability&forecast_days=1&timezone=auto${f ? "&temperature_unit=fahrenheit" : ""}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather failed");
  const j = await r.json();
  const data = {
    temp: Math.round(j.current?.temperature_2m),
    code: j.current?.weather_code,
    isDay: j.current?.is_day !== 0,
    hi: Math.round(j.daily?.temperature_2m_max?.[0]),
    lo: Math.round(j.daily?.temperature_2m_min?.[0]),
    rain: j.daily?.precipitation_probability_max?.[0] ?? null,
    // First hour from now with a 50%+ chance of rain, e.g. 15 for 3 PM.
    rainFrom: (() => {
      const times = j.hourly?.time || [], probs = j.hourly?.precipitation_probability || [];
      const nowH = new Date().getHours();
      for (let i = 0; i < times.length; i++) { const h = Number(String(times[i]).slice(11, 13)); if (h >= nowH && probs[i] >= 50) return h; }
      return null;
    })(),
    unit: f ? "F" : "C",
  };
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data })); } catch { /* ignore */ }
  return data;
}

// "68° and sunny", "58° and rainy", "62° with storms".
export const hourLabel = (h) => (h === 0 ? "midnight" : h === 12 ? "noon" : `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`);

export function weatherPhrase(wx, w, night = false) {
  const L = { Clear: night ? "and clear" : "and sunny", "Mostly sunny": night ? "and mostly clear" : "and mostly sunny", "Partly cloudy": "and partly cloudy", Cloudy: "and cloudy", Foggy: "and foggy", Drizzle: "and drizzly", Rain: "and rainy", Snow: "and snowy", Showers: "with showers", Thunderstorms: "with storms" }[w?.label] || "";
  return `${wx.temp}°${L ? ` ${L}` : ""}`;
}

// One short, useful tip for the day's weather, or nothing.
export function weatherTip(wx, kind) {
  if (!wx) return "";
  const hour = (h) => (h === 0 ? "midnight" : h === 12 ? "noon" : `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`);
  const f = wx.unit === "F";
  if (kind === "storm") return "Storms today. Plan to stay in if you can.";
  if (kind === "snow") return "Bundle up. Roads may be slick.";
  if (wx.rainFrom != null && wx.rainFrom > new Date().getHours()) return `Rain likely after ${hour(wx.rainFrom)}. Bring an umbrella.`;
  if (kind === "rain" || kind === "drizzle" || (wx.rain != null && wx.rain >= 60)) return "Rain likely today. Bring an umbrella.";
  if (wx.hi >= (f ? 95 : 35)) return "A hot one today. Stay hydrated.";
  if (wx.lo <= (f ? 40 : 4)) return "Chilly start. Grab a jacket.";
  return "";
}

const fmtTime = (t) => { const [h, m] = String(t).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const SLOT_ORDER = { morning: 0, anytime: 1, evening: 2 };

// Up to three short lines, all about today, skipping anything that doesn't apply.
export function dayLines({ tasks = [], routines = [], finItems = [], trips = [], goals = [] }, now = new Date()) {
  const lines = [];
  const tk = dayKey(now);

  // Travel day comes first, and only on the day itself.
  const leaving = trips.find((t) => t.start_date && String(t.start_date).slice(0, 10) === tk);
  if (leaving) lines.push({ icon: "trip", tone: "olive", parts: [{ b: leaving.title || "Your trip" }, " starts today"] });

  const dueNow = todayPriorities(tasks, now, goals);
  if (dueNow.length) lines.push({ icon: "target", tone: "cognac", parts: [dueNow.length === 1 ? "1 priority: " : `${dueNow.length} priorities, starting with `, { b: dueNow[0].title }] });

  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todays = routines.filter((r) => (r.steps || []).length && isScheduled(r, now) && stepsFor(r, now).length && !completeOn(r, tk))
    .sort((a, b) => (SLOT_ORDER[a.slot] ?? 1) - (SLOT_ORDER[b.slot] ?? 1) || String(a.remind_at || "99").localeCompare(String(b.remind_at || "99")));
  const nextR = todays.find((r) => r.remind_at && r.remind_at >= hhmm) || todays[0];
  if (nextR) {
    let streak = 0;
    try { streak = streaks(nextR).current || 0; } catch { /* ignore */ }
    const when = nextR.remind_at ? ` at ${fmtTime(nextR.remind_at)}` : nextR.slot === "evening" ? " this evening" : nextR.slot === "morning" ? " this morning" : " today";
    const parts = [`${nextR.name || "Routine"}${when}`];
    if (streak >= 2) parts.push(" · keep your ", { b: `${streak}-day streak` });
    else if (todays.length > 1) parts.push(` · ${todays.length} routines today`);
    lines.push({ icon: "flame", tone: "cognac", parts });
  }

  // Bills only when due today or already overdue.
  const bill = finItems.filter((i) => i.type === "bill" && !isPaid(i)).map((b) => ({ b, info: dueInfo(b) }))
    .filter(({ info }) => info.days != null && info.days >= -14 && info.days <= 0 && info.tone !== "paid")
    .sort((a, b) => a.info.days - b.info.days)[0];
  if (bill) {
    const when = bill.info.days < 0 ? "overdue" : "due today";
    lines.push({ icon: "bill", tone: "mauve", parts: [`${bill.b.name} ${when}${bill.b.amount ? ` · $${Math.round(bill.b.amount).toLocaleString("en-US")}` : ""}`] });
  }

  return lines.slice(0, 3);
}

const THOUGHTS = [
  "Small steps, taken daily, become the life you wanted.",
  "You don't have to do it all today. Just the next right thing.",
  "Progress counts, even when it's quiet.",
  "Rest is part of the plan, not a break from it.",
  "Be as patient with yourself as you are with the people you love.",
  "Clarity comes from doing, not from waiting.",
  "One finished thing beats five started ones.",
  "Your pace is still a pace.",
  "Today is a good day to keep a promise to yourself.",
  "The calm you're looking for starts with one slow breath.",
  "Choose the thing future you will thank you for.",
  "Done gently is still done.",
  "You've handled hard days before. You'll handle this one.",
  "Make room for what matters, and let the rest wait.",
  "A little order on the outside makes room on the inside.",
  "Show up imperfectly. It still counts.",
  "What you water grows.",
  "Small savings, steady habits, big freedom.",
  "You get to decide what today is for.",
  "Begin where you are, with what you have.",
  "Every streak started with day one.",
  "Slow is smooth, and smooth is fast.",
  "Celebrate the quiet wins too.",
  "Less, but better.",
  "Trust the routine on the days motivation is low.",
  "Your future is built in ordinary moments.",
  "Leave a little space in the day for joy.",
  "Focus on the next hour, not the whole week.",
  "Kindness to yourself is productive.",
  "Freedom is built one clear choice at a time.",
  "Breathe. Then begin.",
];
export const thoughtFor = (d = new Date()) => {
  const start = new Date(d.getFullYear(), 0, 0);
  const n = Math.floor((d - start) / 86400000);
  return THOUGHTS[n % THOUGHTS.length];
};

// ---- "Use my location" ----
// Only a rough spot is kept: coordinates rounded to 2 decimals (about half a
// mile to a mile), plus the city name. Never a precise address.
const round2 = (n) => Math.round(n * 100) / 100;

function position(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout, maximumAge: 30 * 60 * 1000 });
  });
}

async function cityFor(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!r.ok) throw new Error("lookup failed");
    const j = await r.json();
    const us = j.countryCode === "US";
    return { name: j.city || j.locality || "Your location", region: us ? (j.principalSubdivision || "") : (j.countryName || ""), us };
  } catch { return { name: "Your location", region: "", us: true }; }
}

// Asks the phone for its location (shows the permission prompt the first
// time). Call only from a tap. Resolves to a place, or throws.
export async function locatePlace() {
  const p = await position();
  const lat = round2(p.coords.latitude), lon = round2(p.coords.longitude);
  return { ...(await cityFor(lat, lon)), lat, lon, auto: true };
}

// True only when permission was already given, so we never pop a prompt
// on our own. Browsers that can't tell us return false.
export async function locationAllowed() {
  try {
    if (!navigator.permissions?.query) return false;
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state === "granted";
  } catch { return false; }
}

// On app start: if "Use my location" is on and allowed, update the place when
// the person has moved (more than ~3 miles). Returns the new place or null.
export async function refreshAutoPlace(current) {
  if (!(await locationAllowed())) return null;
  const p = await position(8000);
  const lat = round2(p.coords.latitude), lon = round2(p.coords.longitude);
  if (current && Math.abs(current.lat - lat) < 0.05 && Math.abs(current.lon - lon) < 0.05) return null;
  return { ...(await cityFor(lat, lon)), lat, lon, auto: true };
}
