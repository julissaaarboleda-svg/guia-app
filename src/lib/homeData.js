import { parseISO, differenceInCalendarDays, format } from "date-fns";
import { categoryToModule } from "@/lib/homeModules";
import { monthKeyOf, isPaid, billInMonth, isCanceled } from "@/lib/financeHelpers";
import { weekSummary } from "@/lib/routines";

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

export function buildUpNext({ trips = [], projects = [], bizEntries = [] }) {
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
      image: t.hero_image_url || null, imagePos: t.hero_image_pos || null,
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
      image: p.cover_image_url || null, imagePos: p.cover_image_pos || null, accentColor: p.accent_color || "#A7773F",
    });
  });
  bizEntries.forEach((b) => {
    if (b.category !== "Event" || !b.date) return;
    const days = differenceInCalendarDays(parseISO(b.date), now);
    if (days < 0) return;
    items.push({
      id: `biz-${b.id}`, title: b.name, module: "business",
      dateLabel: format(parseISO(b.date), "MMM d"), countdown: daysLabel(days) || `${days} days`,
      path: "/business", _days: days,
    });
  });
  items.sort((a, b) => (a._days - b._days));
  return items.slice(0, 4);
}

const money0 = (n) => `$${Math.round(n).toLocaleString()}`;

// Everything a person can pick for the Life Progress card. "pick" means the ring can follow one specific item.
export const RING_CATALOG = [
  { id: "projects", label: "Projects", desc: "Tasks done across active projects", group: "area" },
  { id: "business", label: "Business", desc: "Revenue toward your goal", group: "area" },
  { id: "trip", label: "Trip planning", desc: "Packing and itinerary for the next trip", group: "area" },
  { id: "finance", label: "Finance", desc: "Savings goals saved so far", group: "area" },
  { id: "goal", label: "Personal goals", desc: "Steps done on a goal you pick", group: "more", pick: "goal" },
  { id: "project", label: "One project", desc: "Tasks done in a single project", group: "more", pick: "project" },
  { id: "loans", label: "Loan pay-down", desc: "How much of your loans you've paid", group: "more" },
  { id: "bills", label: "Bills this month", desc: "Bills paid out of bills due", group: "more" },
  { id: "spending", label: "Spending vs plan", desc: "Budget used this month", group: "more" },
  { id: "routines", label: "Routines this week", desc: "Scheduled routine days completed", group: "more" },
];
export const DEFAULT_RINGS = [{ id: "projects" }, { id: "business" }, { id: "trip" }, { id: "finance" }];
export const MAX_RINGS = 4;

const taskPct = (list) => {
  let total = 0, done = 0;
  list.forEach((p) => (p.tasks || []).forEach((t) => { total++; if (t.completed) done++; }));
  return { total, done };
};

