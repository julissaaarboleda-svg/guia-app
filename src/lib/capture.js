// Quick capture: turn one line of text into a to-do, note, goal or bill.
// Simple keyword rules, so it's instant and free. The person can always tap a different type.
import { dayKey } from "@/lib/routines";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_RE = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs)";
const DAY_SHORT_RE = "(sun|mon|tue|wed|thu|fri|sat)";
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthIndex = (s) => MONTH_NAMES.findIndex((m) => m.startsWith(s.toLowerCase().slice(0, 3)));
const dayIndex = (s) => DAY_NAMES.findIndex((d) => d.startsWith(s.toLowerCase().slice(0, 3)));

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const noon = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const lastOfMonth = (y, m) => new Date(y, m + 1, 0, 12);

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

// A due date from phrases like "today", "tomorrow", "Tuesday", "next Fri", "Nov 20", "11/20", "on the 15th", "in 3 days".
export function parseDate(text, now = new Date()) {
  const today = noon(now);
  const tries = [
    [/\b(?:by |on )?(today|tonight)\b/i, () => today],
    [/\b(?:by |on )?tomorrow\b/i, () => addDays(today, 1)],
    [/\bin (\d{1,2}) days?\b/i, (m) => addDays(today, Number(m[1]))],
    [/\b(?:by )?next week\b/i, () => addDays(today, ((8 - today.getDay()) % 7) || 7)],
    [new RegExp(`\\b(?:by |on )?${MONTH_RE}\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"), (m) => {
      const mi = monthIndex(m[1]); const d = Number(m[2]);
      if (mi < 0 || d < 1 || d > 31) return null;
      let x = new Date(today.getFullYear(), mi, d, 12);
      if (x < addDays(today, -1)) x = new Date(today.getFullYear() + 1, mi, d, 12);
      return x;
    }],
    [/\b(?:by |on )?(\d{1,2})\/(\d{1,2})\b/, (m) => {
      const mi = Number(m[1]) - 1; const d = Number(m[2]);
      if (mi < 0 || mi > 11 || d < 1 || d > 31) return null;
      let x = new Date(today.getFullYear(), mi, d, 12);
      if (x < addDays(today, -1)) x = new Date(today.getFullYear() + 1, mi, d, 12);
      return x;
    }],
    [/\b(?:by |on )?the (\d{1,2})(?:st|nd|rd|th)\b/i, (m) => {
      const d = Number(m[1]);
      if (d < 1 || d > 31) return null;
      let x = new Date(today.getFullYear(), today.getMonth(), d, 12);
      if (x < today) x = new Date(today.getFullYear(), today.getMonth() + 1, d, 12);
      return x;
    }],
    [new RegExp(`\\b(?:by |on |this |(next) )?${DAY_RE}\\b`, "i"), (m) => {
      const want = dayIndex(m[2]);
      if (want < 0) return null;
      let diff = (want - today.getDay() + 7) % 7;
      if (m[1] && diff === 0) diff = 7;
      return addDays(today, diff);
    }],
    [new RegExp(`\\b(?:by |on |this |(next) )${DAY_SHORT_RE}\\b\\.?`, "i"), (m) => {
      const want = dayIndex(m[2]);
      if (want < 0) return null;
      let diff = (want - today.getDay() + 7) % 7;
      if (m[1] && diff === 0) diff = 7;
      return addDays(today, diff);
    }],
  ];
  for (const [re, fn] of tries) {
    const m = text.match(re);
    if (m) { const d = fn(m); if (d) return { date: dayKey(d), match: m[0] }; }
  }
  return null;
}

// A goal's target from "by March", "by end of June", "this year", "by next year".
export function parseTarget(text, now = new Date()) {
  const m = text.match(new RegExp(`\\bby (?:the )?(?:end of )?${MONTH_RE}\\b`, "i"));
  if (m) {
    const mi = monthIndex(m[1]);
    let y = now.getFullYear();
    if (mi < now.getMonth()) y += 1;
    return { date: dayKey(lastOfMonth(y, mi)), match: m[0] };
  }
  const y = text.match(/\b(?:by )?(?:the )?(?:end of )?(this|next) year\b/i);
  if (y) return { date: `${now.getFullYear() + (y[1].toLowerCase() === "next" ? 1 : 0)}-12-31`, match: y[0] };
  return null;
}

export const moneyOf = (text) => {
  const m = text.match(MONEY);
  return m ? { amount: Number(m[1].replace(/,/g, "")), match: m[0] } : null;
};

export function guessType(text) {
  const t = text.trim().toLowerCase();
  if (!t) return "task";
  if (moneyOf(t) && /\b(bill|due|pay|rent|insurance|subscription|payment|invoice|renews?|premium|utilities|phone|internet)\b/.test(t)) return "bill";
  if (/^(i want to|i'd like to|i would like to|goal:?|my goal)\b/.test(t) || parseTarget(t) || /\b(save|lose|run|learn|read) .*\bby\b/.test(t)) return "goal";
  if (/^(idea|ideas|note|remember|thought|recipe|quote|journal)\b/.test(t) || /\bidea for\b/.test(t)) return "note";
  if (t.length > 90 && !parseDate(t)) return "note";
  return "task";
}

const tidy = (s) => {
  const x = s.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/[\s,;:-]+$/g, "").replace(/\b(on|by|for|due)$/i, "").trim();
  return x ? x[0].toUpperCase() + x.slice(1) : "";
};
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Pages that show the + in the header: only where the page has no add button of its own,
// so there's never two + buttons on one screen.
export const CAPTURE_PAGES = ["/", "/recap", "/review"];

export const TYPE_INFO = {
  task: { label: "To-do", where: "Goals › To-dos", path: "/goals" },
  note: { label: "Note", where: "Notes", path: "/notes" },
  goal: { label: "Goal", where: "Goals", path: "/goals" },
  bill: { label: "Bill", where: "Finance › Bills", path: "/finance" },
};

// What would be saved for this text as this type: { entity, data, hint }.
export function draftFor(text, type, now = new Date()) {
  const raw = text.trim();
  const nice = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (type === "note") {
    const line = raw.split("\n")[0];
    const first = (line.match(/^.*?[.!?](?=\s|$)/) || [line])[0].replace(/^(idea|note|thought|remember)\s*[:-]\s*/i, "");
    const title = tidy(first.length > 60 ? `${first.slice(0, 57).trim()}…` : first).replace(/\.$/, "");
    const content = raw.split(/\n+/).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    return { entity: "Note", data: { title, content, note_type: "text", folder_id: null }, hint: TYPE_INFO.note.where };
  }
  if (type === "goal") {
    const tg = parseTarget(raw, now);
    let title = raw.replace(/^(i want to|i'd like to|i would like to|my goal is to|goal:?)\s*/i, "");
    if (tg) title = title.replace(tg.match, "");
    title = tidy(title);
    return { entity: "Goal", data: { title, category: "personal", status: "in_progress", target_date: tg?.date, sub_tasks: [] }, hint: `${TYPE_INFO.goal.where}${tg ? ` · by ${new Date(`${tg.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}` };
  }
  const dt = parseDate(raw, now);
  if (type === "bill") {
    const mo = moneyOf(raw);
    let name = raw;
    if (mo) name = name.replace(mo.match, "");
    if (dt) name = name.replace(dt.match, "");
    name = tidy(name.replace(/^pay(?: the| my)?\s+/i, ""));
    const amt = mo ? `$${mo.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "add an amount later";
    return {
      entity: "FinanceItem",
      data: { type: "bill", name, amount: mo ? mo.amount : null, due_date: dt?.date || null, paid: false, billing_cycle: "one_time", is_fixed: false, category: "" },
      hint: `${TYPE_INFO.bill.where} · ${amt}${dt ? ` · due ${nice(dt.date)}` : ""}`,
    };
  }
  let title = raw.split("\n")[0];
  if (dt) title = title.replace(dt.match, "");
  title = tidy(title);
  return {
    entity: "Task",
    data: { title, notes: raw.includes("\n") ? raw.split("\n").slice(1).join("\n").trim() : "", priority: "normal", due_date: dt?.date || null, completed: false, source: "capture" },
    hint: `${TYPE_INFO.task.where}${dt ? ` · ${nice(dt.date)}` : ""}`,
  };
}
