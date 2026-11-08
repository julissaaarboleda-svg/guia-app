// Shared money / due-date helpers for the Finance screens.
export const monthKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const isRecurringBill = (b) => !!b.billing_cycle && b.billing_cycle !== "one_time";
export const isYearlyBill = (b) => b.billing_cycle === "yearly";

// Does this bill fall due in the given month ("YYYY-MM")? Monthly-type bills always do;
// yearly bills only in the month of their due date; one-time bills in their due month.
export function billInMonth(b, key) {
  if (isYearlyBill(b)) return String(b.due_date || "").slice(5, 7) === key.slice(5, 7);
  if (isRecurringBill(b)) return true;
  return String(b.due_date || "").slice(0, 7) === key;
}

// A recurring bill is only "paid" for the month it was marked paid in, so it
// resets itself each month. One-time bills stay paid.
export function isPaid(item) {
  if (!item.paid) return false;
  if (item.type === "bill" && isYearlyBill(item)) {
    if (!item.paid_month) return false;
    const [py, pm] = item.paid_month.split("-").map(Number);
    const now = new Date();
    return (now.getFullYear() - py) * 12 + (now.getMonth() + 1 - pm) < 11;
  }
  if (item.type === "bill" && isRecurringBill(item)) return item.paid_month === monthKeyOf();
  return true;
}

export const paidPatch = (item, nowPaid) => ({ paid: nowPaid, paid_month: nowPaid ? monthKeyOf() : null });

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// { date, days, label, tone } for a bill — tone: paid | overdue | soon | normal | none
export function dueInfo(item) {
  const today = startOfDay(new Date());
  let date = null;
  if (isYearlyBill(item) && item.due_date) {
    const [, mm, dd] = item.due_date.split("-").map(Number);
    let y = today.getFullYear();
    if (isPaid(item)) {
      const [py, pm] = (item.paid_month || monthKeyOf()).split("-").map(Number);
      y = pm >= mm ? py + 1 : py;
    } else if (new Date(y, mm - 1, dd) < new Date(today.getTime() - 45 * 86400000)) {
      y += 1;
    }
    date = new Date(y, mm - 1, dd);
  } else if (isRecurringBill(item) && item.due_day) {
    date = new Date(today.getFullYear(), today.getMonth(), Math.min(Number(item.due_day), 28 + 3));
    if (isPaid(item)) date = new Date(today.getFullYear(), today.getMonth() + 1, Number(item.due_day));
  } else if (item.due_date) {
    date = startOfDay(new Date(item.due_date + "T00:00:00"));
  }
  if (isPaid(item)) {
    const renews = isYearlyBill(item) && date ? ` · renews ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "";
    return { date, days: null, tone: "paid", label: `Paid${renews}` };
  }
  if (!date) return { date: null, days: null, tone: "none", label: "No date" };
  const days = Math.round((date - today) / 86400000);
  if (days < 0) return { date, days, tone: "overdue", label: `Overdue · ${shortDate(date)}` };
  if (days === 0) return { date, days, tone: "soon", label: "Due today" };
  return { date, days, tone: days <= 3 ? "soon" : "normal", label: `Due ${shortDate(date)} · in ${days} day${days === 1 ? "" : "s"}` };
}

export const TONE_CLASS = {
  paid: "text-[#566033]",
  overdue: "text-[#8F5F65]",
  soon: "text-[#8A5F27]",
  normal: "text-muted-foreground",
  none: "text-muted-foreground",
};

export const monthlyEquivalent = (s) => {
  const amt = Number(s.amount) || 0;
  if (s.billing_cycle === "yearly") return amt / 12;
  if (s.billing_cycle === "quarterly") return amt / 3;
  if (s.billing_cycle === "weekly") return amt * 4.33;
  return amt;
};

// A subscription is flagged for review if it hasn't been confirmed in 90 days.
export function needsReview(sub) {
  const ref = sub.reviewed_at || sub.created_date;
  if (!ref) return false;
  const ageDays = (Date.now() - new Date(ref).getTime()) / 86400000;
  return ageDays > 90;
}

// A canceled subscription stays on record but no longer counts toward any total.
export const isCanceled = (i) => !!i.canceled_on;
