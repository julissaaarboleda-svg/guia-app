import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { Plus, Upload, FilePlus2, Target, ReceiptText, ChevronDown, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

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
import GoalsOverview, { goalIsDone, goalPct, isCount, metaOf, daysLeft, Bar } from "@/components/business/GoalsOverview";
import BusinessSwitcher from "@/components/business/BusinessSwitcher";
import { money } from "@/components/business/BusinessLog";

const TABS = [["overview", "Overview"], ["goals", "Goals"], ["documents", "Documents"], ["log", "Log"]];
const PERIODS = [["month", "Month"], ["year", "Year"], ["all", "All time"]];
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* optional */ } };

function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${value === o ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function Business({ switcher = null }) {
  const [allEntries, setEntries] = useState([]);
  const [allGoals, setGoals] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [activeId, setActiveIdState] = useState(() => lsGet("guia_business_active", ""));
  const [tab, setTabState] = useState(() => lsGet("guia_business_tab", "overview"));
  const [period, setPeriod] = useState("year");
  const [docAdd, setDocAdd] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bootRef = useRef(false);
  const setActiveId = (id) => { setActiveIdState(id); lsSet("guia_business_active", id); };
  const setTab = (t) => { setTabState(t); lsSet("guia_business_tab", t); };
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState("entry");
  const [form, setForm] = useState({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "", document_id: "" });
  const [goalForm, setGoalForm] = useState({ title: "", description: "", target_value: "", current_value: "0", unit: "$", target_date: "", notes: "" });
  const [goalType, setGoalType] = useState("revenue");
  const [editGoalType, setEditGoalType] = useState("revenue");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [prefsId, setPrefsId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [allDocs, setDocs] = useState([]);
  const [importing, setImporting] = useState(false);
  const [shut, setShut] = useState(() => { try { return { recent: true, ...JSON.parse(localStorage.getItem("guia-biz-shut") || "{}") }; } catch { return { recent: true }; } });
  const toggleShut = (k) => setShut((c) => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem("guia-biz-shut", JSON.stringify(n)); } catch { /* optional */ } return n; });
  const sectionHead = (k, title, action, onAction) => (
    <div className="flex items-center justify-between mb-2">
      <button type="button" onClick={() => toggleShut(k)} className="flex items-center gap-1.5" aria-expanded={!shut[k]}>
        {shut[k] ? <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} /> : <ChevronDown className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />}
        <h2 className="font-heading text-[18px] text-foreground">{title}</h2>
      </button>
      <button onClick={onAction} className="text-[13px] font-medium text-[#A7773F]">{action}</button>
    </div>
  );

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
      let legacyGoal = null;
      if (p.length > 0) {
        setPrefsId(p[0].id);
        legacyGoal = p[0].business_revenue_goal || null;
      }
      // Businesses: the first time through, everything you already have becomes
      // your first business so nothing is lost.
      let list = (await ent.Business.list("created_date")) || [];
      if (list.length === 0 && !bootRef.current) {
        bootRef.current = true;
        const first = await ent.Business.create({ name: "My business", is_default: true, revenue_goal: legacyGoal });
        list = [first];
      }
      setBusinesses(list);
      setLoaded(true);
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
      document_id: form.document_id || null,
      business_id: writeId,
      revenue: form.revenue ? Number(form.revenue) : null,
      expense: form.expense ? Number(form.expense) : null,
      date: form.date || new Date().toISOString().split("T")[0],
    });
    setForm({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "", document_id: "" });
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
      business_id: writeId,
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
      document_id: entry.document_id || "",
    });
  };

  const cancelEditEntry = () => {
    setEditingEntry(null);
    setForm({ category: "", name: "", date: "", revenue: "", expense: "", location: "", description: "", notes: "", document_id: "" });
  };

  const updateEntry = async () => {
    if (!form.category || !form.name) return;
    await ent.BusinessEntry.update(editingEntry, {
      ...form,
      document_id: form.document_id || null,
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
    if (activeBusiness) {
      const v = Number(goalInput) || null;
      setBusinesses((bs) => bs.map((b) => (b.id === activeBusiness.id ? { ...b, revenue_goal: v } : b)));
      await ent.Business.update(activeBusiness.id, { revenue_goal: v });
      if (prefsId && activeBusiness.is_default) { try { await ent.UserPreferences.update(prefsId, { business_revenue_goal: v }); } catch { /* optional mirror */ } }
    }
    setEditingGoal(false);
  };

  const patchGoal = async (id, patch) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    setGoals((gs) => gs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await ent.BusinessGoal.update(id, { ...goal, ...patch });
  };

  const defaultId = (businesses.find((b) => b.is_default) || businesses[0] || {}).id;
  const validActive = activeId === "all" || businesses.some((b) => b.id === activeId) ? activeId : defaultId;
  const readOnly = validActive === "all";
  const writeId = readOnly ? defaultId : validActive;
  const activeBusiness = businesses.find((b) => b.id === validActive);
  const inScope = (r) => validActive === "all" || (r.business_id || defaultId) === validActive;
  const entries = useMemo(() => allEntries.filter(inScope), [allEntries, validActive, defaultId]);
  const goals = useMemo(() => allGoals.filter(inScope), [allGoals, validActive, defaultId]);
  const docs = useMemo(() => allDocs.filter(inScope), [allDocs, validActive, defaultId]);

  const createBusiness = async (name) => {
    const b = await ent.Business.create({ name, revenue_goal: null });
    setBusinesses((bs) => [...bs, b]);
    setActiveId(b.id);
  };
  const renameBusiness = async (id, name) => {
    setBusinesses((bs) => bs.map((b) => (b.id === id ? { ...b, name } : b)));
    await ent.Business.update(id, { name });
  };
  const deleteBusiness = async (b) => {
    const owned = (r) => (r.business_id || defaultId) === b.id;
    const n = allEntries.filter(owned).length + allGoals.filter(owned).length + allDocs.filter(owned).length;
    const msg = n > 0
      ? `Delete “${b.name}” and its ${n} entries, goals and documents? This can't be undone.`
      : `Delete “${b.name}”?`;
    if (!window.confirm(msg)) return;
    await Promise.all([
      ...allEntries.filter(owned).map((r) => ent.BusinessEntry.delete(r.id)),
      ...allGoals.filter(owned).map((r) => ent.BusinessGoal.delete(r.id)),
      ...allDocs.filter(owned).map((r) => { try { base44.integrations.Core.DeletePrivateFile({ file_url: r.file_url }); } catch { /* record still goes */ } return ent.BusinessDocument.delete(r.id); }),
    ]);
    await ent.Business.delete(b.id);
    setBusinesses((bs) => bs.filter((x) => x.id !== b.id));
    if (validActive === b.id) setActiveId(defaultId === b.id ? "" : defaultId);
    loadEntries(); loadDocs();
  };

  const revenueGoalValue = readOnly ? "" : (activeBusiness?.revenue_goal || "");

  const inPeriod = (e) => {
    if (period === "all") return true;
    const d = e.date || "";
    const now = new Date().toLocaleDateString("en-CA");
    return period === "year" ? d.slice(0, 4) === now.slice(0, 4) : d.slice(0, 7) === now.slice(0, 7);
  };
  const periodEntries = entries.filter(inPeriod);
  const periodRevenue = periodEntries.reduce((s, e) => s + (e.revenue || 0), 0);
  const periodExpenses = periodEntries.reduce((s, e) => s + (e.expense || 0), 0);
  const periodProfit = periodRevenue - periodExpenses;
  const activeGoals = goals.filter((g) => !goalIsDone(g)).sort((a, b) => (daysLeft(a) ?? 1e9) - (daysLeft(b) ?? 1e9));
  const recent = [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);
  const dayLabel = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

  const totalRevenue = entries.reduce((s, e) => s + (e.revenue || 0), 0);

  const GoalTypeInputs = ({ type, setType, form: gForm, setForm: setGForm }) => (
    <>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1.5">What kind of goal?</label>
        <div className="flex flex-wrap gap-1.5">
          {[["revenue", "Revenue"], ["quantity", "Count"], ["milestone", "Milestone"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setType(v)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${type === v ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
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
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Current amount ($)</label>
            <input type="number" value={gForm.current_value} onChange={e => setGForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0"
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
          </div>
        </div>
      )}
      {type === "quantity" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Target number</label>
            <input type="number" value={gForm.target_value} onChange={e => setGForm(f => ({ ...f, target_value: e.target.value }))} placeholder="e.g. 10"
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Unit (e.g. shows, clients)</label>
            <input value={gForm.unit === "$" || gForm.unit === "milestone" ? "" : gForm.unit} onChange={e => setGForm(f => ({ ...f, unit: e.target.value }))} placeholder="market shows"
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1">Current count</label>
            <input type="number" value={gForm.current_value} onChange={e => setGForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0"
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
          </div>
        </div>
      )}
    </>
  );

  const renderEntryEditor = () => (
    <div className="space-y-3">
      <Chips options={BUSINESS_CATEGORIES} value={form.category} onChange={(c) => setForm(f => ({ ...f, category: c }))} />
      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.category === "Event" ? "What's the event?" : "Name"}
        className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      <div className="grid grid-cols-2 gap-2">
        <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
          className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
        <DateInput value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
        <input type="number" step="0.01" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} placeholder="Revenue"
          className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
        <input type="number" step="0.01" value={form.expense} onChange={e => setForm(f => ({ ...f, expense: e.target.value }))} placeholder="Expense"
          className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      </div>
      <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
        className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      {docs.length > 0 && (
        <select value={form.document_id} onChange={e => setForm(f => ({ ...f, document_id: e.target.value }))}
          className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F] text-foreground">
          <option value="">Attach a document (optional)</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      )}
      <ReactQuill value={form.notes} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Notes" className="bg-card rounded-xl quill-business" theme="snow" />
      <div className="flex gap-2">
        <button onClick={updateEntry} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-colors">Save</button>
        <button onClick={cancelEditEntry} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
      </div>
    </div>
  );

  const renderGoalEditor = () => (
    <div className="space-y-3">
      <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" autoFocus
        className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      <input value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
        className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      {GoalTypeInputs({ type: editGoalType, setType: setEditGoalType, form: goalForm, setForm: setGoalForm })}
      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">Target date (optional)</label>
        <DateInput value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))}
          className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
      </div>
      <ReactQuill value={goalForm.notes} onChange={(value) => setGoalForm(f => ({ ...f, notes: value }))} placeholder="Notes" className="bg-card rounded-xl quill-business" theme="snow" />
      <div className="flex gap-2">
        <button onClick={updateGoal} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-colors">Save</button>
        <button onClick={cancelEditGoal} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
      </div>
    </div>
  );

  const openAdd = (which) => {
    if (which === "document") { setTab("documents"); setDocAdd((n) => n + 1); return; }
    setAddTab(which === "goal" ? "goal" : "entry");
    setAdding(true);
  };

  const menuItem = "gap-2.5 cursor-pointer text-[13.5px] py-2";

  return (
    <>
      <div className="max-w-[1200px] 2xl:max-w-[1400px] mx-auto w-full">
      <PageHeader
        below={switcher}
        title="Business"
        subtitle="Your numbers, in one place."
        actions={
          readOnly ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#A7773F] text-[#F7F3EC] hover:opacity-90 transition-opacity"
                  aria-label="Add"
                  title="Add"
                >
                  <Plus className="w-[18px] h-[18px]" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuItem onClick={() => openAdd("entry")} className={menuItem}><ReceiptText className="w-4 h-4" strokeWidth={1.5} /> Add entry</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAdd("goal")} className={menuItem}><Target className="w-4 h-4" strokeWidth={1.5} /> Add goal</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAdd("document")} className={menuItem}><FilePlus2 className="w-4 h-4" strokeWidth={1.5} /> Add document</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setImporting(true)} className={menuItem}><Upload className="w-4 h-4" strokeWidth={1.5} /> Import statement</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      <div className="p-4 md:p-8">

      {loaded && (
        <div className="mb-4">
          <BusinessSwitcher
            businesses={businesses}
            activeId={validActive}
            onSelect={setActiveId}
            onCreate={createBusiness}
            onRename={renameBusiness}
            onDelete={deleteBusiness}
            hasData={allEntries.length + allGoals.length + allDocs.length > 0}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-5 overflow-x-auto no-scrollbar">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`relative pb-2.5 pt-1 text-[14px] whitespace-nowrap transition-colors ${tab === id ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
            {tab === id && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-[#A7773F]" />}
          </button>
        ))}
      </div>

      {/* Add form (any tab) */}
      {adding && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-5 lg:max-w-2xl space-y-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-[18px] text-foreground">{addTab === "entry" ? "New entry" : "New goal"}</h2>
            <div className="flex gap-4">
              {[["entry", "Entry"], ["goal", "Goal"]].map(([id, label]) => (
                <button key={id} onClick={() => setAddTab(id)} className={`relative pb-1 text-[13px] ${addTab === id ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {label}{addTab === id && <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-[#A7773F]" />}
                </button>
              ))}
            </div>
          </div>

          {addTab === "entry" && (
            <div className="space-y-3">
              <Chips options={BUSINESS_CATEGORIES} value={form.category} onChange={(c) => setForm(f => ({ ...f, category: c }))} />
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.category === "Event" ? "What's the event? (e.g. Market Show, Product Launch)" : "Name / Title"}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location"
                  className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
                <DateInput value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
                <input type="number" step="0.01" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))} placeholder="Revenue ($)"
                  className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
                <input type="number" step="0.01" value={form.expense} onChange={e => setForm(f => ({ ...f, expense: e.target.value }))} placeholder="Expense ($)"
                  className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
              </div>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
              {docs.length > 0 && (
                <select value={form.document_id} onChange={e => setForm(f => ({ ...f, document_id: e.target.value }))}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F] text-foreground">
                  <option value="">Attach a document (optional)</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              )}
              <ReactQuill value={form.notes} onChange={(value) => setForm(f => ({ ...f, notes: value }))} placeholder="Notes (optional)" className="bg-card rounded-xl quill-career" theme="snow" />
            </div>
          )}

          {addTab === "goal" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">What do you want to achieve?</label>
                <input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Attend Market Shows" autoFocus
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
              </div>
              {GoalTypeInputs({ type: goalType, setType: setGoalType, form: goalForm, setForm: setGoalForm })}
              <div>
                <label className="flex items-center gap-1 text-xs font-medium text-foreground mb-1">
                  Target date {goalType !== "milestone" ? "(optional)" : ""}
                </label>
                <DateInput value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]"
                  placeholder="Select target date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Details (optional)</label>
                <input value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Add more context about your goal"
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F]" />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={addTab === "entry" ? add : addGoal} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-colors">
              Add {addTab === "entry" ? "Entry" : "Goal"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {tab === "overview" && (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 mb-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">{period === "month" ? "This month" : period === "year" ? "This year" : "All time"}</p>
            <p className="font-heading text-[32px] leading-tight mt-1" style={{ color: periodProfit < 0 ? "#8F6368" : undefined }}>
              {periodProfit < 0 ? "−" : ""}{money(Math.abs(periodProfit))} <span className="font-body text-[13px] text-muted-foreground">profit</span>
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5 text-[13px] text-muted-foreground">
              <span>Revenue <b className="font-semibold" style={{ color: "#5A6F45" }}>{money(periodRevenue)}</b></span>
              <span>Expenses <b className="font-semibold" style={{ color: "#8F6368" }}>{money(periodExpenses)}</b></span>
            </div>
            <div className="flex gap-1.5 mt-3.5">
              {PERIODS.map(([id, label]) => (
                <button key={id} onClick={() => setPeriod(id)}
                  className={`text-[12px] px-3 py-1 rounded-full transition-colors ${period === id ? "bg-[#E7D9C6] text-foreground font-medium" : "border border-border text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>

          {sectionHead("goals", "Goals", "See all", () => setTab("goals"))}
          {!shut.goals && <div className="bg-card border border-border rounded-2xl p-4 mb-5 space-y-4">
            {Number(revenueGoalValue) > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[14px] text-foreground">Revenue goal</span>
                  <span className="text-[12.5px] text-muted-foreground">{money(totalRevenue)} of {money(revenueGoalValue)}</span>
                </div>
                <Bar pct={Math.min(100, Math.round((totalRevenue / Number(revenueGoalValue)) * 100))} done={totalRevenue >= Number(revenueGoalValue)} />
              </div>
            )}
            {activeGoals.slice(0, 2).map((g) => (
              <div key={g.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-heading text-[15.5px] text-foreground truncate">{g.title}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#F0E6D6", color: "#8B6B3E" }}>In progress</span>
                </div>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 mb-1.5">
                  {metaOf(g)}{daysLeft(g) != null && daysLeft(g) >= 0 ? ` · ${daysLeft(g)} day${daysLeft(g) === 1 ? "" : "s"} left` : ""}
                </p>
                {isCount(g) && <Bar pct={goalPct(g)} />}
              </div>
            ))}
            {!Number(revenueGoalValue) && activeGoals.length === 0 && (
              <p className="text-[13px] text-muted-foreground">{readOnly ? "No goals yet." : "No goals yet. Use + to add one."}</p>
            )}
          </div>}
          {shut.goals && <div className="mb-5" />}

          {sectionHead("recent", "Recent", "Open log", () => setTab("log"))}
          {!shut.recent && <div className="bg-card border border-border rounded-2xl px-4 py-1 mb-2">
            {recent.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-3">{readOnly ? "No entries yet." : "No entries yet. Add a sale or expense, or import a statement from the + menu."}</p>
            ) : recent.map((e, i) => (
              <div key={e.id} className={`flex items-center justify-between gap-3 py-2.5 ${i ? "border-t border-border/60" : ""}`}>
                <div className="min-w-0">
                  <p className="font-heading text-[15px] text-foreground truncate">{e.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">{dayLabel(e.date)} · {e.category}</p>
                </div>
                <span className="text-[13.5px] font-semibold flex-shrink-0" style={{ color: e.revenue ? "#5A6F45" : "#8F6368" }}>
                  {e.revenue ? `+${money(e.revenue)}` : e.expense ? `−${money(e.expense)}` : ""}
                </span>
              </div>
            ))}
          </div>}
        </>
      )}

      {tab === "goals" && (
        <GoalsOverview
          goals={goals}
          readOnly={readOnly}
          totalRevenue={totalRevenue}
          revenueGoal={revenueGoalValue}
          editingRevenue={editingGoal}
          revenueInput={goalInput}
          setRevenueInput={setGoalInput}
          onEditRevenue={() => { if (readOnly) return; setGoalInput(revenueGoalValue || ""); setEditingGoal(true); }}
          onSaveRevenue={saveGoal}
          onCancelRevenue={() => setEditingGoal(false)}
          onNew={() => { setAddTab("goal"); setAdding(true); }}
          onEdit={startEditGoal}
          onDelete={removeGoal}
          onPatch={patchGoal}
          editingGoalId={editingGoalId}
          renderEditor={renderGoalEditor}
        />
      )}

      {tab === "documents" && (
        <BusinessDocuments docs={docs} onChange={loadDocs} businessId={writeId} addSignal={docAdd} readOnly={readOnly} />
      )}

      <StatementImportSheet open={importing} onClose={() => setImporting(false)} existing={entries} businessId={writeId} onDone={loadEntries} />

      {tab === "log" && (
        <BusinessLog
          entries={entries}
          docs={docs}
          categories={BUSINESS_CATEGORIES}
          editingEntry={editingEntry}
          renderEditor={renderEntryEditor}
          onEdit={startEditEntry}
          onDelete={remove}
          onNew={() => { setAddTab("entry"); setAdding(true); }}
          readOnly={readOnly}
        />
      )}
    </div>
    </div>
    </>
  );
}