// Builds the rings the person chose (or the four defaults). An area with nothing set up still gets
// its ring, dimmed with a "Set up" hint, so the layout never shifts.
export function buildProgress({ routines = [], selection = null, trips = [], projects = [], goals = [], finItems = [], business = null, spending = null }) {
  const now = new Date();
  const ring = (label, pct, sub, path) => ({ label, value: pct, display: `${pct}%`, sub, path });
  const empty = (label, sub, path) => ({ label, value: 0, display: "–", sub, path, empty: true });
  const mk = monthKeyOf();

  const builders = {
    projects: () => {
      const act = projects.filter((p) => p.status === "active" || p.status === "planning");
      const { total, done } = taskPct(act);
      return total ? ring("Projects", Math.round((done / total) * 100), `${done} of ${total} tasks`, "/projects")
        : empty("Projects", act.length ? "Add tasks" : "Set up", "/projects");
    },
    project: (ref) => {
      const p = projects.find((x) => x.id === ref) || projects.find((x) => x.status === "active") || projects[0];
      if (!p) return empty("One project", "Set up", "/projects");
      const { total, done } = taskPct([p]);
      return total ? ring(p.title, Math.round((done / total) * 100), `${done} of ${total} tasks`, "/projects") : empty(p.title, "Add tasks", "/projects");
    },
    business: () => {
      const goal = Number(business?.revenueGoal) || 0;
      return goal > 0
        ? ring("Business", Math.min(100, Math.round(((business.revenue || 0) / goal) * 100)), `${money0(business.revenue || 0)} of ${money0(goal)}`, "/business")
        : empty("Business", "Set a revenue goal", "/business");
    },
    trip: () => {
      const nextTrip = [...trips].filter((t) => t.start_date && parseISO(t.start_date) >= now)
        .sort((a, b) => parseISO(a.start_date) - parseISO(b.start_date))[0];
      if (!nextTrip) return empty("Trip planning", "Plan a trip", "/travel");
      const pack = nextTrip.packing_items || [];
      const days = nextTrip.itinerary || [];
      const parts = [pack.length ? pack.filter((i) => i.packed).length / pack.length : 0, days.length ? days.filter((d) => (d.activities || []).length > 0).length / days.length : 0];
      const pct = Math.round((parts[0] + parts[1]) / 2 * 100);
      const away = differenceInCalendarDays(parseISO(nextTrip.start_date), now);
      return ring(nextTrip.title || "Trip planning", pct, away === 0 ? "Today" : away === 1 ? "Tomorrow" : `${away} days away`, "/travel");
    },
    finance: () => {
      const saves = finItems.filter((f) => f.type === "savings_goal" && Number(f.target_amount) > 0);
      const targetSum = saves.reduce((t, f) => t + Number(f.target_amount), 0);
      if (targetSum > 0) {
        const saved = saves.reduce((t, f) => t + Math.min(Number(f.current_amount) || 0, Number(f.target_amount)), 0);
        return ring("Finance", Math.round((saved / targetSum) * 100), `${money0(saved)} of ${money0(targetSum)} saved`, "/finance");
      }
      const l = builders.loans();
      return l.empty ? empty("Finance", "Add a savings goal", "/finance") : { ...l, label: "Finance" };
    },
    goal: (ref) => {
      const open = goals.filter((g) => g.status !== "completed");
      const g = goals.find((x) => x.id === ref)
        || [...open].sort((a, b) => (a.target_date || "9999").localeCompare(b.target_date || "9999"))[0];
      if (!g) return empty("Personal goals", "Add a goal", "/goals");
      const st = g.sub_tasks || [];
      const pct = st.length ? Math.round((st.filter((t) => t.completed).length / st.length) * 100) : Math.round(g.progress || 0);
      return ring(g.title, pct, pct >= 100 ? "Completed" : st.length ? `${st.filter((t) => t.completed).length} of ${st.length} steps` : "Goal", "/goals");
    },
    loans: () => {
      const loans = finItems.filter((f) => f.type === "loan" && Number(f.total_amount) > 0);
      const total = loans.reduce((t, l) => t + Number(l.total_amount), 0);
      if (!total) return empty("Loan pay-down", "Add loan balances", "/finance");
      const owed = loans.reduce((t, l) => t + (l.payoff_amount != null ? Number(l.payoff_amount) : Number(l.total_amount) - (Number(l.amount_paid) || 0)), 0);
      return ring("Loan pay-down", Math.max(0, Math.min(100, Math.round(((total - owed) / total) * 100))), "Loans paid down", "/finance");
    },
    bills: () => {
      const due = finItems.filter((f) => f.type === "bill" && !isCanceled(f) && billInMonth(f, mk));
      if (!due.length) return empty("Bills this month", "No bills due", "/finance");
      const paid = due.filter((f) => isPaid(f)).length;
      return ring("Bills this month", Math.round((paid / due.length) * 100), `${paid} of ${due.length} paid`, "/finance");
    },
    spending: () => {
      const planned = Number(spending?.planned) || 0;
      if (!planned) return empty("Spending vs plan", "Set a budget", "/finance");
      const spent = Number(spending?.spent) || 0;
      return ring("Spending vs plan", Math.min(100, Math.round((spent / planned) * 100)), `${money0(spent)} of ${money0(planned)}`, "/finance");
    },
  };

  builders.routines = () => {
    const w = weekSummary(routines);
    if (!routines.length) return empty("Routines", "Add a routine", "/goals?view=routines");
    if (!w.sched) return empty("Routines", "Nothing due yet", "/goals?view=routines");
    return ring("Routines", Math.round((w.done / w.sched) * 100), `${w.done} of ${w.sched} this week`, "/goals?view=routines");
  };

  const picks = (selection && selection.length ? selection : DEFAULT_RINGS).filter((r) => builders[r.id]).slice(0, MAX_RINGS);
  return picks.map((r) => builders[r.id](r.ref));
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
  const bg = (businessGoals || []).find((g) => (g.status || "active") === "active");
  if (bg && bg.target_value) lines.push(`Business goal ${bg.title}: ${bg.current_value || 0}/${bg.target_value}`);
  const activeProjects = (projects || []).filter((p) => p.status === "active").length;
  lines.push(`Active projects: ${activeProjects}`);
  return lines.join("; ");
}
