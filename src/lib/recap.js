// Numbers for the Recap page. Live data gives most of what's needed; a small
// snapshot is saved each month (RecapSnapshot) for the things that can't be
// rebuilt later, like which bills were paid and how much was saved.
import { ent } from "@/lib/freshEntities";
import { monthKeyOf, isPaid, isRecurringBill, billInMonth, monthlyEquivalent } from "@/lib/financeHelpers";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
};
const inMonth = (iso, key) => String(iso || "").slice(0, 7) === key;
const num = (v) => Number(v) || 0;
const safe = async (p) => { try { return (await p) || []; } catch { return []; } };

export async function loadAll() {
  const [goals, tasks, projects, trips, notes, finance, buckets, income, roles, snaps] = await Promise.all([
    safe(ent.Goal.list()), safe(ent.Task.list()), safe(ent.Project.list()), safe(ent.Trip.list()), safe(ent.Note.list()),
    safe(ent.FinanceItem.list()), safe(ent.BudgetBucket.list()), safe(ent.MonthlyIncome.list()), safe(ent.TargetRole.list()),
    safe(ent.RecapSnapshot.list()),
  ]);
  return { goals, tasks, projects, trips, notes, finance, buckets, income, roles, snaps };
}

const goalDone = (g) => g.status === "done" || ((g.sub_tasks || []).length > 0 && g.sub_tasks.every((t) => t.completed));
const scheduleOf = (l) => (Array.isArray(l.schedule) ? l.schedule : []);

// Cumulative counters, used for month-to-month differences.
export function counters(all) {
  const loans = all.finance.filter((i) => i.type === "loan");
  const owed = loans.reduce((s, l) => s + (l.payoff_amount != null ? num(l.payoff_amount) : num(l.total_amount) - num(l.amount_paid)), 0);
  return {
    goalsDone: all.goals.filter(goalDone).length,
    tasksDone: all.tasks.filter((t) => t.completed).length,
    projectTasksDone: all.projects.reduce((n, p) => n + (p.tasks || []).filter((t) => t.completed).length, 0),
    projectsDone: all.projects.filter((p) => p.status === "completed" || p.status === "done").length,
    saved: all.finance.filter((i) => i.type === "savings_goal").reduce((s, i) => s + num(i.current_amount), 0),
    loanOwed: Math.round(owed * 100) / 100,
  };
}

// The part of a month that is only knowable while the month is current.
export function liveFinance(all, key) {
  const bills = all.finance.filter((i) => i.type === "bill" && billInMonth(i, key));
  const subs = all.finance.filter((i) => i.type === "subscription" && !i.canceled_on);
  const loans = all.finance.filter((i) => i.type === "loan");
  const loanMonth = loans.reduce((s, l) => s + scheduleOf(l).filter((p) => inMonth(p.date, key)).reduce((a, p) => a + num(p.amount), 0), 0);
  const manual = all.buckets.filter((b) => b.month === key).reduce((s, b) => s + num(b.allocated_amount), 0);
  const billsTotal = bills.reduce((s, b) => s + num(b.amount), 0);
  const subsMonthly = subs.reduce((s, x) => s + monthlyEquivalent(x), 0);
  return {
    billsTotal: Math.round(billsTotal * 100) / 100,
    billsPaid: Math.round(bills.filter(isPaid).reduce((s, b) => s + num(b.amount), 0) * 100) / 100,
    subsMonthly: Math.round(subsMonthly * 100) / 100,
    planned: Math.round((billsTotal + subsMonthly + loanMonth + manual) * 100) / 100,
  };
}

