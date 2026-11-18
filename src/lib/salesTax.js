// Texas sales tax, quarterly filers: returns are due the 20th of the month after each quarter
// (Apr 20, Jul 20, Oct 20, Jan 20). A weekend due date moves to the next Monday.
// Federal holidays can also move it; the Comptroller's site has the exact date each year.

const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const WEBFILE_URL = "https://comptroller.texas.gov/taxes/file-pay/";
export const WAIVER_URL = "https://comptroller.texas.gov/taxes/waivers/";

// A quarter like { id: "2026-Q3", year, q, label: "Jul–Sep", start, end, due }
export function quarter(year, q) {
  const start = new Date(year, (q - 1) * 3, 1, 12);
  const end = new Date(year, q * 3, 0, 12);
  let due = new Date(year, q * 3, 20, 12); // 20th of the month after the quarter
  if (due.getDay() === 6) due = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 2, 12);
  if (due.getDay() === 0) due = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1, 12);
  return { id: `${year}-Q${q}`, year, q, label: `${MON[(q - 1) * 3]}–${MON[q * 3 - 1]}`, longLabel: `${MON[(q - 1) * 3]}–${MON[q * 3 - 1]} ${year}`, start: keyOf(start), end: keyOf(end), due: keyOf(due) };
}
export const quarterOf = (d) => quarter(d.getFullYear(), Math.floor(d.getMonth() / 3) + 1);
export function shift(qtr, n) {
  let y = qtr.year, q = qtr.q + n;
  while (q > 4) { q -= 4; y += 1; }
  while (q < 1) { q += 4; y -= 1; }
  return quarter(y, q);
}
// The return you're working toward now: the most recent finished quarter whose due date hasn't passed,
// otherwise the current quarter.
export function nextReturn(today = new Date(), filedIds = new Set()) {
  const t = keyOf(today);
  let qtr = shift(quarterOf(today), -1);
  while (filedIds.has(qtr.id) || qtr.due < t) qtr = shift(qtr, 1);
  return qtr;
}
export const daysUntil = (iso, today = new Date()) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${keyOf(today)}T12:00:00`)) / 86400000);
export const niceDate = (iso, opts = { month: "short", day: "numeric" }) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", opts);

// Sales in a quarter, from Business entries.
export function quarterSales(entries, qtr) {
  const list = (entries || []).filter((e) => Number(e.revenue) > 0 && e.date && String(e.date).slice(0, 10) >= qtr.start && String(e.date).slice(0, 10) <= qtr.end);
  return { total: list.reduce((t, e) => t + Number(e.revenue || 0), 0), count: list.length };
}

export const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
