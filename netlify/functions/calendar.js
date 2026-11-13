// netlify/functions/calendar.js
//
// Calendar sync. Two jobs:
//   GET  /cal/<token>.ics   (no login) -> an iCalendar feed of this person's bills, loan
//        payments, trips, tasks and goal dates. Apple and Google Calendar subscribe to it.
//   POST /.netlify/functions/calendar  (logged in) -> { action: "get" | "save" | "reset", include }
//        manages the private link and which kinds of dates it includes.
// The token is random and long; anyone with the link can read these dates, so it can be reset.
const { getStore, connectLambda } = require("@netlify/blobs");
const { randomBytes } = require("node:crypto");

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
const DEFAULT_INCLUDE = { bills: true, trips: true, tasks: true, goals: false, routines: true };

const newToken = () => randomBytes(18).toString("base64url");
const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

async function readAll(store, userId, entity) {
  const { blobs } = await store.list({ prefix: `${userId}/${entity}/` });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
}

// --- iCalendar helpers ---
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d) => String(d).slice(0, 10).replace(/-/g, "");
const nextDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };
// alarm: a 9am heads-up on the day (shows as a phone notification from the calendar app)
const ALARM = ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:PT9H", "END:VALARM"];
function allDay(uid, title, start, endExclusive, { rrule, desc, alarm } = {}) {
  return [
    "BEGIN:VEVENT", `UID:${uid}@guia`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(endExclusive || nextDay(start))}`,
    `SUMMARY:${esc(title)}`, ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []), ...(rrule ? [`RRULE:${rrule}`] : []),
    "TRANSP:TRANSPARENT", ...(alarm ? ALARM : []), "END:VEVENT",
  ].map(fold).join("\r\n");
}
// Routine reminder: a short repeating event at the person's own local time ("floating" time,
// so 7:00 stays 7:00 wherever their phone is), with an alert when it starts.
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function routineEvent(r, tz) {
  const m = String(r.remind_at || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const start = String(r.created_date || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  const hhmm = `${m[1].padStart(2, "0")}${m[2]}00`;
  const days = Array.isArray(r.days) && r.days.length && r.days.length < 7 ? r.days : null;
  const rrule = days ? `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}` : "FREQ=DAILY";
  const steps = (r.steps || []).map((st) => `• ${st.text}`).join("\n");
  return [
    "BEGIN:VEVENT", `UID:routine-${r.id}@guia`, `DTSTAMP:${stamp}`,
    tz ? `DTSTART;TZID=${tz}:${start}T${hhmm}` : `DTSTART:${start}T${hhmm}`, "DURATION:PT15M", `RRULE:${rrule}`,
    `SUMMARY:${esc(`${r.name || "Routine"}`)}`, ...(steps ? [`DESCRIPTION:${esc(steps)}`] : []),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Time for ${r.name || "your routine"}`)}`, "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT",
  ].map(fold).join("\r\n");
}
const money = (n) => (Number(n) > 0 ? ` · $${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "");

