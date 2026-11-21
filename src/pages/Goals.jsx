import { useState, useEffect } from "react";
import { ent } from "@/lib/freshEntities";
import { parseISO, differenceInCalendarDays, format, addDays } from "date-fns";
import { Plus, Trash2, Check, Calendar, ArrowLeft, ChevronDown, ChevronUp, Star, MoreHorizontal, StickyNote } from "lucide-react";
import { quarterId, shiftQ, qLabel, qShort, qDaysLeft, MAX_FOCUS } from "@/lib/quarters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import DateInput from "@/components/DateInput";
import PageHeader from "@/components/PageHeader";
import RoutinesView from "@/components/routines/RoutinesView";

const STATUS_STYLES = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-muted text-foreground",
  done:        "bg-[#E4E9D5] text-[#566033]",
};
const STATUS_LABELS = { not_started: "Not started", in_progress: "In progress", done: "Done" };
const CATEGORIES = ["personal", "finance", "career", "business", "health", "travel"];
const PRIORITY_CHIP = { urgent: "bg-[#F4E6E7] text-[#8F5F65]", high: "bg-[#F3E8D6] text-[#8A5F27]" };
const SECTION_ORDER = ["Overdue", "Today", "This week", "Later", "No date"];
// On pace? Compares progress with how much of the time (from creation to the target date) has passed.
function paceOf(g, pct, left) {
  if (!g.target_date || !(g.sub_tasks || []).length) return null;
  const start = new Date(g.created_date || Date.now()).getTime();
  const end = new Date(`${String(g.target_date).slice(0, 10)}T23:59:00`).getTime();
  if (left != null && left < 0) return "Behind";
  const elapsed = end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : 1;
  const expected = elapsed * 100;
  if (pct >= expected + 20) return "Ahead";
  if (pct >= expected - 15) return "On track";
  return "Behind";
}
const shortDate = (d) => parseISO(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysFrom = (d) => differenceInCalendarDays(parseISO(d), new Date()); // negative = past

// Round check used for tasks and steps: olive when done, quiet outline when open.
const Tick = ({ done, size = 20 }) => (
  <span className={`flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${done ? "bg-[#5A6F45] border border-[#5A6F45]" : "border-[1.5px] border-muted-foreground/40"}`} style={{ width: size, height: size }}>
    {done && <Check className="text-white" style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.4} />}
  </span>
);

