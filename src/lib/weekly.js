// Sunday weekly review: everything comes from data Guía already has.
import { dayKey, isScheduled, completeOn, stepsFor, streaks, colorOf } from "@/lib/routines";
import { isPaid, isRecurringBill, isYearlyBill, dueInfo } from "@/lib/financeHelpers";
import { quarterId } from "@/lib/quarters";

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const noon = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const shortDay = (d) => d.toLocaleDateString("en-US", { weekday: "short" });

// The week to review: Sunday through Saturday, ending today if it's Saturday, otherwise last Saturday.
export function reviewWeek(today = new Date()) {
  const t = noon(today);
  const end = addDays(t, -((t.getDay() + 1) % 7));
  const start = addDays(end, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const m1 = start.toLocaleDateString("en-US", { month: "short" });
  const m2 = end.toLocaleDateString("en-US", { month: "short" });
  const label = m1 === m2 ? `${m1} ${start.getDate()}–${end.getDate()}` : `${m1} ${start.getDate()} – ${m2} ${end.getDate()}`;
  return { key: dayKey(start), start, end, days, label, nextKey: dayKey(addDays(end, 1)) };
}

// The review card shows on Home on Sundays and Mondays until it's done.
export const isReviewDay = (d = new Date()) => d.getDay() === 0 || d.getDay() === 1;

// This week's picks apply from the Sunday after the reviewed week through the next Saturday.
export function activeFocus(prefs, today = new Date()) {
  const f = prefs?.week_focus;
  if (!f?.week || !Array.isArray(f.items) || !f.items.length) return null;
  const k = dayKey(today);
  const end = dayKey(addDays(new Date(`${f.week}T12:00:00`), 6));
  return k >= f.week && k <= end ? f : null;
}

const doneDay = (t) => (t.completed ? String(t.completed_at || t.updated_date || "").slice(0, 10) : "");
const localDay = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? String(iso).slice(0, 10) : dayKey(d); };

// When does a bill fall due inside [from, to]? Returns a date or null.
function billDueIn(b, from, to) {
  for (let d = noon(from); dayKey(d) <= dayKey(to); d = addDays(d, 1)) {
    if (isYearlyBill(b)) { if (b.due_date && String(b.due_date).slice(5) === dayKey(d).slice(5)) return d; }
    else if (isRecurringBill(b)) { if (b.due_day && Number(b.due_day) === d.getDate()) return d; }
    else if (b.due_date && String(b.due_date).slice(0, 10) === dayKey(d)) return d;
  }
  return null;
}