function billEvents(b) {
  if (b.canceled_on) return [];
  const name = `${b.name || "Bill"} due${money(b.amount)}`;
  const cycle = b.billing_cycle;
  const now = new Date();
  if (cycle === "yearly" && b.due_date) {
    return [allDay(`bill-${b.id}`, name, b.due_date, null, { rrule: "FREQ=YEARLY" })];
  }
  if ((cycle === "monthly" || cycle === "quarterly") && b.due_day) {
    const day = Number(b.due_day);
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, 28)).padStart(2, "0")}`;
    const by = day > 28 ? "BYMONTHDAY=-1" : `BYMONTHDAY=${day}`;
    return [allDay(`bill-${b.id}`, name, start, null, { rrule: `FREQ=MONTHLY;INTERVAL=${cycle === "quarterly" ? 3 : 1};${by}` })];
  }
  if (b.due_date && !b.paid) return [allDay(`bill-${b.id}`, name, b.due_date)];
  return [];
}
function loanEvents(l) {
  const sched = Array.isArray(l.schedule) ? l.schedule : [];
  if (sched.length) {
    return sched.filter((p) => p && p.date && !p.paid)
      .map((p, i) => allDay(`loan-${l.id}-${p.date}-${i}`, `${l.name || "Loan"} payment${money(p.amount || l.monthly_payment)}`, p.date));
  }
  if (l.due_date && !l.paid) return [allDay(`loan-${l.id}`, `${l.name || "Loan"} payment${money(l.monthly_payment)}`, l.due_date)];
  return [];
}

async function feed(token) {
  const tokens = getStore("cal-tokens");
  const rec = await tokens.get(token, { type: "json" });
  if (!rec || !rec.userId) return null;
  const inc = { ...DEFAULT_INCLUDE, ...(rec.include || {}) };
  const data = getStore("guia-data");
  const events = [];
  if (inc.bills) {
    const fin = await readAll(data, rec.userId, "FinanceItem");
    fin.filter((i) => i.type === "bill").forEach((b) => events.push(...billEvents(b)));
    fin.filter((i) => i.type === "loan").forEach((l) => events.push(...loanEvents(l)));
  }
  if (inc.trips) {
    (await readAll(data, rec.userId, "Trip")).filter((t) => t.start_date).forEach((t) => {
      events.push(allDay(`trip-${t.id}`, `✈ ${t.title || t.destination || "Trip"}`, t.start_date, nextDay(t.end_date || t.start_date), { desc: t.destination || "" }));
    });
  }
  if (inc.tasks) {
    (await readAll(data, rec.userId, "Task")).filter((t) => t.due_date && !t.completed).forEach((t) => {
      events.push(allDay(`task-${t.id}`, t.title || "Task", t.due_date, null, { desc: t.notes || "", alarm: t.source === "credit" }));
    });
  }
  if (inc.routines) {
    (await readAll(data, rec.userId, "Routine")).forEach((r) => { const e = routineEvent(r, rec.tz); if (e) events.push(e); });
  }
  if (inc.goals) {
    (await readAll(data, rec.userId, "Goal")).filter((g) => g.target_date && g.status !== "completed").forEach((g) => {
      events.push(allDay(`goal-${g.id}`, `Goal: ${g.title || ""}`, g.target_date));
    });
  }
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Guia//Calendar sync//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Guía", ...(rec.tz ? [`X-WR-TIMEZONE:${rec.tz}`] : []), "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...events, "END:VCALENDAR",
  ].join("\r\n");
}

exports.handler = async (event, context) => {
  connectLambda(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  if (event.httpMethod === "GET") {
    const m = String(event.path || "").match(/([A-Za-z0-9_-]{20,})(\.ics)?\/?$/);
    const token = (event.queryStringParameters && event.queryStringParameters.t) || (m && m[1]);
    if (!token) return { statusCode: 404, body: "Not found" };
    try {
      const body = await feed(token);
      if (!body) return { statusCode: 404, body: "This calendar link was reset or doesn't exist." };
      return { statusCode: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=900" }, body };
    } catch (err) {
      console.error("calendar feed failed:", err);
      return { statusCode: 500, body: "Couldn't build the calendar." };
    }
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: "Not authenticated" });
  const userId = user.sub || user.email;
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* empty */ }
  const users = getStore("cal-users");
  const tokens = getStore("cal-tokens");
  try {
    let me = (await users.get(userId, { type: "json" })) || null;
    if (body.action === "reset" && me && me.token) { await tokens.delete(me.token); me = null; }
    if (!me || !me.token) {
      me = { token: newToken(), include: (me && me.include) || DEFAULT_INCLUDE };
    }
    if (body.action === "save" && body.include && typeof body.include === "object") {
      me.include = Object.fromEntries(Object.keys(DEFAULT_INCLUDE).map((k) => [k, !!body.include[k]]));
    }
    if (typeof body.tz === "string" && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(body.tz)) me.tz = body.tz;
    await users.setJSON(userId, me);
    await tokens.setJSON(me.token, { userId, include: me.include, tz: me.tz || null });
    return json(200, { token: me.token, include: { ...DEFAULT_INCLUDE, ...me.include } });
  } catch (err) {
    console.error("calendar settings failed:", err);
    return json(500, { error: "Couldn't load calendar sync." });
  }
};
