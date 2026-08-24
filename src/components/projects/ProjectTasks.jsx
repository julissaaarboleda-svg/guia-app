import { useState, useMemo } from "react";
import { Plus, Trash2, SlidersHorizontal, User, DollarSign, Check } from "lucide-react";
import DateInput from "@/components/DateInput";

const CHIP_COLORS = ["#A7773F", "#7D8A53", "#A77C81", "#6B655D", "#8A6530"];
function colorForPerson(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}
function initialsFor(email, currentEmail) {
  if (email === currentEmail) return "Me".slice(0, 2).toUpperCase();
  const namePart = email.split("@")[0];
  return namePart.slice(0, 2).toUpperCase();
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

export default function ProjectTasks({ tasks, collaborators, currentEmail, onAdd, onToggle, onRemove, onReassign, onAddToBudget }) {
  const [name, setName] = useState("");
  const [assignees, setAssignees] = useState([currentEmail]);
  const [dueDate, setDueDate] = useState("");
  const [addToBudget, setAddToBudget] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reassigningIdx, setReassigningIdx] = useState(null);

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

  const filtered = useMemo(() => {
    const withIdx = tasks.map((t, i) => ({ ...t, _idx: i }));
    if (filter === "all") return withIdx;
    return withIdx.filter((t) => assigneesFor(t, currentEmail).includes(filter));
  }, [tasks, filter, currentEmail]);

  const countFor = (email) => tasks.filter((t) => assigneesFor(t, currentEmail).includes(email)).length;

  const toggleTaskAssignee = (idx, email) => {
    const current = assigneesFor(tasks[idx], currentEmail);
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    onReassign(idx, next.length > 0 ? next : [currentEmail]);
  };

  return (
    <div>
      {/* Filter row */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === "all" ? "text-white border-transparent" : "bg-card text-foreground border-border"}`}
            style={filter === "all" ? { backgroundColor: "#A7773F" } : undefined}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter(currentEmail)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === currentEmail ? "text-white border-transparent" : "bg-card text-foreground border-border"}`}
            style={filter === currentEmail ? { backgroundColor: "#A7773F" } : undefined}
          >
            My Tasks ({countFor(currentEmail)})
          </button>
        </div>
        {collaborators.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAssigneeFilter((s) => !s)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border bg-card text-foreground"
            >
              <SlidersHorizontal className="w-3 h-3" /> Filter
            </button>
            {showAssigneeFilter && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                {collaborators.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setFilter(c); setShowAssigneeFilter(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary ${filter === c ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                  >
                    {c.split("@")[0]}'s ({countFor(c)})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
                {assignees.includes(c) && <Check className="w-3 h-3" />} {c.split("@")[0]}
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
      <div className="flex items-center gap-2 mt-4 mb-1">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{filtered.length} Task{filtered.length !== 1 ? "s" : ""}</span>
        <div className="h-px bg-border flex-1" />
      </div>
      <div className="space-y-1">
        {filtered.map((t) => {
          const due = dueDateInfo(t.due_date);
          const people = assigneesFor(t, currentEmail);
          return (
            <div key={t._idx} className="flex items-center gap-3 py-2 border-t border-border">
              <button onClick={() => onToggle(t._idx)} className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${t.completed ? "bg-green-600 border-green-600" : "border-input"}`}>
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
                      {initialsFor(email, currentEmail)}
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
                          <span className={`truncate ${people.includes(c) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{c.split("@")[0]}</span>
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
              <button onClick={() => onRemove(t._idx)} className="text-muted-foreground/50 hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tasks {filter !== "all" ? "for this filter" : "yet"}.</p>}
      </div>
    </div>
  );
}
