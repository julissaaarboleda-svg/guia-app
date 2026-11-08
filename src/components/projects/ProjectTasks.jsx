import { nameFor, firstNameFor, initialsFor as initialsOf } from "@/lib/collab";
import { useState, useMemo, useEffect, Fragment } from "react";
import { Plus, Trash2, SlidersHorizontal, DollarSign, Check, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import DateInput from "@/components/DateInput";

const CHIP_COLORS = ["#A7773F", "#7D8A53", "#A77C81", "#6B655D", "#8A6530"];
function colorForPerson(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}

// Tasks can now have more than one assignee. Older tasks only ever had a
// single `assignee` string — this reads either shape so nothing existing
// breaks.
function assigneesFor(task, currentEmail) {
  if (Array.isArray(task.assignees) && task.assignees.length > 0) return task.assignees;
  if (task.assignee) return [task.assignee];
  return [currentEmail];
}

function dueDateInfo(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  const label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < 0) return { label: `Overdue · ${label}`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days <= 3) return { label: `Due in ${days} day${days > 1 ? "s" : ""}`, tone: "soon" };
  return { label: `Due ${label}`, tone: "normal" };
}

export default function ProjectTasks({ tasks, collaborators, names = {}, currentEmail, onAdd, onToggle, onRemove, onReassign, onAddToBudget, onUpdateTask }) {
  const [name, setName] = useState("");
  const [assignees, setAssignees] = useState([currentEmail]);
  const [dueDate, setDueDate] = useState("");
  const [addToBudget, setAddToBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [filter, setFilter] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [groupByDue, setGroupByDue] = useState(false);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("guia-task-view") || "{}");
      if (saved.hideCompleted) setHideCompleted(true);
      if (saved.groupByDue) setGroupByDue(true);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("guia-task-view", JSON.stringify({ hideCompleted, groupByDue })); } catch {}
  }, [hideCompleted, groupByDue]);
  const [showForm, setShowForm] = useState(false);
  const [reassigningIdx, setReassigningIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const startEdit = (t) => {
    setEditingIdx(t._idx);
    setEditTitle(t.title || "");
    setEditDueDate(t.due_date || "");
  };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdateTask(editingIdx, { title: editTitle.trim(), due_date: editDueDate || null });
    setEditingIdx(null);
  };

  const toggleAssignee = (email) => {
    setAssignees((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const submit = () => {
    if (!name.trim()) return;
    const finalAssignees = assignees.length > 0 ? assignees : [currentEmail];
    onAdd({ title: name.trim(), assignees: finalAssignees, due_date: dueDate || null });

    const amt = parseFloat(budgetAmount);
    if (addToBudget && amt > 0) {
      onAddToBudget({ name: name.trim(), amount: amt, paid_by: finalAssignees });
    }

    setName("");
    setAssignees([currentEmail]);
    setDueDate("");
    setAddToBudget(false);
    setBudgetAmount("");
    setShowForm(false);
  };

  const today0 = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const scoped = useMemo(() => {
    const withIdx = tasks.map((t, i) => ({ ...t, _idx: i }));
    return filter === "all" ? withIdx : withIdx.filter((t) => assigneesFor(t, currentEmail).includes(filter));
  }, [tasks, filter, currentEmail]);

  const daysUntil = (t) => (t.due_date ? Math.round((new Date(t.due_date + "T00:00:00") - today0) / 86400000) : null);
  const byDue = (a, b) => {
    const da = a.due_date || "9999", db = b.due_date || "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  };

  // Sections: Overdue first, then the rest of the open work (optionally split by
  // when it's due), then Done — collapsed so finished work stops crowding the list.
  const sections = useMemo(() => {
    const open = scoped.filter((t) => !t.completed);
    const done = scoped.filter((t) => t.completed);
    const overdue = open.filter((t) => daysUntil(t) !== null && daysUntil(t) < 0).sort(byDue);
    const rest = open.filter((t) => !(daysUntil(t) !== null && daysUntil(t) < 0));
    const out = [];
    if (overdue.length) out.push({ key: "overdue", label: "Overdue", tone: "overdue", items: overdue });
    if (groupByDue) {
      const g = { today: [], week: [], later: [], none: [] };
      rest.forEach((t) => {
        const d = daysUntil(t);
        (d === null ? g.none : d === 0 ? g.today : d <= 7 ? g.week : g.later).push(t);
      });
      [["today", "Today"], ["week", "This week"], ["later", "Later"], ["none", "No date"]].forEach(([k, label]) => {
        if (g[k].length) out.push({ key: k, label, items: g[k].sort(byDue) });
      });
    } else if (rest.length) {
      out.push({ key: "todo", label: overdue.length ? "To do" : null, items: rest });
    }
    if (done.length && !hideCompleted) out.push({ key: "done", label: "Done", done: true, items: done });
    return out;
  }, [scoped, groupByDue, hideCompleted, today0]);

  const visibleCount = sections.reduce((n, sec) => n + sec.items.length, 0);
  const filterActive = filter !== "all" || hideCompleted || groupByDue;

  const countFor = (email) => tasks.filter((t) => assigneesFor(t, currentEmail).includes(email)).length;

  const toggleTaskAssignee = (idx, email) => {
    const current = assigneesFor(tasks[idx], currentEmail);
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    onReassign(idx, next.length > 0 ? next : [currentEmail]);
  };

  const renderRow = (t) => {
          if (editingIdx === t._idx) {
            return (
              <div className="py-2.5 border-t border-border">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                  className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring mb-2"
                />
                <div className="mb-2">
                  <DateInput value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 text-white py-1.5 rounded-lg text-xs font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
                    Save
                  </button>
                  <button onClick={() => setEditingIdx(null)} className="px-3 py-1.5 text-muted-foreground text-xs hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            );
          }
          const due = t.completed ? null : dueDateInfo(t.due_date);
          const people = assigneesFor(t, currentEmail);
          return (
            <div className="flex items-center gap-3 py-2 border-t border-border">
              <button onClick={() => onToggle(t._idx)} className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${t.completed ? "bg-[#A7773F] border-[#A7773F]" : "border-input"}`}>
                {t.completed && <span className="text-white text-[10px]">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${t.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                {due && (
                  <span className={`text-[10.5px] font-medium ${due.tone === "overdue" ? "text-rose-600" : due.tone === "soon" ? "text-accent" : "text-muted-foreground"}`}>
                    {due.label}
                  </span>
                )}
              </div>
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setReassigningIdx(reassigningIdx === t._idx ? null : t._idx)}
                  className="flex items-center -space-x-1.5"
                  title={people.map((e) => (e === currentEmail ? "Me" : e)).join(", ") + " — tap to change"}
                >
                  {people.slice(0, 3).map((email, i) => (
                    <span
                      key={email}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-card"
                      style={{ background: colorForPerson(email), zIndex: 3 - i }}
                    >
                      {initialsOf(email, names, currentEmail)}
                    </span>
                  ))}
                  {people.length > 3 && (
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold border-2 border-card bg-muted-foreground">
                      +{people.length - 3}
                    </span>
                  )}
                </button>
                {reassigningIdx === t._idx && (
                  <>
                    <div className="fixed inset-0 z-[9]" onClick={() => setReassigningIdx(null)} />
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[150px]">
                      <button
                        onClick={() => toggleTaskAssignee(t._idx, currentEmail)}
                        className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-secondary"
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${people.includes(currentEmail) ? "bg-accent border-accent" : "border-input"}`}>
                          {people.includes(currentEmail) && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={people.includes(currentEmail) ? "font-semibold text-foreground" : "text-muted-foreground"}>Me</span>
                      </button>
                      {collaborators.filter((c) => c !== currentEmail).map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleTaskAssignee(t._idx, c)}
                          className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-secondary"
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${people.includes(c) ? "bg-accent border-accent" : "border-input"}`}>
                            {people.includes(c) && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className={`truncate ${people.includes(c) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{nameFor(c, names)}</span>
                        </button>
                      ))}
                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          onClick={() => setReassigningIdx(null)}
                          className="w-full text-center px-3 py-1.5 text-xs font-medium text-accent hover:bg-secondary"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => startEdit(t)} className="text-muted-foreground/50 hover:text-foreground flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onRemove(t._idx)} className="text-muted-foreground/50 hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        };

  return (
    <div>
      {/* Header: count + single Filter icon (popover holds person / hide done / grouping) */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {scoped.filter((t) => !t.completed).length} open · {scoped.filter((t) => t.completed).length} done
          {filter !== "all" && <span> · {filter === currentEmail ? "My tasks" : `${firstNameFor(filter, names)}'s`}</span>}
        </p>
        <div className="relative">
          <button
            onClick={() => setShowFilter((v) => !v)}
            aria-label="Filter tasks"
            className="relative w-8 h-8 flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {filterActive && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: "#A7773F" }} />}
          </button>
          {showFilter && (
            <>
              <div className="fixed inset-0 z-[9]" onClick={() => setShowFilter(false)} />
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 py-2 w-56">
                <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Show</p>
                {[["all", `All tasks (${tasks.length})`], ...(currentEmail ? [[currentEmail, `My tasks (${countFor(currentEmail)})`]] : []),
                  ...collaborators.filter((c) => c !== currentEmail).map((c) => [c, `${firstNameFor(c, names)}'s (${countFor(c)})`])].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilter(val)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-secondary text-left"
                  >
                    <span className={filter === val ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
                    {filter === val && <Check className="w-3.5 h-3.5" style={{ color: "#A7773F" }} />}
                  </button>
                ))}
                <div className="border-t border-border my-1.5" />
                {[["Hide completed", hideCompleted, setHideCompleted], ["Group by due date", groupByDue, setGroupByDue]].map(([label, on, set]) => (
                  <button key={label} onClick={() => set(!on)} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-secondary">
                    <span className="text-foreground">{label}</span>
                    <span className="w-8 h-4 rounded-full relative transition-colors" style={{ backgroundColor: on ? "#A7773F" : "#E7E2D8" }}>
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? "18px" : "2px" }} />
                    </span>
                  </button>
                ))}
                {filterActive && (
                  <button
                    onClick={() => { setFilter("all"); setHideCompleted(false); setGroupByDue(false); }}
                    className="w-full text-left px-3 pt-2 pb-1 text-xs font-medium"
                    style={{ color: "#A7773F" }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add task — collapsed behind a button until tapped */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-2.5 text-sm font-medium mb-3 transition-colors"
          style={{ borderColor: "#A7773F", color: "#A7773F" }}
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      ) : (
        <div className="mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Task name"
            autoFocus
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring mb-2"
          />

          <label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">Due date</label>
          <div className="mb-2">
            <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <label className="text-[10px] text-muted-foreground mb-1 block">Assign to</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => toggleAssignee(currentEmail)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${assignees.includes(currentEmail) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-input"}`}
              style={assignees.includes(currentEmail) ? { backgroundColor: colorForPerson(currentEmail) } : undefined}
            >
              {assignees.includes(currentEmail) && <Check className="w-3 h-3" />} Me
            </button>
            {collaborators.filter((c) => c !== currentEmail).map((c) => (
              <button
                key={c}
                onClick={() => toggleAssignee(c)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${assignees.includes(c) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-input"}`}
                style={assignees.includes(c) ? { backgroundColor: colorForPerson(c) } : undefined}
              >
                {assignees.includes(c) && <Check className="w-3 h-3" />} {nameFor(c, names)}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground mb-2 cursor-pointer">
            <input type="checkbox" checked={addToBudget} onChange={(e) => setAddToBudget(e.target.checked)} className="w-3.5 h-3.5 accent-accent" />
            Also add to budget
          </label>
          {addToBudget && (
            <div className="relative mb-3">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-muted border border-input rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-ring"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
              <Plus className="w-4 h-4" /> Add Task
            </button>
            <button onClick={() => { setShowForm(false); setName(""); setAssignees([currentEmail]); setDueDate(""); setAddToBudget(false); setBudgetAmount(""); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-1 mt-2">
        {sections.map((sec) => {
          const collapsed = sec.done && !showDone;
          return (
            <Fragment key={sec.key}>
              {sec.label && (
                <button
                  disabled={!sec.done}
                  onClick={() => sec.done && setShowDone((v) => !v)}
                  className="w-full flex items-center gap-2 pt-3 pb-1 text-left"
                >
                  {sec.done && (collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}
                  <span className={`text-xs font-medium ${sec.tone === "overdue" ? "text-rose-600" : "text-muted-foreground"}`}>
                    {sec.label} · {sec.items.length}
                  </span>
                  <div className="h-px bg-border flex-1" />
                </button>
              )}
              {!collapsed && sec.items.map((t) => <Fragment key={t._idx}>{renderRow(t)}</Fragment>)}
            </Fragment>
          );
        })}
        {visibleCount === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tasks {filterActive ? "for this filter" : "yet"}.</p>}
      </div>
    </div>
  );
}