const creditOf = (all) => {
  const scores = all.finance.filter((i) => i.type === "credit_score");
  const hist = scores.flatMap((i) => (Array.isArray(i.score_history) ? i.score_history : []));
  return hist.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

export function snapshotFor(all, key) {
  return all.snaps.find((s) => s.month === key) || null;
}

export async function saveCurrentSnapshot(existingAll) {
  try {
    const all = existingAll || (await loadAll());
    const key = monthKeyOf();
    const metrics = { ...counters(all), ...liveFinance(all, key), income: num(all.income.find((i) => i.month === key)?.amount) };
    // Don't save an empty month over a good one.
    if (!all.finance.length && !all.goals.length && !all.projects.length && !all.notes.length) return;
    const found = snapshotFor(all, key);
    if (found) await ent.RecapSnapshot.update(found.id, { metrics });
    else await ent.RecapSnapshot.create({ month: key, metrics });
  } catch { /* best effort */ }
}

export function computeMonth(all, key) {
  const isCurrent = key === monthKeyOf();
  const snap = snapshotFor(all, key);
  const prevSnap = snapshotFor(all, shiftMonth(key, -1));
  const cur = isCurrent ? { ...counters(all), ...liveFinance(all, key) } : snap?.metrics || null;
  const base = prevSnap?.metrics || null;
  const diff = (k) => (cur && base && cur[k] != null && base[k] != null ? cur[k] - base[k] : null);

  const loans = all.finance.filter((i) => i.type === "loan");
  const loanPaid = loans.reduce((s, l) => s + scheduleOf(l).filter((p) => p.paid && inMonth(p.date, key)).reduce((a, p) => a + num(p.amount), 0), 0);
  const loanPays = loans.reduce((s, l) => s + scheduleOf(l).filter((p) => p.paid && inMonth(p.date, key)).length, 0);

  const inc = all.income.find((i) => i.month === key);
  const manual = all.buckets.filter((b) => b.month === key).reduce((s, b) => s + num(b.allocated_amount), 0);
  const credit = creditOf(all);
  const inM = credit.filter((h) => inMonth(h.date, key));
  const before = credit.filter((h) => String(h.date).slice(0, 7) < key).pop();
  const scoreNow = inM.length ? inM[inM.length - 1].score : null;

  const doneGoals = all.goals.filter((g) => goalDone(g) && inMonth(g.updated_date, key));
  const standalone = all.tasks.filter((t) => t.completed && inMonth(t.updated_date, key)).length;
  const projDelta = diff("projectTasksDone");
  const trips = all.trips.filter((t) => inMonth(t.start_date, key));
  const roles = all.roles.filter((r) => inMonth(r.created_date, key));
  const bestRole = roles.reduce((m, r) => Math.max(m, num(r.analysis?.score)), 0);

  return {
    key, isCurrent, hasSnapshot: !!cur,
    finance: {
      income: inc ? num(inc.amount) : cur?.income ?? null,
      planned: cur?.planned ?? (manual || null),
      billsTotal: cur?.billsTotal ?? null,
      billsPaid: cur?.billsPaid ?? null,
      subs: cur?.subsMonthly ?? null,
      loanPaid, loanPays,
      savedDelta: diff("saved"),
      savedNow: isCurrent ? counters(all).saved : cur?.saved ?? null,
      score: scoreNow, scoreDelta: scoreNow != null && before ? scoreNow - num(before.score) : null,
    },
    goals: {
      done: doneGoals.length,
      active: isCurrent ? all.goals.filter((g) => !goalDone(g)).length : null,
      next: isCurrent ? all.goals.filter((g) => !goalDone(g) && (g.sub_tasks || []).length)
        .map((g) => ({ t: g.title, p: Math.round((g.sub_tasks.filter((x) => x.completed).length / g.sub_tasks.length) * 100) }))
        .sort((a, b) => b.p - a.p)[0] || null : null,
    },
    projects: {
      tasksDone: standalone + (projDelta != null ? Math.max(0, projDelta) : 0),
      tasksApprox: projDelta == null && all.projects.some((p) => (p.tasks || []).some((t) => t.completed)),
      finished: diff("projectsDone") != null ? Math.max(0, diff("projectsDone")) : null,
      overdue: isCurrent
        ? all.projects.reduce((n, p) => n + (p.tasks || []).filter((t) => !t.completed && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)).length, 0)
        : null,
    },
    trips: { count: trips.length, places: [...new Set(trips.map((t) => t.country).filter(Boolean))] },
    career: { roles: roles.length, best: bestRole || null },
    notes: { count: all.notes.filter((n) => inMonth(n.created_date, key)).length },
  };
}

export function headline(m) {
  const f = m.finance;
  const bits = [];
  if (f.billsTotal && f.billsPaid != null) {
    bits.push(f.billsPaid >= f.billsTotal - 0.5 ? "Every bill is paid" : `${Math.round((f.billsPaid / f.billsTotal) * 100)}% of bills paid`);
  }
  if (f.loanPaid > 0) bits.push(`$${Math.round(f.loanPaid).toLocaleString()} in loan payments made`);
  if (m.goals.done) bits.push(`${m.goals.done} goal${m.goals.done === 1 ? "" : "s"} finished`);
  if (m.projects.tasksDone) bits.push(`${m.projects.tasksDone} task${m.projects.tasksDone === 1 ? "" : "s"} done`);
  if (m.trips.count) bits.push(`${m.trips.count} trip${m.trips.count === 1 ? "" : "s"} started`);
  if (!bits.length) return m.isCurrent ? "A fresh month. Your numbers fill in as you go." : "Not much was recorded for this month.";
  return bits.slice(0, 3).join(" · ") + ".";
}

export function computeYear(all, year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const ms = months.map((k) => computeMonth(all, k));
  const sum = (fn) => ms.reduce((s, m) => s + (fn(m) || 0), 0);
  const busiest = [...ms].sort((a, b) => b.projects.tasksDone - a.projects.tasksDone)[0];
  const bestGoals = [...ms].sort((a, b) => b.goals.done - a.goals.done)[0];
  const scores = ms.map((m) => m.finance.score).filter((x) => x != null);
  return {
    months: ms,
    income: sum((m) => m.finance.income),
    planned: sum((m) => m.finance.planned),
    loanPaid: sum((m) => m.finance.loanPaid),
    saved: sum((m) => m.finance.savedDelta),
    goals: sum((m) => m.goals.done),
    tasks: sum((m) => m.projects.tasksDone),
    notes: sum((m) => m.notes.count),
    trips: sum((m) => m.trips.count),
    countries: [...new Set(ms.flatMap((m) => m.trips.places))].length,
    roles: sum((m) => m.career.roles),
    scoreFirst: scores[0] ?? null, scoreLast: scores[scores.length - 1] ?? null,
    busiest: busiest && busiest.projects.tasksDone > 0 ? { label: MONTHS[Number(busiest.key.slice(5)) - 1], n: busiest.projects.tasksDone } : null,
    bestGoals: bestGoals && bestGoals.goals.done > 0 ? { label: MONTHS[Number(bestGoals.key.slice(5)) - 1], n: bestGoals.goals.done } : null,
  };
}
