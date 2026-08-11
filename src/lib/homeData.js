import { parseISO, differenceInCalendarDays, format } from "date-fns";
import { categoryToModule } from "@/lib/homeModules";

const PRIORITY_WEIGHT = { urgent: 4, high: 3, normal: 2, low: 1 };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const daysLabel = (days) => {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return null;
};

export function buildFocusItems({ tasks = [], goals = [], projects = [], finItems = [], trips = [], businessGoals = [], careerEntries = [] }) {
  const now = new Date();
  const items = [];
  const inDays = (d) => (d ? differenceInCalendarDays(parseISO(d), now) : null);

  tasks.forEach((t) => {
    if (t.completed) return;
    items.push({
      id: `task-${t.id}`, kind: "task", refId: t.id,
      title: t.title, module: categoryToModule(t.category),
      priority: t.priority || "normal", due: t.due_date, dueIn: inDays(t.due_date),
    });
  });

  goals.forEach((g) => {
    (g.sub_tasks || []).forEach((s, i) => {
      if (s.completed) return;
      items.push({
        id: `goal-${g.id}-${i}`, kind: "goal", refId: g.id, subIndex: i,
        title: s.text, module: "goals",
        priority: g.status === "in_progress" ? "normal" : "low",
        due: g.target_date, dueIn: inDays(g.target_date),
      });
    });
  });

  projects.forEach((p) => {
    (p.tasks || []).forEach((tk, i) => {
      if (tk.completed) return;
      items.push({
        id: `proj-${p.id}-${i}`, kind: "project", refId: p.id, subIndex: i,
        title: tk.title, module: "projects",
        priority: p.status === "active" ? "normal" : "low",
        due: tk.due_date, dueIn: inDays(tk.due_date),
      });
    });
  });

  finItems.forEach((f) => {
    if (f.type !== "bill" || f.paid) return;
    items.push({
      id: `bill-${f.id}`, kind: "bill", refId: f.id,
      title: f.name, module: "finance",
      priority: "high", due: f.due_date, dueIn: inDays(f.due_date),
    });
  });

  businessGoals.forEach((bg) => {
    if (bg.status !== "active") return;
    items.push({
      id: `bgoal-${bg.id}`, kind: "bgoal", refId: bg.id,
      title: bg.title, module: "business",
      priority: "normal", due: bg.target_date, dueIn: inDays(bg.target_date),
    });
  });

  careerEntries.forEach((c) => {
    if (!c.start_date || c.current) return;
    const d = inDays(c.start_date);
    if (d == null || d < 0) return;
    items.push({
      id: `career-${c.id}`, kind: "career", refId: c.id,
      title: `Start · ${c.title}`, module: "career",
      priority: "normal", due: c.start_date, dueIn: d,
    });
  });

  const nextTrip = [...trips]
    .filter((t) => t.start_date && parseISO(t.start_date) >= now)
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))[0];
  if (nextTrip) {
    (nextTrip.packing_items || []).forEach((pk, i) => {
      if (pk.packed) return;
      items.push({
        id: `pack-${nextTrip.id}-${i}`, kind: "pack", refId: nextTrip.id, subIndex: i,
        title: pk.name, module: "travel",
        priority: "normal", due: nextTrip.start_date, dueIn: inDays(nextTrip.start_date),
      });
    });
  }

  items.sort((a, b) => {
    const pa = PRIORITY_WEIGHT[a.priority] || 2;
    const pb = PRIORITY_WEIGHT[b.priority] || 2;
    if (pa !== pb) return pb - pa;
    if (a.dueIn != null && b.dueIn != null) return a.dueIn - b.dueIn;
    if (a.dueIn != null) return -1;
    if (b.dueIn != null) return 1;
    return 0;
  });
  return { items: items.slice(0, 3), total: items.length };
}