export function buildReview({ routines = [], tasks = [], goals = [], finItems = [], trips = [], spending = null }, week, today = new Date()) {
  const from = week.key, to = dayKey(week.end);
  const inWeek = (k) => k && k >= from && k <= to;

  // Routines: a row of 7 days per routine.
  const active = routines.filter((r) => (r.steps || []).length);
  let sched = 0, done = 0;
  const routineRows = active.map((r) => {
    const created = localDay(r.created_date);
    const days = week.days.map((d) => {
      const k = dayKey(d);
      if ((created && k < created) || !isScheduled(r, d) || !stepsFor(r, d).length) return "off";
      sched++;
      if (completeOn(r, k)) { done++; return "done"; }
      return "missed";
    });
    return { id: r.id, name: r.name || r.title || "Routine", color: colorOf(r), days };
  });
  const rate = sched ? Math.round((done / sched) * 100) : null;

  // Tasks finished this week.
  const finished = tasks.filter((t) => inWeek(localDay(t.completed_at) || doneDay(t)));
  const showUp = week.days.filter((d) => {
    const k = dayKey(d);
    return active.some((r) => completeOn(r, k)) || finished.some((t) => (localDay(t.completed_at) || doneDay(t)) === k);
  }).length;

  // Bills that were due this week.
  const bills = finItems.filter((i) => i.type === "bill");
  const dueThisWeek = bills.filter((b) => billDueIn(b, week.start, week.end));
  const paidThisWeek = dueThisWeek.filter(isPaid);

  // Streaks.
  const streakList = active.map((r) => { try { return { name: r.name || "Routine", n: streaks(r, week.end).current }; } catch { return { name: r.name, n: 0 }; } }).sort((a, b) => b.n - a.n);
  const best = streakList[0] && streakList[0].n >= 3 ? streakList[0] : null;

  // Wins.
  const wins = [];
  goals.filter((g) => g.status === "done" && inWeek(localDay(g.updated_date))).forEach((g) => wins.push(`Reached your goal: ${g.title}`));
  [...finished].sort((a, b) => (b.source === "credit") - (a.source === "credit")).slice(0, 3).forEach((t) => wins.push(t.title));
  if (dueThisWeek.length && paidThisWeek.length === dueThisWeek.length) wins.push(`Paid ${dueThisWeek.length === 1 ? "your bill" : `all ${dueThisWeek.length} bills`} due this week`);
  if (best) wins.push(`${best.name} is on a ${best.n}-day streak`);

  // Money.
  const moneyCard = (spending && (spending.spent || spending.planned)) || dueThisWeek.length
    ? {
      spent: spending?.spent || 0, planned: spending?.planned || 0,
      billsLine: dueThisWeek.length ? `${paidThisWeek.length} of ${dueThisWeek.length} bill${dueThisWeek.length === 1 ? "" : "s"} due this week ${paidThisWeek.length === 1 && dueThisWeek.length === 1 ? "is" : "are"} paid` : "",
      unpaid: dueThisWeek.filter((b) => !isPaid(b)).map((b) => b.name),
    }
    : null;

  // Coming up: the next 7 days.
  const now = noon(today), horizon = dayKey(addDays(now, 7)), tk = dayKey(now);
  const open = tasks.filter((t) => !t.completed);
  const overdue = open.filter((t) => t.due_date && String(t.due_date).slice(0, 10) < tk);
  const soon = open.filter((t) => t.due_date && String(t.due_date).slice(0, 10) >= tk && String(t.due_date).slice(0, 10) <= horizon)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const billsSoon = bills.map((b) => ({ b, info: dueInfo(b) })).filter(({ info }) => info.tone !== "paid" && info.days != null && info.days >= 0 && info.days <= 7)
    .sort((a, b) => a.info.days - b.info.days);
  const tripsSoon = trips.filter((t) => t.start_date).map((t) => ({ t, days: Math.round((noon(new Date(`${String(t.start_date).slice(0, 10)}T12:00:00`)) - now) / 86400000) }))
    .filter((x) => x.days >= 0 && x.days <= 60).sort((a, b) => a.days - b.days);
  const comingUp = [];
  if (overdue.length) comingUp.push({ icon: "alert", text: `${overdue.length} overdue to-do${overdue.length === 1 ? "" : "s"}`, side: "" });
  billsSoon.slice(0, 2).forEach(({ b, info }) => comingUp.push({ icon: "bill", text: `${b.name} · ${shortDay(info.date)}`, side: b.amount ? money(b.amount) : "" }));
  soon.slice(0, 3).forEach((t) => comingUp.push({ icon: "task", text: `${t.title} · ${shortDay(new Date(`${String(t.due_date).slice(0, 10)}T12:00:00`))}`, side: "" }));
  tripsSoon.slice(0, 1).forEach(({ t, days }) => comingUp.push({ icon: "trip", text: t.title || "Trip", side: days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} away` }));

  // Suggestions for next week's 3.
  const sug = [];
  const push = (s) => { if (s.text && !sug.some((x) => x.text.toLowerCase() === s.text.toLowerCase())) sug.push(s); };
  overdue.slice(0, 2).forEach((t) => push({ text: t.title, kind: "task", refId: t.id }));
  soon.slice(0, 2).forEach((t) => push({ text: t.title, kind: "task", refId: t.id }));
  billsSoon.slice(0, 1).forEach(({ b }) => push({ text: `Pay ${b.name}`, kind: "bill", refId: b.id }));
  routineRows.filter((r) => { const s = r.days.filter((x) => x !== "off").length; const d = r.days.filter((x) => x === "done").length; return s >= 2 && d / s < 0.6; })
    .slice(0, 1).forEach((r) => push({ text: `Get ${r.name} back on track`, kind: "routine", refId: r.id }));
  // This quarter's focus goals come first, so each week builds toward them.
  const qNow = quarterId(today);
  goals.filter((g) => g.status !== "done").sort((a, b) => (b.focus_quarter === qNow) - (a.focus_quarter === qNow) || String(a.target_date || "9999").localeCompare(String(b.target_date || "9999")))
    .slice(0, 2).forEach((g) => {
      const next = (g.sub_tasks || []).find((s) => !s.completed);
      push({ text: next ? `${next.text} (${g.title})` : `Take a step on ${g.title}`, kind: "goal", refId: g.id });
    });
  tripsSoon.slice(0, 1).forEach(({ t }) => push({ text: `Plan ${t.title || "your trip"}`, kind: "trip", refId: t.id }));

  // Headline.
  let headline = "A fresh week ahead";
  if (rate != null && rate >= 80) headline = "A strong week";
  else if (finished.length >= 8) headline = "A busy week";
  else if (rate != null && rate >= 50) headline = "A steady week";
  else if (showUp >= 3) headline = "A good start";
  const sub = active.length || finished.length
    ? `You showed up ${showUp} of 7 days.`
    : "Nothing logged last week. Pick a few things to start this one.";

  return { headline, sub, rate, tasksDone: finished.length, routineRows, best, wins: wins.slice(0, 4), money: moneyCard, comingUp: comingUp.slice(0, 5), suggestions: sug.slice(0, 6) };
}
