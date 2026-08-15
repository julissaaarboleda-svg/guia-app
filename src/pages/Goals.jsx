import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, CheckCircle2, Circle, X, Calendar, ArrowLeft, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import ActionCircle from "@/components/ActionCircle";
import DateInput from "@/components/DateInput";
import PageHeader from "@/components/PageHeader";

const STATUS_STYLES = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-muted text-foreground",
  done:        "bg-green-50 text-green-700",
};
const STATUS_LABELS = { not_started: "Not started", in_progress: "In progress", done: "Done" };
const CATEGORIES = ["personal", "finance", "career", "business", "health", "travel"];
const PRIORITY_COLORS = { urgent: "text-rose-600", high: "text-amber-600", normal: "text-muted-foreground", low: "text-muted-foreground" };

export default function Goals() {
  const [activeTab, setActiveTab] = useState("goals");
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null); // { type: "goal"|"task", id }
  const [subTaskInputs, setSubTaskInputs] = useState({});

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
      base44.entities.Goal.list("-created_date"),
      base44.entities.Task.list("-created_date"),
    ]);
    setGoals(g);
    setTasks(t);
  };

  useEffect(() => { load(); }, []);

  const selectedGoal = selected?.type === "goal" ? goals.find(g => g.id === selected.id) : null;
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
      const real = await base44.entities.Goal.create({ title: optimistic.title, category: optimistic.category, status: "in_progress", target_date: optimistic.target_date });
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
      const real = await base44.entities.Task.create({ title: optimistic.title, notes: optimistic.notes, priority: optimistic.priority, due_date: optimistic.due_date, completed: false });
      setTasks(t => t.map(x => x.id === tempId ? real : x));
    } catch {
      setTasks(t => t.filter(x => x.id !== tempId));
    }
  };

  const saveGoal = async (data) => {
    setGoals(g => g.map(x => x.id === data.id ? { ...x, ...data } : x));
    await base44.entities.Goal.update(data.id, { title: data.title, category: data.category, target_date: data.target_date, status: data.status });
  };

  const saveTask = async (data) => {
    setTasks(t => t.map(x => x.id === data.id ? { ...x, ...data } : x));
    await base44.entities.Task.update(data.id, { title: data.title, notes: data.notes, priority: data.priority, due_date: data.due_date });
  };

  const removeGoal = async (id) => {
    setGoals(g => g.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    await base44.entities.Goal.delete(id);
  };

  const removeTask = async (id) => {
    setTasks(t => t.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    await base44.entities.Task.delete(id);
  };

  const toggleTask = async (task) => {
    setTasks(t => t.map(x => x.id === task.id ? { ...x, completed: !x.completed } : x));
    await base44.entities.Task.update(task.id, { completed: !task.completed });
  };

  const addSubTask = async (goal, text) => {
    if (!text.trim()) return;
    const updated = [...(goal.sub_tasks || []), { text: text.trim(), completed: false }];
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    setSubTaskInputs(prev => ({ ...prev, [goal.id]: "" }));
    await base44.entities.Goal.update(goal.id, { sub_tasks: updated });
  };

  const toggleSubTask = async (goal, idx) => {
    const updated = (goal.sub_tasks || []).map((t, i) => i === idx ? { ...t, completed: !t.completed } : t);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    await base44.entities.Goal.update(goal.id, { sub_tasks: updated });
  };

  const deleteSubTask = async (goal, idx) => {
    const updated = (goal.sub_tasks || []).filter((_, i) => i !== idx);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, sub_tasks: updated } : x));
    await base44.entities.Goal.update(goal.id, { sub_tasks: updated });
  };

  const activeGoals = goals.filter(g => g.status !== "done");
  const doneGoals = goals.filter(g => g.status === "done");
  const openTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const showingDetail = selected || adding;

  return (
    <>
      <div className="flex flex-1 min-h-0 h-full">
      {/* Sidebar */}
      <div className={`w-full md:w-64 lg:w-72 flex-shrink-0 bg-background border-r border-border flex-col ${showingDetail ? "hidden" : "flex"}`}>
        <PageHeader title="Goals & Tasks" />

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-border">
          <button onClick={() => { setActiveTab("goals"); setSelected(null); setAdding(false); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "goals" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
            Goals
          </button>
          <button onClick={() => { setActiveTab("tasks"); setSelected(null); setAdding(false); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "tasks" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
            Tasks
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeTab === "goals" && (
            <>
              {[...activeGoals, ...doneGoals].map(g => {
                const sub = g.sub_tasks || [];
                const doneCount = sub.filter(t => t.completed).length;
                const pct = sub.length > 0 ? Math.round((doneCount / sub.length) * 100) : 0;
                return (
                  <button key={g.id} onClick={() => { setSelected({ type: "goal", id: g.id }); setEditGoalData({ ...g }); setAdding(false); }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${selected?.id === g.id ? "bg-card border border-border text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                    <p className="text-sm font-medium truncate">{g.title}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{g.category} · {STATUS_LABELS[g.status]}</p>
                    {sub.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "#A7773F26" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#A7773F" }} />
                        </div>
                        <span className="text-[10.5px] text-muted-foreground flex-shrink-0">{doneCount}/{sub.length}</span>
                      </div>
                    )}
                  </button>
                );
              })}
              {goals.length === 0 && !adding && <p className="text-muted-foreground text-xs p-3">No goals yet</p>}
            </>
          )}
          {activeTab === "tasks" && (
            <>
              {completedTasks.length > 0 && (
                <div className="flex justify-end px-2 pt-1">
                  <button
                    onClick={async () => { const ids = completedTasks.map(t => t.id); setTasks(t => t.filter(x => !ids.includes(x.id))); await Promise.all(ids.map(id => base44.entities.Task.delete(id))); }}
                    className="text-xs text-muted-foreground hover:text-rose-400 transition-colors"
                  >
                    Clear completed
                  </button>
                </div>
              )}
              {[...openTasks, ...completedTasks].map(t => (
                <div key={t.id}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-2 group ${selected?.id === t.id ? "bg-card border border-border text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  {/* Clickable checkbox — doesn't open detail */}
                  <button
                    onClick={async (e) => { e.stopPropagation(); await toggleTask(t); }}
                    className="flex-shrink-0 w-8 h-8 -ml-1 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
                  >
                    {t.completed
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <Circle className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {/* Rest of row opens detail */}
                  <button className="flex-1 text-left min-w-0" onClick={() => { setSelected({ type: "task", id: t.id }); setEditTaskData({ ...t }); setAdding(false); }}>
                    <p className={`text-sm font-medium truncate ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                    <p className={`text-xs mt-0.5 capitalize ${PRIORITY_COLORS[t.priority || "normal"]}`}>
                      {t.priority || "normal"}{t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </p>
                  </button>
                  {/* Individual delete */}
                  <button
                    onClick={e => { e.stopPropagation(); removeTask(t.id); }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-rose-400 transition-all p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {tasks.length === 0 && !adding && <p className="text-muted-foreground text-xs p-3">No tasks yet</p>}
            </>
          )}
        </div>
      </div>

      {/* Detail / Editor */}
      <div className={`flex-1 flex-col overflow-y-auto bg-background ${showingDetail ? "flex" : "hidden md:flex"}`}>

        {/* Add form */}
        {adding && (
          <div className="w-full max-w-3xl mx-auto">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 pb-4 border-b border-border flex items-center gap-2" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
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
              <button onClick={activeTab === "goals" ? addGoal : addTask} className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Create</button>
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
          return (
            <div className="w-full max-w-3xl mx-auto">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 pb-4 border-b border-border flex items-center justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mr-2 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <input
                  value={gd.title}
                  onChange={e => setEditGoalData({ ...gd, title: e.target.value })}
                  className="flex-1 bg-transparent border-0 border-b border-border text-foreground text-xl font-heading px-0 py-1 outline-none focus:border-ring transition-colors"
                />
                <button onClick={() => removeGoal(selectedGoal.id)} className="text-muted-foreground/40 hover:text-rose-400 ml-4 flex-shrink-0 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-body font-semibold text-muted-foreground">Sub-tasks</span>
                  <span className="text-xs text-muted-foreground font-body">{doneCount}/{sub.length} tasks · {pct}%</span>
                </div>
                {sub.length > 0 && (
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden -mt-1 mb-1">
                    <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {(() => {
                  const open = sub.map((t, idx) => ({ t, idx })).filter(({ t }) => !t.completed);
                  const done = sub.map((t, idx) => ({ t, idx })).filter(({ t }) => t.completed);
                  return (
                    <>
                      {open.map(({ t, idx }) => (
                        <div key={idx} className="flex items-center gap-3 group">
                          <button onClick={() => toggleSubTask(selectedGoal, idx)}
                            className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-muted-foreground flex items-center justify-center flex-shrink-0 transition-all">
                          </button>
                          <span className="text-sm flex-1 text-foreground">{t.text}</span>
                          <button onClick={() => deleteSubTask(selectedGoal, idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-rose-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {done.length > 0 && open.length > 0 && <div className="border-t border-border my-1" />}
                      {done.map(({ t, idx }) => (
                        <div key={idx} className="flex items-center gap-3 group opacity-50">
                          <button onClick={() => toggleSubTask(selectedGoal, idx)}
                            className="w-5 h-5 rounded-full border-2 bg-muted-foreground/40 border-muted-foreground/40 flex items-center justify-center flex-shrink-0 transition-all">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </button>
                          <span className="text-sm flex-1 line-through text-muted-foreground">{t.text}</span>
                          <button onClick={() => deleteSubTask(selectedGoal, idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-rose-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </>
                  );
                })()}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={subTaskInputs[selectedGoal.id] || ""}
                    onChange={e => setSubTaskInputs(prev => ({ ...prev, [selectedGoal.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addSubTask(selectedGoal, subTaskInputs[selectedGoal.id] || "")}
                    placeholder="Add a sub-task..."
                    className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  />
                  <button onClick={() => addSubTask(selectedGoal, subTaskInputs[selectedGoal.id] || "")} className="bg-foreground text-background p-2 rounded-xl hover:opacity-90 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button onClick={() => saveGoal(gd)} className="self-start bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
              </div>
            </div>
          );
        })()}

        {/* Task detail */}
        {!adding && selectedTask && (() => {
          const td = editTaskData?.id === selectedTask.id ? editTaskData : selectedTask;
          return (
            <div className="w-full max-w-3xl mx-auto">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-6 pb-4 border-b border-border flex items-center justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mr-2 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                  <button onClick={() => toggleTask(selectedTask)} className="flex-shrink-0">
                    {selectedTask.completed
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />}
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

              <button onClick={() => saveTask(td)} className="self-start bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
              </div>
            </div>
          );
        })()}

        {/* Empty state */}
        {!adding && !selected && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Target className="w-12 h-12 mb-3 text-muted-foreground/40" />
            <p className="mb-3 text-sm">Select a {activeTab === "goals" ? "goal" : "task"} or create a new one</p>
          </div>
        )}
      </div>
    </div>
      <ActionCircle onClick={openAdd} label={`New ${activeTab === "goals" ? "goal" : "task"}`} />
    </>
  );
}