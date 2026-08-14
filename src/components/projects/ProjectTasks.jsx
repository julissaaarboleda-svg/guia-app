import { useState, useMemo } from "react";
import { Plus, Trash2, SlidersHorizontal, User } from "lucide-react";
import DateInput from "@/components/DateInput";

// Avatar chip color — same small palette used elsewhere in the app (Notes'
// collectionAccents.js), applied per-person so the same person always gets
// the same color across the whole project.
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

// Props confirmed from ProjectDetail.jsx. Matches the real UI seen in the original
// screenshots: task name input + assignee dropdown + Add Task button, then rows —
// now with a real due-date field, avatar-chip assignees, and a My Tasks filter.
export default function ProjectTasks({ tasks, collaborators, currentEmail, onAdd, onToggle, onRemove }) {
  const [name, setName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ title: name.trim(), assignee: assignee || currentEmail, due_date: dueDate || null });
    setName("");
    setAssignee("");
    setDueDate("");
  };

  const filtered = useMemo(() => {
    if (filter === "all") return tasks.map((t, i) => ({ ...t, _idx: i }));
    return tasks.map((t, i) => ({ ...t, _idx: i })).filter((t) => t.assignee === filter);
  }, [tasks, filter]);

  const countFor = (email) => tasks.filter((t) => t.assignee === email).length;

  return (
    <div>
      {/* Filter row */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === "all" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"}`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter(currentEmail)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === currentEmail ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"}`}
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

      {/* Add task form */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Task name"
        className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring mb-2"
      />
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="min-w-0">
          <label className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">Due date</label>
          <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label className="text-[10px] text-muted-foreground mb-1 block">Assign to</label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full bg-muted border border-input rounded-lg pl-8 pr-2.5 py-1.5 text-sm outline-none focus:border-ring appearance-none">
              <option value={currentEmail}>Me</option>
              {collaborators.map((c) => <option key={c} value={c}>{c.split("@")[0]}</option>)}
            </select>
          </div>
        </div>
      </div>
      <button onClick={submit} className="w-full flex items-center justify-center gap-1.5 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 mb-3">
        <Plus className="w-4 h-4" /> Add Task
      </button>

      {/* Task list */}
      <div className="flex items-center gap-2 mt-4 mb-1">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{filtered.length} Task{filtered.length !== 1 ? "s" : ""}</span>
        <div className="h-px bg-border flex-1" />
      </div>
      <div className="space-y-1">
        {filtered.map((t) => {
          const due = dueDateInfo(t.due_date);
          const email = t.assignee || currentEmail;
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
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                style={{ background: colorForPerson(email) }}
                title={email === currentEmail ? "Me" : email}
              >
                {initialsFor(email, currentEmail)}
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
