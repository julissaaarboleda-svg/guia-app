import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, ChevronDown, Wallet, Pencil, Trash2, X, Plus } from "lucide-react";
import BudgetChart from "@/components/finance/BudgetChart";

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;

const PRESET_CATEGORIES = [
  "Housing", "Utilities", "Groceries", "Dining", "Transportation",
  "Insurance", "Healthcare", "Personal", "Entertainment",
  "Savings", "Debt", "Subscriptions", "Education", "Gifts", "Other"
];

export default function BudgetTab() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [buckets, setBuckets] = useState([]);
  const [income, setIncome] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [bills, setBills] = useState([]);
  const [fixedCollapsed, setFixedCollapsed] = useState(true);

  const mk = monthKey(monthDate);

  const load = async () => {
    const [allBuckets, allIncome, allBills, allSubs] = await Promise.all([
      base44.entities.BudgetBucket.list("-created_date"),
      base44.entities.MonthlyIncome.list("-created_date"),
      base44.entities.FinanceItem.filter({ type: "bill" }),
      base44.entities.FinanceItem.filter({ type: "subscription" }),
    ]);
    const manualBuckets = allBuckets.filter(b => b.month === mk);
    const manualNames = manualBuckets.map(b => b.name?.toLowerCase().trim());
    const fixedBills = allBills.filter(b => b.is_fixed && b.billing_cycle && b.billing_cycle !== "one_time");
    const billAutoBuckets = fixedBills
      .filter(b => !manualNames.includes(b.name?.toLowerCase().trim()))
      .map(b => ({
        id: `auto_${b.id}`,
        name: b.name,
        allocated_amount: b.amount || 0,
        spent_amount: b.amount || 0,
        is_fixed: true,
        due_day: b.due_day || null,
        category: b.category || "",
        month: mk,
        _auto: true,
      }));
    const activeSubs = allSubs.filter(s => !manualNames.includes(s.name?.toLowerCase().trim()));
    const subMonthlyTotal = activeSubs.reduce((sum, s) => {
      const amt = s.amount || 0;
      if (s.billing_cycle === "yearly") return sum + amt / 12;
      if (s.billing_cycle === "quarterly") return sum + amt / 3;
      if (s.billing_cycle === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0);
    const subAutoBuckets = activeSubs.length > 0 ? [{
      id: "auto_subs_aggregate",
      name: "Subscriptions",
      allocated_amount: Math.round(subMonthlyTotal),
      spent_amount: Math.round(subMonthlyTotal),
      is_fixed: true,
      due_day: null,
      category: "Subscriptions",
      month: mk,
      _auto: true,
    }] : [];
    setBuckets([...billAutoBuckets, ...subAutoBuckets, ...manualBuckets]);
    const inc = allIncome.find(i => i.month === mk);
    setIncome(inc || null);
    setIncomeInput(inc?.amount?.toString() || "");
    setBills(fixedBills);
  };

  useEffect(() => { load(); }, [mk]);

  const changeMonth = (delta) => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + delta);
    setMonthDate(d);
  };

  const saveIncome = async () => {
    const amt = Number(incomeInput) || 0;
    if (income?.id) {
      await base44.entities.MonthlyIncome.update(income.id, { amount: amt });
    } else {
      await base44.entities.MonthlyIncome.create({ amount: amt, month: mk });
    }
    setEditingIncome(false);
    load();
  };

  const openAdd = () => {
    setForm({ name: "", allocated_amount: "", spent_amount: "", is_fixed: false, due_day: "", category: "", customCategory: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (b) => {
    setForm({
      name: b.name || "",
      allocated_amount: b.allocated_amount?.toString() || "",
      spent_amount: b.spent_amount?.toString() || "",
      is_fixed: b.is_fixed || false,
      due_day: b.due_day?.toString() || "",
      category: b.category || "",
      customCategory: "",
    });
    setEditingId(b.id);
    setShowForm(true);
  };

  const saveBucket = async () => {
    if (!form.name) return;
    const data = {
      name: form.name,
      allocated_amount: Number(form.allocated_amount) || 0,
      spent_amount: Number(form.spent_amount) || 0,
      is_fixed: form.is_fixed,
      due_day: form.due_day ? Number(form.due_day) : null,
      category: form.category === "__new__" ? (form.customCategory || "") : (form.category || ""),
      month: mk,
    };
    if (editingId) {
      await base44.entities.BudgetBucket.update(editingId, data);
    } else {
      await base44.entities.BudgetBucket.create(data);
    }
    setShowForm(false);
    setEditingId(null);
    load();
  };

  const removeBucket = async (id) => {
    await base44.entities.BudgetBucket.delete(id);
    load();
  };

  const incomeAmount = income?.amount || 0;
  const allocated = buckets.reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const remaining = incomeAmount - allocated;
  const fixedAllocated = buckets.filter(b => b.is_fixed).reduce((s, b) => s + (b.allocated_amount || 0), 0);
  const allocPct = incomeAmount > 0 ? Math.min((allocated / incomeAmount) * 100, 100) : 0;
  const fixedBuckets = buckets.filter(b => b.is_fixed);
  const variableBuckets = buckets.filter(b => !b.is_fixed);

  const BucketCard = ({ b }) => {
    const pct = b.allocated_amount > 0
      ? Math.min(((b.spent_amount || 0) / b.allocated_amount) * 100, 100)
      : 0;
    const left = (b.allocated_amount || 0) - (b.spent_amount || 0);
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{b.name}</p>
              {b._auto && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground text-background font-body">From bill</span>}
            </div>
            {b.category && (
              <p className="text-xs text-muted-foreground">
                {b.category}{b.due_day ? ` · Day ${b.due_day}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-foreground font-semibold text-sm">{fmt(b.allocated_amount)}</span>
            {!b._auto && (
              <>
                <button onClick={() => openEdit(b)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeBucket(b.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
        {!b._auto && (
          <>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-sm text-foreground">{fmt(b.spent_amount)} of {fmt(b.allocated_amount)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{Math.round(pct)}% used</span>
              <span className="text-xs text-muted-foreground">{fmt(left)} left</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => changeMonth(-1)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-heading text-foreground text-sm min-w-[120px] text-center">{formatMonth(monthDate)}</span>
        <button onClick={() => changeMonth(1)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Income card */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Monthly Income</p>
            {editingIncome ? (
              <div className="flex items-center gap-2">
                <input type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)} autoFocus
                  className="bg-secondary border border-input rounded-lg px-2 py-1 text-foreground text-lg font-bold outline-none focus:border-ring w-32" />
                <button onClick={saveIncome} className="text-xs bg-foreground text-background px-2 py-1 rounded-lg">Save</button>
                <button onClick={() => { setEditingIncome(false); setIncomeInput(income?.amount?.toString() || ""); }} className="text-xs text-muted-foreground">Cancel</button>
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">{fmt(incomeAmount)}</p>
            )}
          </div>
          {!editingIncome && (
            <button onClick={() => setEditingIncome(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Edit</button>
          )}
        </div>
      </div>

      {/* Allocation summary */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Allocated</p>
            <p className="text-xl font-bold text-foreground">{fmt(allocated)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Remaining</p>
            <p className={`text-xl font-bold ${remaining < 0 ? "text-destructive" : "text-foreground"}`}>{fmt(remaining)}</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${allocPct}%` }} />
        </div>
        {fixedAllocated > 0 && <p className="text-xs text-muted-foreground">incl. {fmt(fixedAllocated)} fixed</p>}
      </div>

      {/* Chart */}
      {buckets.length > 0 && <BudgetChart buckets={buckets} income={incomeAmount} />}

      {/* Fixed expenses */}
      {fixedBuckets.length > 0 && (
        <div>
          <button type="button" onClick={() => setFixedCollapsed(c => !c)} className="flex items-center gap-1.5 w-full mb-2">
            {fixedCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            <h3 className="font-heading text-sm text-foreground">Fixed Expenses</h3>
            <span className="text-xs text-muted-foreground ml-auto">{fmt(fixedAllocated)}</span>
          </button>
          {!fixedCollapsed && (
            <div className="space-y-3">
              {fixedBuckets.map(b => <BucketCard key={b.id} b={b} />)}
            </div>
          )}
        </div>
      )}

      {/* Variable expenses */}
      {variableBuckets.length > 0 && (
        <div>
          <h3 className="font-heading text-sm text-foreground mb-3">Variable Expenses</h3>
          <div className="space-y-3">
            {variableBuckets.map(b => <BucketCard key={b.id} b={b} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {buckets.length === 0 && (
        <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
          <Wallet className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm">No budget buckets yet.</p>
          <p className="text-xs mt-1 px-6">Mark a bill as fixed + recurring to auto-populate your budget.</p>
        </div>
      )}

      {/* Add bucket button */}
      <button onClick={openAdd} className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors">
        <Plus className="w-4 h-4" /> Add budget bucket
      </button>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-foreground">{editingId ? "Edit bucket" : "New budget bucket"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Name</label>
              <input
                value={form.name || ""}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Rent, Groceries"
                autoFocus
                className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Allocated</label>
                <input type="number" value={form.allocated_amount || ""} onChange={e => setForm(f => ({ ...f, allocated_amount: e.target.value }))} placeholder="2000"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Spent</label>
                <input type="number" value={form.spent_amount || ""} onChange={e => setForm(f => ({ ...f, spent_amount: e.target.value }))} placeholder="0"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Due day (optional)</label>
                <input type="number" value={form.due_day || ""} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="15"
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Category (optional)</label>
                <select
                  value={form.category === "__new__" ? "__new__" : form.category || ""}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value, customCategory: e.target.value === "__new__" ? (f.customCategory || "") : "" }))}
                  className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring"
                >
                  <option value="">None</option>
                  {[...new Set([...PRESET_CATEGORIES, ...buckets.map(bk => bk.category).filter(Boolean)])].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__new__">+ Add new category...</option>
                </select>
                {form.category === "__new__" && (
                  <input
                    value={form.customCategory || ""}
                    onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                    placeholder="Enter category name"
                    autoFocus
                    className="w-full bg-secondary border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring mt-2"
                  />
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.is_fixed || false} onChange={e => setForm(f => ({ ...f, is_fixed: e.target.checked }))} className="rounded" />
              Fixed expense
            </label>
            <div className="flex gap-2">
              <button onClick={saveBucket} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
                {editingId ? "Save" : "Add"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}