function tripRange(t) {
  if (!t.start_date) return "";
  const s = parseISO(t.start_date);
  if (!t.end_date) return format(s, "MMM d");
  const e = parseISO(t.end_date);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM d")}–${format(e, "d")}`;
  }
  return `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
}

export function buildUpNext({ trips = [], bizEntries = [], finItems = [], projects = [], tasks = [] }) {
  const now = new Date();
  const items = [];
  trips.forEach((t) => {
    if (!t.start_date) return;
    const days = differenceInCalendarDays(parseISO(t.start_date), now);
    if (days < 0) return;
    items.push({
      id: `trip-${t.id}`, title: t.title, module: "travel",
      dateLabel: tripRange(t), countdown: daysLabel(days) || `${days} days`,
      status: cap(t.status), path: "/travel", _days: days,
    });
  });
  projects.forEach((p) => {
    if (!p.target_date) return;
    const days = differenceInCalendarDays(parseISO(p.target_date), now);
    if (days < 0) return;
    items.push({
      id: `proj-${p.id}`, title: p.title, module: "projects",
      dateLabel: `Due ${format(parseISO(p.target_date), "MMM d")}`, countdown: daysLabel(days) || `${days} days`,
      status: cap(p.status), path: "/projects", _days: days,
    });
  });
  finItems.forEach((f) => {
    if (f.type !== "bill" || f.paid || !f.due_date) return;
    const days = differenceInCalendarDays(parseISO(f.due_date), now);
    if (days < -1) return;
    items.push({
      id: `bill-${f.id}`, title: f.name, module: "finance",
      dateLabel: daysLabel(days) || format(parseISO(f.due_date), "MMM d"),
      amount: f.amount, path: "/finance", _days: days,
    });
  });
  bizEntries.forEach((b) => {
    if (!b.date) return;
    const days = differenceInCalendarDays(parseISO(b.date), now);
    if (days < 0) return;
    items.push({
      id: `biz-${b.id}`, title: b.name, module: "business",
      dateLabel: format(parseISO(b.date), "MMM d"), countdown: daysLabel(days) || `${days} days`,
      path: "/business", _days: days,
    });
  });
  tasks.forEach((t) => {
    if (t.completed || !t.due_date) return;
    const days = differenceInCalendarDays(parseISO(t.due_date), now);
    if (days < 0) return;
    items.push({
      id: `task-${t.id}`, title: t.title, module: categoryToModule(t.category),
      dateLabel: daysLabel(days) || format(parseISO(t.due_date), "MMM d"), countdown: daysLabel(days) || `${days} days`,
      path: "/goals", _days: days,
    });
  });
  items.sort((a, b) => (a._days - b._days));
  return items.slice(0, 4);
}

export function buildProgress({ goals = [], businessGoals = [], trips = [], projects = [] }) {
  const now = new Date();
  const circles = [];
  const activeGoal = goals.find((g) => g.status === "in_progress") || goals[0];
  if (activeGoal) {
    const pct = Math.round(activeGoal.progress || 0);
    circles.push({ label: activeGoal.title, value: pct, display: `${pct}%`, action: "Continue", path: "/goals" });
  }
  const bg = businessGoals.find((g) => g.status === "active") || businessGoals[0];
  if (bg) {
    const pct = bg.target_value ? Math.min(100, Math.round(((bg.current_value || 0) / bg.target_value) * 100)) : 0;
    circles.push({ label: bg.title, value: pct, display: `${bg.current_value || 0} / ${bg.target_value || 0}`, action: "Continue", path: "/business" });
  }
  const nextTrip = [...trips]
    .filter((t) => t.start_date && parseISO(t.start_date) >= now)
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))[0];
  if (nextTrip && nextTrip.budget_target) {
    const spent = (nextTrip.expense_items || []).reduce((s, e) => s + (e.amount || 0), 0);
    const pct = Math.min(100, Math.round((spent / nextTrip.budget_target) * 100));
    circles.push({ label: nextTrip.title, value: pct, display: `${pct}%`, action: "View Budget", path: "/travel" });
  }
  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "planning");
  if (activeProjects.length) {
    let total = 0, done = 0;
    activeProjects.forEach((p) => (p.tasks || []).forEach((t) => { total++; if (t.completed) done++; }));
    const pct = total ? Math.round((done / total) * 100) : 0;
    circles.push({ label: "Projects", value: pct, display: `${pct}%`, action: "View Projects", path: "/projects" });
  }
  return circles.slice(0, 4);
}

const ACT_LABEL = { notes: "Note", finance: "Finance", goals: "Goal", travel: "Trip", business: "Business", projects: "Project", career: "Career" };
const actVerb = (created, updated) => {
  if (!created) return "updated";
  if (!updated) return "created";
  return new Date(created).toDateString() === new Date(updated).toDateString() ? "created" : "updated";
};

export function buildActivity({ notes = [], finItems = [], goals = [], trips = [], bizEntries = [], projects = [], careerEntries = [] }) {
  const now = new Date();
  const within = (ts) => {
    if (!ts) return false;
    const diff = differenceInCalendarDays(now, new Date(ts));
    return diff >= 0 && diff <= 7;
  };
  const push = (items, id, name, module, created, updated) => {
    const ts = updated || created;
    if (!within(ts)) return;
    items.push({ id, name, action: `${ACT_LABEL[module]} ${actVerb(created, updated)}`, module, ts });
  };
  const items = [];
  notes.forEach((n) => push(items, `note-${n.id}`, n.title || "Untitled note", "notes", n.created_date, n.updated_date));
  finItems.forEach((f) => push(items, `fin-${f.id}`, f.name, "finance", f.created_date, f.updated_date));
  goals.forEach((g) => push(items, `goal-${g.id}`, g.title, "goals", g.created_date, g.updated_date));
  trips.forEach((t) => push(items, `trip-${t.id}`, t.title, "travel", t.created_date, t.updated_date));
  bizEntries.forEach((b) => push(items, `biz-${b.id}`, b.name, "business", b.created_date, b.updated_date));
  projects.forEach((p) => push(items, `proj-${p.id}`, p.title, "projects", p.created_date, p.updated_date));
  careerEntries.forEach((c) => push(items, `career-${c.id}`, c.title, "career", c.created_date, c.updated_date));
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  return items;
}

export function buildDailyStatus({ tasks = [], trips = [], finItems = [], goals = [] }) {
  const now = new Date();
  const openTasks = (tasks || []).filter((t) => !t.completed).length;
  const nextTrip = [...(trips || [])]
    .filter((t) => t.start_date && parseISO(t.start_date) >= now)
    .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))[0];
  if (nextTrip) {
    const days = differenceInCalendarDays(parseISO(nextTrip.start_date), now);
    if (days <= 60) {
      const short = (nextTrip.title || "Trip").split(" ")[0];
      return `✈︎ ${short} • ${days} ${days === 1 ? "day" : "days"}`;
    }
  }
  if (openTasks > 0) {
    return `🎯 ${openTasks} ${openTasks === 1 ? "priority" : "priorities"} today`;
  }
  return "Everything looks good today.";
}

export function relativeTime(ts) {
  if (!ts) return "";
  const diff = differenceInCalendarDays(new Date(), new Date(ts));
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

export function activityGroup(ts) {
  if (!ts) return "earlier";
  const diff = differenceInCalendarDays(new Date(), new Date(ts));
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "week";
  return "earlier";
}

export const GROUP_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This Week",
  earlier: "Earlier",
};

export function buildDigest({ goals = [], projects = [], trips = [], finItems = [], tasks = [], businessGoals = [] }) {
  const now = new Date();
  const lines = [];
  lines.push(`Open tasks: ${(tasks || []).filter((t) => !t.completed).length}`);
  lines.push(`Active goals: ${(goals || []).filter((g) => g.status === "in_progress").length}`);
  const nextTrip = (trips || [])
    .filter((t) => t.start_date)
    .map((t) => ({ t, d: Math.abs((parseISO(t.start_date) - now) / 86400000) }))
    .sort((a, b) => a.d - b.d)[0];
  if (nextTrip) lines.push(`Next trip: ${nextTrip.t.title} in ${Math.ceil(nextTrip.d)} days`);
  const unpaidBills = (finItems || []).filter((f) => f.type === "bill" && !f.paid);
  if (unpaidBills.length) lines.push(`Unpaid bills: ${unpaidBills.length}`);
  const bg = (businessGoals || []).find((g) => g.status === "active");
  if (bg && bg.target_value) lines.push(`Business goal ${bg.title}: ${bg.current_value || 0}/${bg.target_value}`);
  const activeProjects = (projects || []).filter((p) => p.status === "active").length;
  lines.push(`Active projects: ${activeProjects}`);
  return lines.join("; ");
}