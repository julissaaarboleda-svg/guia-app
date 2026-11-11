// Routines: repeatable step lists (skincare, workouts, anything). One flexible shape:
// { name, color, slot: "morning"|"evening"|"anytime", days: null (every day) | [0-6, Sun=0],
//   steps: [{ id, text, note }], log: { "YYYY-MM-DD": [stepId, ...] }, best_streak }
export const ROUTINE_COLORS = [
  { key: "cognac", label: "Cognac", hex: "#A7773F" },
  { key: "olive", label: "Olive", hex: "#7D8A53" },
  { key: "mauve", label: "Dusty mauve", hex: "#A77C81" },
  { key: "charcoal", label: "Charcoal", hex: "#2E2A27" },
];
export const colorOf = (r) => (ROUTINE_COLORS.find((c) => c.key === r?.color) || ROUTINE_COLORS[0]).hex;
export const SLOTS = [["morning", "Morning"], ["evening", "Evening"], ["anytime", "Anytime"]];
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const isScheduled = (r, d = new Date()) => !r.days || r.days.length === 0 || r.days.includes(d.getDay());
export const doneOn = (r, key) => {
  const ids = new Set(r.log?.[key] || []);
  return (r.steps || []).filter((s) => ids.has(s.id)).length;
};
export const completeOn = (r, key) => (r.steps || []).length > 0 && doneOn(r, key) >= r.steps.length;

export const scheduleLabel = (r) => {
  if (!r.days || r.days.length === 0 || r.days.length === 7) return "Every day";
  return [...r.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_SHORT[d]).join(" · ");
};

// Current streak: completed scheduled days in a row. Today only counts once finished, and an
// unfinished today doesn't break it yet. Any earlier missed scheduled day restarts it at 0.
export function streaks(r, today = new Date()) {
  let current = 0;
  let d = new Date(today);
  if (isScheduled(r, d) && !completeOn(r, dayKey(d))) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (isScheduled(r, d)) {
      if (completeOn(r, dayKey(d))) current++;
      else break;
    }
    d = addDays(d, -1);
  }
  // Longest: scan from the first logged day to today.
  const keys = Object.keys(r.log || {}).sort();
  let longest = current, run = 0;
  if (keys.length) {
    let x = new Date(`${keys[0]}T12:00:00`);
    while (dayKey(x) <= dayKey(today)) {
      if (isScheduled(r, x)) {
        if (completeOn(r, dayKey(x))) { run++; longest = Math.max(longest, run); }
        else if (dayKey(x) !== dayKey(today)) run = 0;
      }
      x = addDays(x, 1);
    }
  }
  return { current, longest: Math.max(longest, Number(r.best_streak) || 0) };
}

// Share of scheduled days completed, from `from` through today (today counts only if finished).
export function completionRate(r, from, today = new Date()) {
  let sched = 0, done = 0;
  for (let x = new Date(from); dayKey(x) <= dayKey(today); x = addDays(x, 1)) {
    if (!isScheduled(r, x)) continue;
    const k = dayKey(x);
    const fin = completeOn(r, k);
    if (k === dayKey(today) && !fin) continue;
    sched++; if (fin) done++;
  }
  return { sched, done, pct: sched ? Math.round((done / sched) * 100) : 0 };
}

export const weekStart = (d = new Date()) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const weekDays = (d = new Date()) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));

// Toggle a step for a day and return the updated log (trimmed to roughly 13 months).
export function toggleStep(r, stepId, key = dayKey()) {
  const log = { ...(r.log || {}) };
  const ids = new Set(log[key] || []);
  ids.has(stepId) ? ids.delete(stepId) : ids.add(stepId);
  log[key] = [...ids];
  const cutoff = dayKey(addDays(new Date(), -400));
  Object.keys(log).forEach((k) => { if (k < cutoff || log[k].length === 0) delete log[k]; });
  return log;
}

// Week summary across routines, for the Life Progress ring.
export function weekSummary(routines, today = new Date()) {
  let sched = 0, done = 0;
  routines.forEach((r) => { const c = completionRate(r, weekStart(today), today); sched += c.sched; done += c.done; });
  return { sched, done };
}

// Mark every step done for today, or clear today if done is false.
export function setAllToday(r, done, key = dayKey()) {
  const log = { ...(r.log || {}) };
  if (done) log[key] = (r.steps || []).map((st) => st.id); else delete log[key];
  return log;
}
