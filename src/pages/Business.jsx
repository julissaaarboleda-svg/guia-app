import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { Plus, Upload } from "lucide-react";

// "Event" is a broad bucket — market shows, product launches, pop-ups,
// vendor fairs, etc. all go here as the category, with the specific type
// typed into the Name field below. This also also surfaces in Home's
// "Up Next" section (see homeData.js's buildUpNext). Everything else here
// is purely for organizing your own business log.
const BUSINESS_CATEGORIES = ["Event", "Client Meeting", "Sale", "Expense", "Other"];
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";
import StatementImportSheet from "@/components/business/StatementImportSheet";
import BusinessDocuments from "@/components/business/BusinessDocuments";
import BusinessLog from "@/components/business/BusinessLog";
import GoalsOverview, { goalIsDone } from "@/components/business/GoalsOverview";

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
  const [docs, setDocs] = useState([]);
  const [importing, setImporting] = useState(false);

  const loadDocs = async () => setDocs((await ent.BusinessDocument.list("-created_date")) || []);

  useEffect(() => {
    const load = async () => {
      const [e, g, u] = await Promise.all([
        ent.BusinessEntry.list("-date"),
        ent.BusinessGoal.list("-created_date"),
        base44.auth.me(),
      ]);
      setEntries(e);
      setGoals(g);
      ent.BusinessDocument.list("-created_date").then((d) => setDocs(d || [])).catch(() => {});
      const p = await ent.UserPreferences.filter({ user_email: u.email });
      if (p.length > 0) {
        setPrefsId(p[0].id);
        setRevenueGoal(p[0].business_revenue_goal || "");
      }
    };
    load();
  }, []);

  const loadEntries = async () => {
    const [e, g] = await Promise.all([
      ent.BusinessEntry.list("-date"),
      ent.BusinessGoal.list("-created_date"),
    ]);
    setEntries(e);
    setGoals(g);
  };

  const add = async () => {
    if (!form.category || !form.name) return;
    await ent.BusinessEntry.create({
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
    await ent.BusinessGoal.create({
      ...goalForm,
      status: "active",
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
    await ent.BusinessGoal.delete(id);
    loadEntries();
  };

  const remove = async (id) => {
    await ent.BusinessEntry.delete(id);
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
    await ent.BusinessEntry.update(editingEntry, {
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
    await ent.BusinessGoal.update(editingGoalId, {
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
      await ent.UserPreferences.update(prefsId, { business_revenue_goal: Number(goalInput) || null });
      setRevenueGoal(goalInput);
    }
    setEditingGoal(false);
  };

  const patchGoal = async (id, patch) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    setGoals((gs) => gs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await ent.BusinessGoal.update(id, { ...goal, ...patch });
  };

  const totalRevenue = entries.reduce((s, e) => s + (e.revenue || 0), 0);
  const totalExpenses = entries.reduce((s, e) => s + (e.expense || 0), 0);
  const profit = totalRevenue - totalExpenses;

  const GoalTypeInputs = ({ type, setType, form: gForm, setForm: setGForm }) => (
    <>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">What kind of goal?</label>
        <div className="flex flex-wrap gap-1.5">
          {[["revenue", "Revenue"], ["quantity", "Count"], ["milestone", "Milestone"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setType(v)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${type === v ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {type === "revenue" ? "Track money earned toward a number." : type === "quantity" ? "Track how many, like shows, clients or orders." : "Track something you finish, like launching a shop."}
        </p>
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
    </>
  );

  const renderEntryEditor = () => (
    <div className="space-y-3">
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
        <button onClick={updateEntry} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
        <button onClick={cancelEditEntry} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
      </div>
    </div>
  );

  const renderGoalEditor = () => (
    <div className="space-y-3">
      <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" autoFocus
        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
      <input value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
        className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
      {GoalTypeInputs({ type: editGoalType, setType: setEditGoalType, form: goalForm, setForm: setGoalForm })}
      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">Target date (optional)</label>
        <DateInput value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))}
          className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
      </div>
      <ReactQuill value={goalForm.notes} onChange={(value) => setGoalForm(f => ({ ...f, notes: value }))} placeholder="Notes" className="bg-secondary rounded-lg quill-business" theme="snow" />
      <div className="flex gap-2">
        <button onClick={updateGoal} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Save</button>
        <button onClick={cancelEditGoal} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="max-w-[1200px] 2xl:max-w-[1400px] mx-auto w-full">
      <PageHeader
        title="Business"
        subtitle="Your numbers, in one place."
        actions={
          <button
            onClick={() => setAdding(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#A7773F] text-[#F7F3EC] hover:opacity-90 transition-opacity"
            aria-label="Add entry"
            title="Add entry"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        }
      />
      <div className="p-4 md:p-8">

      {/* Stats */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-muted-foreground">So far</p>
        <p className={`font-heading text-[26px] mt-0.5 ${profit >= 0 ? "text-foreground" : "text-destructive"}`}>${profit.toLocaleString()} <span className="font-body text-xs text-muted-foreground">profit</span></p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-muted-foreground">
          <span>Revenue <b className="text-foreground font-medium">${totalRevenue.toLocaleString()}</b></span>
          <span>Expenses <b className="text-destructive font-medium">${totalExpenses.toLocaleString()}</b></span>
          <span>Active goals <b className="text-foreground font-medium">{goals.filter(g => (g.status || "active") === "active" && !goalIsDone(g)).length}</b></span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 -mt-1">
        <button onClick={() => setImporting(true)}
          className="inline-flex items-center gap-1.5 border border-[#A7773F] text-[#A7773F] px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-[#A7773F]/10 transition-colors">
          <Upload className="w-3.5 h-3.5" strokeWidth={1.8} /> Import a statement
        </button>
      </div>

      <GoalsOverview
        goals={goals}
        totalRevenue={totalRevenue}
        revenueGoal={revenueGoal}
        editingRevenue={editingGoal}
        revenueInput={goalInput}
        setRevenueInput={setGoalInput}
        onEditRevenue={() => { setGoalInput(revenueGoal || ""); setEditingGoal(true); }}
        onSaveRevenue={saveGoal}
        onCancelRevenue={() => setEditingGoal(false)}
        onNew={() => { setAddTab("goal"); setAdding(true); }}
        onEdit={startEditGoal}
        onDelete={removeGoal}
        onPatch={patchGoal}
        editingGoalId={editingGoalId}
        renderEditor={renderGoalEditor}
      />

      {/* Add form */}
      {adding && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-5 lg:max-w-2xl">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAddTab("entry")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === "entry" ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-muted text-foreground hover:bg-muted"}`}>Business Entry</button>
            <button onClick={() => setAddTab("goal")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${addTab === "goal" ? "bg-[#A7773F] text-[#F7F3EC]" : "bg-muted text-foreground hover:bg-muted"}`}>Goal</button>
          </div>

          {addTab === "entry" && (
            <div className="space-y-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} autoFocus
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring appearance-none">
                <option value="" disabled>Select a category</option>
                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.category === "Event" ? "What's the event? (e.g. Market Show, Product Launch)" : "Name / Title"}
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
              {GoalTypeInputs({ type: goalType, setType: setGoalType, form: goalForm, setForm: setGoalForm })}
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
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={addTab === "entry" ? add : addGoal} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              Add {addTab === "entry" ? "Entry" : "Goal"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <BusinessDocuments docs={docs} onChange={loadDocs} />

      <StatementImportSheet open={importing} onClose={() => setImporting(false)} existing={entries} onDone={loadEntries} />

      <BusinessLog
        entries={entries}
        categories={BUSINESS_CATEGORIES}
        editingEntry={editingEntry}
        renderEditor={renderEntryEditor}
        onEdit={startEditEntry}
        onDelete={remove}
        onNew={() => { setAddTab("entry"); setAdding(true); }}
      />
    </div>
    </div>
    </>
  );
}