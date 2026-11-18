// Quarter focus for goals: up to 3 goals marked as this quarter's focus (goal.focus_quarter = "2026-Q4"),
// and the rest optionally planned for a later quarter (goal.quarter = "2027-Q1"), or left for "someday".
const pad = (n) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const quarterId = (d = new Date()) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
export function parseQ(id) { const [y, q] = String(id).split("-Q").map(Number); return { y, q }; }
export function shiftQ(id, n) { let { y, q } = parseQ(id); q += n; while (q > 4) { q -= 4; y += 1; } while (q < 1) { q += 4; y -= 1; } return `${y}-Q${q}`; }
export function qLabel(id) { const { q } = parseQ(id); return `${MON[(q - 1) * 3]}–${MON[q * 3 - 1]}`; }
export function qShort(id, fromId = quarterId()) { const { y, q } = parseQ(id); return parseQ(fromId).y === y ? `Q${q}` : `Q${q} '${String(y).slice(2)}`; }
export function qRange(id) { const { y, q } = parseQ(id); return { start: `${y}-${pad((q - 1) * 3 + 1)}-01`, end: new Date(y, q * 3, 0, 12) }; }
export function qDaysLeft(id = quarterId(), now = new Date()) {
  const end = qRange(id).end; const t = new Date(now); t.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((end - t) / 86400000));
}
export function qElapsed(id = quarterId(), now = new Date()) {
  const { start, end } = qRange(id); const s = new Date(`${start}T12:00:00`);
  return Math.min(1, Math.max(0, (now - s) / (end - s)));
}
export const goalDone = (g) => g.status === "done" || g.status === "completed" || ((g.sub_tasks || []).length > 0 && (g.sub_tasks || []).every((t) => t.completed));
export function goalPct(g) {
  const st = g.sub_tasks || [];
  if (st.length) return Math.round((st.filter((t) => t.completed).length / st.length) * 100);
  return goalDone(g) ? 100 : 0;
}
export const focusGoals = (goals, id = quarterId()) => (goals || []).filter((g) => g.focus_quarter === id);
export const usesQuarters = (goals) => (goals || []).some((g) => g.focus_quarter || g.quarter);
export const MAX_FOCUS = 3;