export default function Goals() {
  const [activeTab, setActiveTab] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("view") === "routines" ? "routines" : new URLSearchParams(window.location.search).get("view") === "tasks" ? "tasks" : "goals"; } catch { return "goals"; }
  });
  const [routineAdd, setRoutineAdd] = useState(0);
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null); // { type: "goal"|"task", id }
  const [subTaskInputs, setSubTaskInputs] = useState({});
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showDoneGoals, setShowDoneGoals] = useState(false);
  const [showDoneSteps, setShowDoneSteps] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [goalMenu, setGoalMenu] = useState(false);
  const [datingStep, setDatingStep] = useState(null); // index of the step whose date picker is open
  const [editingSteps, setEditingSteps] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [qMsg, setQMsg] = useState("");
  const [pickSel, setPickSel] = useState([]);
  const [pickMsg, setPickMsg] = useState("");

  // Add form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [targetDate, setTargetDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskNotes, setTaskNotes] = useState("");

  // Inline edit state for detail panel
  const [editGoalData, setEditGoalData] = useState(null);
  const [editTaskData, setEditTaskData] = useState(null);

  const load = async () => {
    const [g, t] = await Promise.all([
      ent.Goal.list("-created_date"),
      ent.Task.list("-created_date"),
    ]);
    setGoals(g);
    setTasks(t);
  };

  useEffect(() => { load(); }, []);

  // Items added with quick capture show up right away.
  useEffect(() => {
    const add = (e) => {
      const { type, record } = e.detail || {};
      if (type === "task") setTasks((t) => [record, ...t.filter((x) => x.id !== record.id)]);
      if (type === "goal") setGoals((g) => [record, ...g.filter((x) => x.id !== record.id)]);
    };
    const drop = (e) => {
      const { type, id } = e.detail || {};
      if (type === "task") setTasks((t) => t.filter((x) => x.id !== id));
      if (type === "goal") setGoals((g) => g.filter((x) => x.id !== id));
    };
    window.addEventListener("guia:captured", add);
    window.addEventListener("guia:capture-undone", drop);
    return () => { window.removeEventListener("guia:captured", add); window.removeEventListener("guia:capture-undone", drop); };
  }, []);

  const selectedGoal = selected?.type === "goal" ? goals.find(g => g.id === selected.id) : null;

  // Goal details save on their own, a moment after you stop typing.
  useEffect(() => {
    if (!editGoalData?.id || saveState !== "saving") return;
    const t = setTimeout(async () => {
      try { await saveGoal(editGoalData); setSaveState("saved"); } catch { setSaveState(""); }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editGoalData]);
  useEffect(() => { setGoalMenu(false); setEditingSteps(false); setNotesOpen(false); setSaveState(""); setQMsg(""); }, [selected?.id]);
  const selectedTask = selected?.type === "task" ? tasks.find(t => t.id === selected.id) : null;



  const openAdd = () => {
    setAdding(true);
    setSelected(null);
    setTitle(""); setCategory("personal"); setTargetDate("");
    setTaskNotes(""); setTaskPriority("normal"); setTaskDueDate("");
  };

  const addGoal = async () => {
    if (!title.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, title: title.trim(), category, status: "in_progress", target_date: targetDate || undefined, sub_tasks: [] };
    setGoals(g => [optimistic, ...g]);
    setAdding(false); setTitle(""); setCategory("personal"); setTargetDate("");
    try {
      const real = await ent.Goal.create({ title: optimistic.title, category: optimistic.category, status: "in_progress", target_date: optimistic.target_date });
      setGoals(g => g.map(x => x.id === tempId ? real : x));
    } catch {
      setGoals(g => g.filter(x => x.id !== tempId));
    }
  };

  const addTask = async () => {
    if (!title.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, title: title.trim(), notes: taskNotes.trim(), priority: taskPriority, due_date: taskDueDate || undefined, completed: false };
    setTasks(t => [optimistic, ...t]);
    setAdding(false); setTitle(""); setTaskNotes(""); setTaskPriority("normal"); setTaskDueDate("");
    try {
      const real = await ent.Task.create({ title: optimistic.title, notes: optimistic.notes, priority: optimistic.priority, due_date: optimistic.due_date, completed: false });
      setTasks(t => t.map(x => x.id === tempId ? real : x));
    } catch {
      setTasks(t => t.filter(x => x.id !== tempId));
    }
  };

  const saveGoal = async (data) => {
    setGoals(g => g.map(x => x.id === data.id ? { ...x, ...data } : x));
    await ent.Goal.update(data.id, { title: data.title, category: data.category, target_date: data.target_date, status: data.status, notes: data.notes });
  };

  const saveTask = async (data) => {
    setTasks(t => t.map(x => x.id === data.id ? { ...x, ...data } : x));
    await ent.Task.update(data.id, { title: data.title, notes: data.notes, priority: data.priority, due_date: data.due_date });
  };

  const removeGoal = async (id) => {
    setGoals(g => g.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    await ent.Goal.delete(id);
  };

  const removeTask = async (id) => {
    setTasks(t => t.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    await ent.Task.delete(id);
  };

  const toggleTask = async (task) => {
    const completed_at = !task.completed ? new Date().toISOString() : null;
    setTasks(t => t.map(x => x.id === task.id ? { ...x, completed: !x.completed, completed_at } : x));
    await ent.Task.update(task.id, { completed: !task.completed, completed_at });
  };

  const addSubTask = async (goal, text) => {
    if (!text.trim()) return;
    const updated = [...(goal.sub_tasks || []), { text: text.trim(), completed: false }];
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    setSubTaskInputs(prev => ({ ...prev, [goal.id]: "" }));
    await ent.Goal.update(goal.id, { sub_tasks: updated });
  };

  const setStepDate = async (goal, idx, date) => {
    const updated = (goal.sub_tasks || []).map((t, i) => i === idx ? { ...t, due_date: date || null } : t);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    await ent.Goal.update(goal.id, { sub_tasks: updated });
  };
  const toggleSubTask = async (goal, idx) => {
    const updated = (goal.sub_tasks || []).map((t, i) => i === idx ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null } : t);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    await ent.Goal.update(goal.id, { sub_tasks: updated });
  };

  const deleteSubTask = async (goal, idx) => {
    const updated = (goal.sub_tasks || []).filter((_, i) => i !== idx);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    await ent.Goal.update(goal.id, { sub_tasks: updated });
  };

  const goalIsDone = g => g.status === "done" || ((g.sub_tasks || []).length > 0 && (g.sub_tasks || []).every(t => t.completed));
  const activeGoals = goals.filter(g => !goalIsDone(g));
  const doneGoals = goals.filter(goalIsDone);
  const openTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const sectionOf = (t) => {
    if (!t.due_date) return "No date";
    const d = daysFrom(t.due_date);
    return d < 0 ? "Overdue" : d === 0 ? "Today" : d <= 7 ? "This week" : "Later";
  };
  const taskSections = SECTION_ORDER.map((name) => ({
    name,
    items: openTasks.filter((t) => sectionOf(t) === name).sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")),
  })).filter((x) => x.items.length > 0);
  const overdueCount = openTasks.filter((t) => sectionOf(t) === "Overdue").length;
  const weekCount = openTasks.filter((t) => ["Today", "This week"].includes(sectionOf(t))).length;

  const renderTaskRow = (t) => {
    const d = t.due_date ? daysFrom(t.due_date) : null;
    const overdue = !t.completed && d != null && d < 0;
    return (
      <div key={t.id}
        className={`w-full text-left p-3 rounded-2xl bg-card border transition-colors flex items-start gap-2 group ${selected?.id === t.id ? "border-[#A7773F]/60 shadow-sm" : "border-border/70"} ${t.completed ? "opacity-70" : ""}`}>
        <button onClick={async (e) => { e.stopPropagation(); await toggleTask(t); }} aria-label={t.completed ? "Mark not done" : "Mark done"}
          className="flex-shrink-0 w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">
          <Tick done={t.completed} />
        </button>
        <button className="flex-1 text-left min-w-0" onClick={() => { setSelected({ type: "task", id: t.id }); setEditTaskData({ ...t }); setAdding(false); }}>
          <p className={`text-[14.5px] font-medium ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {!t.completed && PRIORITY_CHIP[t.priority] && <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_CHIP[t.priority]}`}>{t.priority}</span>}
            {overdue && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#F4E6E7] text-[#8F5F65]">{-d} {-d === 1 ? "day" : "days"} overdue</span>}
            {!t.completed && d === 0 && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#F3E8D6] text-[#8A5F27]">Due today</span>}
            {t.due_date && <span className="text-[11px] text-muted-foreground">{t.completed ? "Was due " : ""}{shortDate(t.due_date)}</span>}
            {!t.due_date && !PRIORITY_CHIP[t.priority] && <span className="text-[11px] text-muted-foreground">No date</span>}
          </div>
        </button>
        <button onClick={e => { e.stopPropagation(); removeTask(t.id); }} aria-label="Delete task"
          className="flex-shrink-0 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-rose-400 transition-all p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderGoalCard = (g) => {
    const sub = g.sub_tasks || [];
    const doneCount = sub.filter(t => t.completed).length;
    const pct = sub.length > 0 ? Math.round((doneCount / sub.length) * 100) : (g.status === "done" ? 100 : 0);
    const finished = goalIsDone(g);
    const nextStep = sub.find(t => !t.completed);
    const left = g.target_date ? daysFrom(g.target_date) : null;
    const pace = finished ? null : paceOf(g, pct, left);
    const open = () => { setSelected({ type: "goal", id: g.id }); setEditGoalData({ ...g }); setAdding(false); };
    return (
      <div key={g.id} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
        className={`w-full text-left p-3.5 rounded-2xl bg-card border transition-colors cursor-pointer ${selected?.id === g.id ? "border-[#A7773F]/60 shadow-sm" : "border-border/70 hover:border-[#A7773F]/40"}`}>
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex-shrink-0">
            <svg viewBox="0 0 44 44" className="w-11 h-11 -rotate-90">
              <circle cx="22" cy="22" r="19" fill="none" stroke="#A7773F26" strokeWidth="3.5" />
              <circle cx="22" cy="22" r="19" fill="none" stroke="#A7773F" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 119.4} 119.4`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-heading text-[11px] text-foreground">{pct}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[16px] text-foreground truncate flex items-center gap-1.5">{g.focus_quarter === quarterId() && !finished && <Star className="w-3.5 h-3.5 text-[#A7773F] flex-shrink-0" strokeWidth={2} />}<span className="truncate">{g.title}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5"><span className="capitalize">{g.category}</span> · {sub.length > 0 ? `${doneCount} of ${sub.length} steps` : STATUS_LABELS[g.status]}{!finished && left != null ? ` · ${left < 0 ? `${-left}d overdue` : left === 0 ? "due today" : `${left} ${left === 1 ? "day" : "days"} left`}` : ""}</p>
          </div>
          {finished ? (
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#E4E9D5] text-[#566033] flex-shrink-0">Done</span>
          ) : pace ? (
            <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${pace === "Behind" ? "bg-[#F4E6E7] text-[#8F5F65]" : "bg-[#E4E9D5] text-[#566033]"}`}>{pace}</span>
          ) : null}
        </div>
        {!finished && nextStep && (
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2.5 min-w-0">
            <button type="button" aria-label={`Check off: ${nextStep.text}`}
              onClick={(e) => { e.stopPropagation(); toggleSubTask(g, sub.indexOf(nextStep)); }}
              className="w-5 h-5 rounded-full border-[1.5px] border-[#D9CFBF] hover:border-[#A7773F] flex-shrink-0" />
            <span className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground flex-shrink-0">Next</span>
            <span className="text-[13px] text-foreground truncate">{nextStep.text}</span>
            {nextStep.due_date && (() => { const nd = daysFrom(nextStep.due_date); return (
              <span className={`ml-auto flex-shrink-0 text-[11px] ${nd < 0 ? "text-[#8F5F65]" : nd === 0 ? "text-[#8A5F27]" : "text-muted-foreground"}`}>{nd < 0 ? "Overdue" : nd === 0 ? "Today" : shortDate(nextStep.due_date)}</span>
            ); })()}
          </div>
        )}
      </div>
    );
  };

  // ── Quarter focus ──
  const curQ = quarterId();
  const focus = activeGoals.filter((g) => g.focus_quarter === curQ);
  const later = activeGoals.filter((g) => g.focus_quarter !== curQ);
  const upcoming = [1, 2, 3].map((n) => shiftQ(curQ, n));
  const startPicking = () => { setPickSel(focus.map((g) => g.id)); setPicking(true); setPickMsg(""); };
  const togglePick = (id) => {
    setPickMsg("");
    setPickSel((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      if (sel.length >= MAX_FOCUS) { setPickMsg("3 is the limit. Unpick one first."); return sel; }
      return [...sel, id];
    });
  };
  const saveFocus = async () => {
    const changes = goals.map((g) => {
      const want = pickSel.includes(g.id);
      const has = g.focus_quarter === curQ;
      if (want && !has) return [g, { focus_quarter: curQ, quarter: curQ }];
      if (!want && has) return [g, { focus_quarter: null, quarter: null }];
      return null;
    }).filter(Boolean);
    setGoals((list) => list.map((g) => { const c = changes.find(([x]) => x.id === g.id); return c ? { ...g, ...c[1] } : g; }));
    setPicking(false);
    await Promise.all(changes.map(([g, patch]) => ent.Goal.update(g.id, patch).catch(() => {})));
  };
  const planQuarter = async (g, qid) => {
    const next = g.quarter === qid ? null : qid;
    setGoals((list) => list.map((x) => (x.id === g.id ? { ...x, quarter: next } : x)));
    try { await ent.Goal.update(g.id, { quarter: next }); } catch { /* kept on screen */ }
  };
  const QuarterChips = ({ g }) => (
    <div className="flex items-center gap-1 px-3 pb-2.5 -mt-1">
      <span className="text-[11px] text-muted-foreground mr-1">{g.quarter && upcoming.includes(g.quarter) ? "Planned for" : "Someday ·"}</span>
      {upcoming.map((qid) => (
        <button key={qid} type="button" onClick={() => planQuarter(g, qid)} aria-pressed={g.quarter === qid}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${g.quarter === qid ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "border-border text-muted-foreground"}`}>{qShort(qid, curQ)}</button>
      ))}
    </div>
  );

  const showingDetail = selected || adding;

  const pill = (on) => `px-3.5 py-1.5 rounded-full font-body text-[12.5px] font-medium transition-colors ${on ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:text-foreground"}`;
  const tabBar = (
    <div className="flex gap-1.5 px-4 pt-3 pb-1">
      {[["goals", "Goals"], ["tasks", "Tasks"], ["routines", "Routines"]].map(([k, l]) => (
        <button key={k} onClick={() => { setActiveTab(k); setSelected(null); setAdding(false); }} className={pill(activeTab === k)}>{l}</button>
      ))}
    </div>
  );

  if (activeTab === "routines") {
    return (
      <div className="max-w-[1200px] mx-auto w-full">
        <PageHeader
          title="Goals"
          subtitle="Small steps, every day."
          actions={
            <button onClick={() => setRoutineAdd((n) => n + 1)} aria-label="New routine" title="New routine"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#A7773F] text-[#F7F3EC] hover:opacity-90 transition-opacity">
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
          }
        />
        <div className="md:px-4">{tabBar}<RoutinesView addSignal={routineAdd} /></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 min-h-0 h-full">
      {/* Sidebar */}
      <div className={`w-full md:w-64 lg:w-[380px] flex-shrink-0 bg-background border-r border-border flex-col ${showingDetail ? "hidden" : "flex"}`}>
        <PageHeader
          title="Goals & Tasks"
          subtitle="Where you're headed."
          actions={
            <button
              onClick={openAdd}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#A7773F] text-[#F7F3EC] hover:opacity-90 transition-opacity"
              aria-label={`New ${activeTab === "goals" ? "goal" : "task"}`}
              title={`New ${activeTab === "goals" ? "goal" : "task"}`}
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
          }
        />

        {tabBar}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {activeTab === "goals" && (
            <>
              {picking ? (
                <div className="rounded-2xl bg-card border border-[#A7773F]/50 p-3.5">
                  <p className="text-[10.5px] tracking-[0.14em] uppercase font-semibold text-[#A7773F]">{qLabel(curQ)} · {qDaysLeft(curQ)} days left</p>
                  <p className="font-heading text-[18px] text-foreground mt-0.5">Pick this quarter's focus</p>
                  <p className="text-[12px] text-muted-foreground mb-2.5">Up to 3 goals. The rest wait for later.</p>
                  <div className="space-y-1.5">
                    {activeGoals.map((g) => {
                      const on = pickSel.includes(g.id);
                      return (
                        <button key={g.id} type="button" onClick={() => togglePick(g.id)}
                          className={`w-full flex items-center gap-2.5 text-left text-[13.5px] px-3 py-2.5 rounded-xl border transition-colors ${on ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "bg-background border-border text-foreground"}`}>
                          <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 ${on ? "bg-[#A7773F] border-[#A7773F]" : "border-border"}`}>{on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                          <span className="truncate flex-1">{g.title}</span>
                          {g.quarter === curQ && !on && <span className="text-[11px] text-muted-foreground">planned</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-destructive mt-1.5 min-h-[16px]">{pickMsg}</p>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={saveFocus} className="flex-1 h-10 rounded-xl bg-[#2E2A27] text-[#F7F3EC] text-[13.5px]">Save focus</button>
                    <button type="button" onClick={() => setPicking(false)} className="h-10 px-4 rounded-xl border border-border text-[13px] text-foreground">Cancel</button>
                  </div>
                </div>
              ) : focus.length > 0 ? (
                <>
                  <div className="px-1 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-heading text-[19px] text-foreground">This quarter</h2>
                      <span className="text-[12px] text-muted-foreground">{qLabel(curQ)} · {qDaysLeft(curQ)} days left</span>
                      <button type="button" onClick={startPicking} className="ml-auto text-[12px] text-[#A7773F]">Edit</button>
                    </div>
                  </div>
                  {focus.map(renderGoalCard)}
                  {later.length > 0 && (
                    <h3 className="font-heading text-[16px] text-foreground px-1 pt-3">Later</h3>
                  )}
                  {[...later].sort((a, b) => String(a.quarter || "9999").localeCompare(String(b.quarter || "9999"))).map((g) => (
                    <div key={g.id} className="rounded-2xl">
                      {renderGoalCard(g)}
                      <QuarterChips g={g} />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {activeGoals.length === 0 && goals.length > 0 && !adding && (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center">
                      <p className="font-heading text-[17px] text-foreground">No goals in progress</p>
                      <p className="text-[12.5px] text-muted-foreground mt-1">Add one with +, then pick up to 3 as this quarter's focus.</p>
                    </div>
                  )}
                  {activeGoals.length > 0 && (
                    <button type="button" onClick={startPicking} className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-dashed border-[#A7773F]/50 text-[13px] text-[#8A5F27]">
                      <Star className="w-4 h-4" strokeWidth={1.75} />Set this quarter's focus
                      <span className="ml-auto text-[11.5px] text-muted-foreground">{qLabel(curQ)}</span>
                    </button>
                  )}
                  {activeGoals.map(renderGoalCard)}
                </>
              )}
              {doneGoals.length > 0 && (
                <div className="pt-2">
                  <button onClick={() => setShowDoneGoals(v => !v)} className="w-full flex items-center justify-between px-1 py-1.5 text-[10.5px] tracking-[0.16em] uppercase font-semibold text-muted-foreground">
                    <span>Completed · {doneGoals.length}</span>
                    {showDoneGoals ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  </button>
                  {showDoneGoals && <div className="space-y-2.5 mt-1">{doneGoals.map(renderGoalCard)}</div>}
                </div>
              )}
              {goals.length === 0 && !adding && <p className="text-muted-foreground text-sm p-3 text-center">No goals yet. Tap + to add your first one.</p>}
            </>
          )}
          {activeTab === "tasks" && (
            <>
              {tasks.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[[overdueCount, "Overdue", overdueCount > 0], [weekCount, "Due this week", false], [completedTasks.length, "Done", false]].map(([n, label, warn]) => (
                    <div key={label} className="rounded-2xl bg-card border border-border/70 px-3 py-2.5">
                      <p className={`font-heading text-[22px] leading-none ${warn ? "text-[#8F5F65]" : "text-foreground"}`}>{n}</p>
                      <p className="text-[10.5px] text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {taskSections.map(sec => (
                <div key={sec.name}>
                  <p className="text-[10.5px] tracking-[0.16em] uppercase font-semibold text-muted-foreground px-1 mt-3 mb-2">{sec.name}</p>
                  <div className="space-y-2">{sec.items.map(renderTaskRow)}</div>
                </div>
              ))}
              {openTasks.length === 0 && tasks.length > 0 && <p className="text-muted-foreground text-sm p-3 text-center">All caught up. Nothing open.</p>}
              {completedTasks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-1 mt-3 mb-2">
                    <button onClick={() => setShowDoneTasks(v => !v)} className="flex items-center gap-1.5 text-[10.5px] tracking-[0.16em] uppercase font-semibold text-muted-foreground">
                      Done · {completedTasks.length}
                      {showDoneTasks ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    </button>
                    <button
                      onClick={async () => { if (!confirm(`Clear ${completedTasks.length} completed ${completedTasks.length === 1 ? "task" : "tasks"}?`)) return; const ids = completedTasks.map(t => t.id); setTasks(t => t.filter(x => !ids.includes(x.id))); await Promise.all(ids.map(id => ent.Task.delete(id))); }}
                      className="text-xs font-medium text-[#A7773F]"
                    >
                      Clear {completedTasks.length}
                    </button>
                  </div>
                  {showDoneTasks && <div className="space-y-2">{completedTasks.map(renderTaskRow)}</div>}
                </div>
              )}
              {tasks.length === 0 && !adding && <p className="text-muted-foreground text-sm p-3 text-center">No tasks yet. Tap + to add one.</p>}
            </>
          )}
        </div>
      </div>

      {/* Detail / Editor */}
      <div className={`flex-1 flex-col overflow-y-auto bg-background ${showingDetail ? "flex" : "hidden md:flex"}`}>

        {/* Add form */}
        {adding && (
          <div className="w-full max-w-3xl mx-auto">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 pb-4 border-b border-border flex items-center gap-2" style={{ paddingTop: "1rem" }}>
              <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="font-heading font-semibold text-foreground">New {activeTab === "goals" ? "goal" : "task"}</h2>
            </div>
            <div className="p-6 space-y-4">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={activeTab === "goals" ? "Goal title" : "Task name"}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus
              onKeyDown={e => e.key === "Enter" && (activeTab === "goals" ? addGoal() : addTask())} />
            {activeTab === "goals" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full text-sm bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Target date</label>
                  <DateInput value={targetDate} onChange={e => setTargetDate(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                    <Select value={taskPriority} onValueChange={setTaskPriority}>
                      <SelectTrigger className="w-full text-sm bg-card border-border text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Due date</label>
                    <DateInput value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                  </div>
                </div>
                <div className="quill-notes bg-card border border-border rounded-xl overflow-hidden">
                  <ReactQuill value={taskNotes} onChange={setTaskNotes} placeholder="Steps or notes (optional)" theme="snow"
                    modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }]] }} />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={activeTab === "goals" ? addGoal : addTask} className="bg-[#A7773F] text-[#F7F3EC] px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-colors">Create</button>
              <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
            </div>
            </div>
          </div>
        )}

        {/* Goal detail */}
        {!adding && selectedGoal && (() => {
          const gd = (editGoalData?.id === selectedGoal.id ? editGoalData : null) || selectedGoal;
          const sub = selectedGoal.sub_tasks || [];
          const doneCount = sub.filter(t => t.completed).length;
          const pct = sub.length > 0 ? Math.round((doneCount / sub.length) * 100) : 0;
          const setGd = (patch) => { setEditGoalData({ ...gd, ...patch }); setSaveState("saving"); };
          const qVal = gd.focus_quarter === curQ ? "focus" : gd.quarter && upcoming.includes(gd.quarter) ? gd.quarter : "someday";
          const setQ = (v) => {
            const patch = v === "focus" ? { focus_quarter: curQ, quarter: curQ } : v === "someday" ? { focus_quarter: null, quarter: null } : { focus_quarter: null, quarter: v };
            if (v === "focus" && gd.focus_quarter !== curQ && focus.length >= MAX_FOCUS) { setQMsg("This quarter already has 3 focus goals. Remove one first."); return; }
            setQMsg("");
            setGoals((list) => list.map((x) => (x.id === gd.id ? { ...x, ...patch } : x)));
            setEditGoalData({ ...gd, ...patch });
            ent.Goal.update(gd.id, patch).catch(() => {});
          };
          const moveStep = async (idx, dir) => {
            const j = idx + dir; if (j < 0 || j >= sub.length) return;
            const updated = [...sub]; [updated[idx], updated[j]] = [updated[j], updated[idx]];
            setGoals(g => g.map(x => x.id === selectedGoal.id ? { ...x, sub_tasks: updated } : x));
            await ent.Goal.update(selectedGoal.id, { sub_tasks: updated });
          };
          const iso = (d) => format(d, "yyyy-MM-dd");
          const stepRow = ({ t, idx }, i) => {
            const sd = t.due_date ? daysFrom(t.due_date) : null;
            const dating = datingStep === idx;
            return (
            <div key={idx} className={`py-2.5 ${i ? "border-t border-border/50" : ""}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => toggleSubTask(selectedGoal, idx)} aria-label={t.completed ? "Mark step not done" : "Mark step done"} className="flex-shrink-0"><Tick done={t.completed} /></button>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                {!t.completed && t.due_date && (
                  <button type="button" onClick={() => setDatingStep(dating ? null : idx)}
                    className={sd < 0 ? "mt-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#F4E6E7] text-[#8F5F65]"
                      : sd === 0 ? "mt-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#F3E8D6] text-[#8A5F27]"
                      : "mt-0.5 text-[11.5px] text-muted-foreground inline-flex items-center gap-1"}>
                    {sd < 0 ? `${-sd} ${-sd === 1 ? "day" : "days"} overdue · ${shortDate(t.due_date)}` : sd === 0 ? "Due today" : <><Calendar className="w-3 h-3" />{shortDate(t.due_date)}</>}
                  </button>
                )}
              </span>
              {editingSteps && !t.completed && !t.due_date && (
                <button onClick={() => setDatingStep(dating ? null : idx)} aria-label="Add a due date" className="p-1 text-muted-foreground flex-shrink-0"><Calendar className="w-4 h-4" strokeWidth={1.5} /></button>
              )}
              {editingSteps && (
                <span className="flex items-center gap-1 flex-shrink-0">
                  {!t.completed && <button onClick={() => moveStep(idx, -1)} aria-label="Move up" className="p-1 text-muted-foreground"><ChevronUp className="w-4 h-4" /></button>}
                  {!t.completed && <button onClick={() => moveStep(idx, 1)} aria-label="Move down" className="p-1 text-muted-foreground"><ChevronDown className="w-4 h-4" /></button>}
                  <button onClick={() => deleteSubTask(selectedGoal, idx)} aria-label="Delete step" className="p-1 text-muted-foreground/60 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
            {dating && !t.completed && (
              <div className="mt-2 ml-8 flex flex-wrap items-center gap-1.5">
                {[["Today", iso(new Date())], ["Tomorrow", iso(addDays(new Date(), 1))], ["Next week", iso(addDays(new Date(), 7))]].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => { setStepDate(selectedGoal, idx, v); setDatingStep(null); }}
                    className={`text-[12px] px-3 py-1 rounded-full border ${t.due_date === v ? "bg-[#A7773F] border-[#A7773F] text-[#F7F3EC]" : "border-border text-muted-foreground bg-card"}`}>{l}</button>
                ))}
                <div className="w-[150px]">
                  <DateInput value={t.due_date || ""} onChange={(e) => { setStepDate(selectedGoal, idx, e.target.value); if (e.target.value) setDatingStep(null); }} className="h-8 text-[12.5px] rounded-full" />
                </div>
                {t.due_date && <button type="button" onClick={() => { setStepDate(selectedGoal, idx, null); setDatingStep(null); }} className="text-[12px] px-2 py-1 text-muted-foreground">Clear</button>}
              </div>
            )}
            </div>
            );
          };
          const openSteps = sub.map((t, idx) => ({ t, idx })).filter(({ t }) => !t.completed);
          const doneSteps = sub.map((t, idx) => ({ t, idx })).filter(({ t }) => t.completed);
          return (
            <div className="w-full max-w-3xl mx-auto">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-5 pb-3 border-b border-border flex items-center gap-2" style={{ paddingTop: "1rem" }}>
                <button onClick={() => { if (saveState === "saving" && editGoalData?.id) saveGoal(editGoalData); setSelected(null); }} aria-label="Back" className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 -ml-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <input
                  value={gd.title}
                  onChange={e => setGd({ title: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent border-0 text-foreground text-[22px] font-heading px-0 py-1 outline-none"
                />
                <div className="relative flex-shrink-0">
                  <button onClick={() => setGoalMenu((v) => !v)} aria-label="More options" className="p-1.5 text-muted-foreground hover:text-foreground"><MoreHorizontal className="w-5 h-5" /></button>
                  {goalMenu && (
                    <div className="absolute right-0 top-9 z-20 bg-card border border-border rounded-xl shadow-lg py-1 w-40">
                      <button onClick={() => { setGoalMenu(false); if (confirm("Delete this goal?")) removeGoal(selectedGoal.id); }} className="w-full text-left px-3.5 py-2 text-sm text-[#8F5F65] flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Delete goal</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-5 py-4 flex flex-col gap-4">

              <div className="flex flex-wrap items-center gap-2">
                <Select value={gd.category || "personal"} onValueChange={v => setGd({ category: v })}>
                  <SelectTrigger className="w-auto text-[12.5px] h-8 px-3 gap-1.5 bg-card border border-border rounded-full capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={gd.status || "in_progress"} onValueChange={v => setGd({ status: v })}>
                  <SelectTrigger className="w-auto text-[12.5px] h-8 px-3 gap-1.5 bg-card border border-border rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 h-8 pl-3 pr-1 bg-card border border-border rounded-full text-[12.5px] text-muted-foreground">
                  Target
                  <DateInput value={gd.target_date || ""} onChange={e => setGd({ target_date: e.target.value })}
                    className="text-[12.5px] text-foreground bg-transparent outline-none border-0 px-1 py-0 h-7" />
                </label>
              </div>

              <div>
                <p className="text-[10.5px] tracking-[0.14em] uppercase font-semibold text-muted-foreground mb-1.5">Quarter</p>
                <div className="flex flex-wrap gap-1.5">
                  {[["focus", `★ This quarter`], ...upcoming.map((q) => [q, qShort(q, curQ)]), ["someday", "Someday"]].map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setQ(v)} aria-pressed={qVal === v}
                      className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${qVal === v ? "bg-[#2E2A27] border-[#2E2A27] text-[#F7F3EC]" : "border-border text-muted-foreground bg-card"}`}>{label}</button>
                  ))}
                </div>
                {qMsg && <p className="text-[12px] text-destructive mt-1">{qMsg}</p>}
              </div>

              <div>
                <div className="flex items-baseline gap-3 mb-1.5">
                  <p className="text-[10.5px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">Steps</p>
                  <span className="ml-auto text-xs text-muted-foreground">{doneCount} of {sub.length}</span>
                  {sub.length > 0 && <button onClick={() => setEditingSteps((v) => !v)} className="text-xs text-[#A7773F]">{editingSteps ? "Done" : "Edit"}</button>}
                </div>
                {sub.length > 0 && (
                  <div className="h-1 rounded-full bg-[#EFE8DC] overflow-hidden mb-2">
                    <div className="h-full rounded-full bg-[#A7773F] transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="bg-card border border-border rounded-2xl px-3.5">
                  {openSteps.map(stepRow)}
                  {doneSteps.length > 0 && (
                    <button onClick={() => setShowDoneSteps(v => !v)} className={`w-full flex items-center gap-1.5 py-2.5 text-[10.5px] tracking-[0.16em] uppercase font-semibold text-muted-foreground ${openSteps.length ? "border-t border-border/50" : ""}`}>
                      Done · {doneSteps.length}
                      {showDoneSteps ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    </button>
                  )}
                  {showDoneSteps && doneSteps.map((x) => stepRow(x, 1))}
                  <div className={`flex items-center gap-2.5 py-2 ${sub.length ? "border-t border-border/50" : ""}`}>
                    <Plus className="w-4 h-4 text-[#A7773F] flex-shrink-0 ml-0.5" />
                    <input
                      value={subTaskInputs[selectedGoal.id] || ""}
                      onChange={e => setSubTaskInputs(prev => ({ ...prev, [selectedGoal.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addSubTask(selectedGoal, subTaskInputs[selectedGoal.id] || "")}
                      placeholder="Add a step"
                      enterKeyHint="done"
                      className="flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-[#A7773F]/80"
                    />
                    {(subTaskInputs[selectedGoal.id] || "").trim() && (
                      <button onClick={() => addSubTask(selectedGoal, subTaskInputs[selectedGoal.id] || "")} className="text-[12.5px] font-medium text-[#A7773F] px-1">Add</button>
                    )}
                  </div>
                </div>
              </div>

              {notesOpen || (gd.notes && gd.notes !== "<p><br></p>") ? (
                <div className="bg-card rounded-xl overflow-hidden border border-border quill-notes">
                  <ReactQuill theme="snow" value={gd.notes || ""} placeholder="Notes" onChange={val => { if (val !== (gd.notes || "")) setGd({ notes: val }); }}
                    modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }]] }} style={{ minHeight: "120px" }} />
                </div>
              ) : (
                <button onClick={() => setNotesOpen(true)} className="flex items-center gap-2 px-3.5 py-3 bg-card border border-border rounded-2xl text-[13px] text-muted-foreground text-left">
                  <StickyNote className="w-4 h-4" />Add notes
                </button>
              )}

              <p className="text-center text-[12px] text-muted-foreground flex items-center justify-center gap-1.5 min-h-[18px]">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? <><Check className="w-3.5 h-3.5 text-[#7D8A53]" />Saved</> : ""}
              </p>
              </div>
            </div>
          );
        })()}

        {/* Task detail */}
        {!adding && selectedTask && (() => {
          const td = editTaskData?.id === selectedTask.id ? editTaskData : selectedTask;
          return (
            <div className="w-full max-w-3xl mx-auto">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 pb-4 border-b border-border flex items-center justify-between" style={{ paddingTop: "1rem" }}>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mr-2 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                  <button onClick={() => toggleTask(selectedTask)} className="flex-shrink-0">
                    <Tick done={selectedTask.completed} size={22} />
                  </button>
                  <input
                    value={td.title}
                    onChange={e => setEditTaskData({ ...td, title: e.target.value })}
                    className={`flex-1 bg-transparent border-0 border-b border-border text-foreground text-xl font-heading px-0 py-1 outline-none focus:border-ring transition-colors ${selectedTask.completed ? "line-through text-muted-foreground" : ""}`}
                  />
                </div>
                <button onClick={() => removeTask(selectedTask.id)} className="text-muted-foreground/40 hover:text-rose-400 ml-4 flex-shrink-0 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">

              <div className="flex flex-wrap items-center gap-2">
                <Select value={td.priority || "normal"} onValueChange={v => setEditTaskData({ ...td, priority: v })}>
                  <SelectTrigger className="text-xs h-8 px-3 bg-card border border-border rounded-full capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <DateInput value={td.due_date || ""} onChange={e => setEditTaskData({ ...td, due_date: e.target.value })}
                    className="text-xs text-muted-foreground bg-transparent outline-none" />
                </div>
              </div>

              <div className="bg-card rounded-xl overflow-hidden border border-border quill-notes">
                <ReactQuill theme="snow" value={td.notes || ""} onChange={val => setEditTaskData({ ...td, notes: val })}
                  modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }]] }}
                  style={{ minHeight: "200px" }} />
              </div>

              <button onClick={() => saveTask(td)} className="self-start bg-[#A7773F] text-[#F7F3EC] px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-colors">Save</button>
              </div>
            </div>
          );
        })()}

        {/* Empty state: overview */}
        {!adding && !selected && (() => {
          const dueSoon = openTasks.filter(t => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 4);
          const openGoalCount = activeGoals.length;
          const todayISO = new Date().toLocaleDateString("en-CA");
          return (
            <div className="w-full max-w-3xl mx-auto px-8 py-10">
              <h2 className="font-heading text-[26px] text-foreground leading-tight">Overview</h2>
              <p className="font-heading italic text-[15px] text-muted-foreground mt-0.5">Your goals and tasks at a glance. Pick one on the left to open it.</p>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[["Goals in progress", openGoalCount], ["Goals completed", doneGoals.length], ["Tasks to do", openTasks.length]].map(([label, n]) => (
                  <div key={label} className="bg-card border border-border rounded-2xl p-4">
                    <p className="font-heading text-[28px] text-foreground leading-none">{n}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
                  </div>
                ))}
              </div>
              <h3 className="font-heading text-[18px] text-foreground mt-8 mb-2.5">Tasks with due dates</h3>
              {dueSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing with a due date yet.</p>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  {dueSoon.map((t, i) => (
                    <button key={t.id} onClick={() => { setActiveTab("tasks"); setSelected({ type: "task", id: t.id }); setEditTaskData({ ...t }); setAdding(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}>
                      <span className="text-sm text-foreground truncate">{t.title}</span>
                      <span className={`text-xs flex-shrink-0 ${t.due_date < todayISO ? "text-[#8B5A44]" : "text-muted-foreground"}`}>{t.due_date < todayISO ? "Overdue · " : ""}{parseISO(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={openAdd} className="mt-6 inline-flex items-center gap-1.5 bg-[#A7773F] text-[#F7F3EC] px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> New {activeTab === "goals" ? "goal" : "task"}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
    </>
  );
}