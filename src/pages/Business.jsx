import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Edit2, X, Check, MapPin, Calendar, Target, Plus } from "lucide-react";

// "Event" is special — entries in this category also surface in Home's
// "Up Next" section (see homeData.js's buildUpNext). Everything else is
// purely for organizing your own business log.
const BUSINESS_CATEGORIES = ["Event", "Market Show", "Product Launch", "Client Meeting", "Sale", "Expense", "Other"];
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";

export default function Business() {
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState("entry");
  const [form, setForm] = useState({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "" });
  const [goalForm, setGoalForm] = useState({ title: "", description: "", target_value: "", current_value: "0", unit: "$", target_date: "", notes: "" });
  const [goalType, setGoalType] = useState("revenue");
  const [editGoalType, setEditGoalType] = useState("revenue");
  const [revenueGoal, setRevenueGoal] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [prefsId, setPrefsId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [e, g, u] = await Promise.all([
        base44.entities.BusinessEntry.list("-date"),
        base44.entities.BusinessGoal.list("-created_date"),
        base44.auth.me(),
      ]);
      setEntries(e);
      setGoals(g);
      const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
      if (p.length > 0) {
        setPrefsId(p[0].id);
        setRevenueGoal(p[0].business_revenue_goal || "");
      }
    };
    load();
  }, []);

  const loadEntries = async () => {
    const [e, g] = await Promise.all([
      base44.entities.BusinessEntry.list("-date"),
      base44.entities.BusinessGoal.list("-created_date"),
    ]);
    setEntries(e);
    setGoals(g);
  };

  const add = async () => {
    if (!form.category || !form.name) return;
    await base44.entities.BusinessEntry.create({
      ...form,
      revenue: form.revenue ? Number(form.revenue) : null,
      expense: form.expense ? Number(form.expense) : null,
      date: form.date || new Date().toISOString().split("T")[0],
    });
    setForm({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "" });
    setAdding(false);
    loadEntries();
  };

  const addGoal = async () => {
    if (!goalForm.title) return;
    let unit = "$";
    let target_value = null;
    if (goalType === "revenue") { unit = "$"; target_value = goalForm.target_value ? Number(goalForm.target_value) : null; }
    else if (goalType === "quantity") { unit = goalForm.unit || "units"; target_value = goalForm.target_value ? Number(goalForm.target_value) : null; }
    else { unit = "milestone"; target_value = null; }
    await base44.entities.BusinessGoal.create({
      ...goalForm,
      target_value,
      unit,
      current_value: goalForm.current_value ? Number(goalForm.current_value) : 0,
    });
    setGoalForm({ title: "", description: "", target_value: "", current_value: "0", unit: "$", target_date: "", notes: "" });
    setGoalType("revenue");
    setAdding(false);
    loadEntries();
  };

  const removeGoal = async (id) => {
    await base44.entities.BusinessGoal.delete(id);
    loadEntries();
  };

  const updateGoalProgress = async (id, value) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    await base44.entities.BusinessGoal.update(id, { ...goal, current_value: value ? Number(value) : 0 });
    loadEntries();
  };

  const remove = async (id) => {
    await base44.entities.BusinessEntry.delete(id);
    loadEntries();
  };

  const startEditEntry = (entry) => {
    setEditingEntry(entry.id);
    setForm({
      category: entry.category || "",
      name: entry.name || "",
      date: entry.date || "",
      revenue: entry.revenue?.toString() || "",
      expense: entry.expense?.toString() || "",
      location: entry.location || "",
      description: entry.description || "",
      notes: entry.notes || "",
    });
  };

  const cancelEditEntry = () => {
    setEditingEntry(null);
    setForm({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "" });
  };

  const updateEntry = async () => {
    if (!form.category || !form.name) return;
    await base44.entities.BusinessEntry.update(editingEntry, {
      ...form,
      revenue: form.revenue ? Number(form.revenue) : null,
      expense: form.expense ? Number(form.expense) : null,
    });
    cancelEditEntry();
    loadEntries();
  };

  const startEditGoal = (goal) => {
    setEditingGoalId(goal.id);
    let type = "revenue";
    if (goal.unit === "milestone" || (!goal.target_value && !goal.unit)) type = "milestone";
    else if (goal.unit !== "$") type = "quantity";
    setEditGoalType(type);
    setGoalForm({
      title: goal.title || "",
      description: goal.description || "",
      target_value: goal.target_value?.toString() || "",
      current_value: goal.current_value?.toString() || "0",
      unit: goal.unit || "$",
      target_date: goal.target_date || "",
      notes: goal.notes || "",
    });
  };

  const cancelEditGoal = () => {
    setEditingGoalId(null);
    setGoalForm({ title: "", description: "", target_value: "", current_value: "0", unit: "$", target_date: "", notes: "" });
  };

  const updateGoal = async () => {
    if (!goalForm.title) return;
    let unit = "$";
    let target_value = null;
    if (editGoalType === "revenue") { unit = "$"; target_value = goalForm.target_value ? Number(goalForm.target_value) : null; }
    else if (editGoalType === "quantity") { unit = goalForm.unit || "units"; target_value = goalForm.target_value ? Number(goalForm.target_value) : null; }
    else { unit = "milestone"; target_value = null; }
    await base44.entities.BusinessGoal.update(editingGoalId, {
      ...goalForm,
      target_value,
      unit,
      current_value: goalForm.current_value ? Number(goalForm.current_value) : 0,
    });
    cancelEditGoal();
    loadEntries();
  };

  const saveGoal = async () => {
    if (prefsId) {
      await base44.entities.UserPreferences.update(prefsId, { business_revenue_goal: Number(goalInput) || null });
      setRevenueGoal(goalInput);
    }
    setEditingGoal(false);
  };

  const totalRevenue = entries.reduce((s, e) => s + (e.revenue || 0), 0);
  const totalExpenses = entries.reduce((s, e) => s + (e.expense || 0), 0);
  const profit = totalRevenue - totalExpenses;
  const goalProgress = revenueGoal ? Math.min((totalRevenue / Number(revenueGoal)) * 100, 100) : 0;

  const GoalTypeInputs = ({ type, setType, form: gForm, setForm: setGForm }) => (
    <>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Goal type</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring">
          <option value="revenue">Revenue Amount</option>
          <option value="quantity">Quantity</option>
          <option value="milestone">Milestone</option>
        </select>
      </div>
      {type === "revenue" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Target amount ($)</label>
            <input type="number" value={gForm.target_value} onChange={e => setGForm(f => ({ ...f, target_value: e.target.value }))} placeholder="e.g. 10000"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Current amount ($)</label>
            <input type="number" value={gForm.current_value} onChange={e => setGForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
          </div>
        </div>
      )}
      {type === "quantity" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Target number</label>
            <input type="number" value={gForm.target_value} onChange={e => setGForm(f => ({ ...f, target_value: e.target.value }))} placeholder="e.g. 10"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Unit (e.g. shows, clients)</label>
            <input value={gForm.unit === "$" || gForm.unit === "milestone" ? "" : gForm.unit} onChange={e => setGForm(f => ({ ...f, unit: e.target.value }))} placeholder="market shows"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1">Current count</label>
            <input type="number" value={gForm.current_value} onChange={e => setGForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0"
              className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
          </div>
        </div>
      )}
      {type === "milestone" && (
        <p className="text-xs text-muted-foreground bg-secondary border border-input rounded-lg px-3 py-2">This goal tracks a milestone — set a target date below.</p>
      )}
    </>
  );

  return (
    <>
      <div className="max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Business"
        subtitle="Track any business activity"
        actions={
          <button
            onClick={() => setAdding(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
            aria-label="Add entry"
            title="Add entry"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        }
      />
      <div className="p-6 md:p-8">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Revenue",  val: `$${totalRevenue.toLocaleString()}`,  color: "text-foreground" },
          { label: "Expenses", val: `$${totalExpenses.toLocaleString()}`, color: "text-destructive" },
          { label: "Profit",   val: `$${profit.toLocaleString()}`,        color: profit >= 0 ? "text-foreground" : "text-destructive" },
          { label: "Goals",    val: goals.filter(g => g.status === "active").length, color: "text-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Business Goals */}
      {goals.length > 0 && (
        <div className="mb-5">
          <h2 className="font-heading text-sm text-foreground mb-3">Business goals</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {goals.filter(g => g.status === "active").map(g => {
              const progress = g.target_value ? Math.min((g.current_value / g.target_value) * 100, 100) : 0;
              const daysLeft = g.target_date ? Math.ceil((new Date(g.target_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={g.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <p className="font-semibold text-foreground">{g.title}</p>
                      </div>
                      {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditGoal(g)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeGoal(g.id)} className="text-muted-foreground hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {editingGoalId === g.id ? (
                    <div className="space-y-3 mb-3">
                      <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" autoFocus
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      <input value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
                        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      <GoalTypeInputs type={editGoalType} setType={setEditGoalType} form={goalForm} setForm={setGoalForm} />
                      <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">
                          Target date (optional)
                        </label>
                        <DateInput value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))}
                          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      </div>
                      <ReactQuill value={goalForm.notes} onChange={(value) => setGoalForm(f => ({ ...f, notes: value }))} placeholder="Notes" className="bg-secondary rounded-lg quill-business" theme="snow" />
                      <div className="flex gap-2">
                        <button onClick={updateGoal} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
                        <button onClick={cancelEditGoal} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {g.unit !== "milestone" && g.target_value ? (
                        <div className="flex items-center gap-3 mb-2">
                          <input type="number" value={g.current_value} onChange={(e) => updateGoalProgress(g.id, e.target.value)}
                            className="w-28 bg-secondary border border-input rounded-lg px-3 py-1.5 text-sm font-bold text-foreground outline-none focus:border-ring" />
                          <span className="text-sm text-muted-foreground">of {g.target_value} {g.unit}</span>
                          {daysLeft !== null && <span className="text-xs text-muted-foreground">{daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}</span>}
                        </div>
                      ) : (
                        daysLeft !== null && <p className="text-xs text-muted-foreground mb-2">{daysLeft > 0 ? `${daysLeft} days until target` : 'Target date passed'}</p>
                      )}
                      {g.unit !== "milestone" && g.target_value && (
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      {g.notes && <p className="text-xs text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: g.notes }} />}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue Goal */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-sm text-foreground">Revenue goal</h2>
          {!editingGoal ? (
            <button onClick={() => { setGoalInput(revenueGoal); setEditingGoal(true); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Target ($)" autoFocus
                className="w-28 bg-secondary border border-input rounded-lg px-2 py-1 text-foreground text-xs outline-none focus:border-ring" />
              <button onClick={saveGoal} className="text-foreground hover:text-foreground"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditingGoal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Progress</span>
          <span>${totalRevenue.toLocaleString()} of {revenueGoal ? `$${Number(revenueGoal).toLocaleString()}` : "—"}</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-5">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAddTab("entry")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === "entry" ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted"}`}>Business Entry</button>
            <button onClick={() => setAddTab("goal")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === "goal" ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted"}`}>Goal</button>
          </div>

          {addTab === "entry" && (
            <div className="space-y-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} autoFocus
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring appearance-none">
                <option value="" disabled>Select a category</option>
                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.category === "Event" ? "What's the event? (e.g. Vendor Fair)" : "Name / Title"}
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
                  className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                <DateInput value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                <input type="number" step="0.01" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} placeholder="Revenue ($)"
                  className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                <input type="number" step="0.01" value={form.expense} onChange={e => setForm(f => ({ ...f, expense: e.target.value }))} placeholder="Expense ($)"
                  className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              <ReactQuill value={form.notes} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Notes (optional)" className="bg-secondary rounded-lg quill-career" theme="snow" />
            </div>
          )}

          {addTab === "goal" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">What do you want to achieve?</label>
                <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Attend Market Shows" autoFocus
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
              <GoalTypeInputs type={goalType} setType={setGoalType} form={goalForm} setForm={setGoalForm} />
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">
                  Target date {goalType !== "milestone" ? "(optional)" : ""}
                </label>
                <DateInput value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
                  placeholder="Select target date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Details (optional)</label>
                <input value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Add more context about your goal"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes (optional)</label>
                <ReactQuill value={goalForm.notes} onChange={(value) => setGoalForm(f => ({ ...f, notes: value }))} placeholder="Additional notes" className="bg-secondary rounded-lg quill-career" theme="snow" />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={addTab === "entry" ? add : addGoal} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              Add {addTab === "entry" ? "Entry" : "Goal"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Entries Log */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading text-sm text-foreground">Business log</h2>
        </div>
        {entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-2xl mb-2">🏢</p>
            <p className="text-sm">No entries yet. Add your first business activity.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map(e => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3 group">
                {editingEntry === e.id ? (
                  <div className="flex-1 space-y-3">
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} autoFocus
                      className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring appearance-none">
                      <option value="" disabled>Select a category</option>
                      {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.category === "Event" ? "What's the event?" : "Name"}
                      className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
                        className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      <DateInput value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      <input type="number" step="0.01" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} placeholder="Revenue"
                        className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                      <input type="number" step="0.01" value={form.expense} onChange={e => setForm(f => ({ ...f, expense: e.target.value }))} placeholder="Expense"
                        className="bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    </div>
                    <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
                      className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
                    <ReactQuill value={form.notes} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Notes" className="bg-secondary rounded-lg quill-business" theme="snow" />
                    <div className="flex gap-2">
                      <button onClick={updateEntry} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
                      <button onClick={cancelEditEntry} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{e.category}</span>
                        {e.location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {e.location}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                      {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {e.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {(e.revenue || e.expense) && (
                          <span className="flex gap-2">
                            {e.revenue && <span className="text-foreground font-medium">+${e.revenue.toLocaleString()}</span>}
                            {e.expense && <span className="text-destructive font-medium">-${e.expense.toLocaleString()}</span>}
                          </span>
                        )}
                      </div>
                      {e.notes && <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: e.notes }} />}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <button onClick={() => startEditEntry(e)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
    </>
  );
}