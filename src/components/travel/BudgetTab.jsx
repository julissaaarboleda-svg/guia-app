import { useState, useRef } from "react";
import { ent } from "@/lib/freshEntities";
import { Plus, Trash2, DollarSign, Edit2, Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import DateInput from "@/components/DateInput";

const CATEGORIES = ["Flights", "Hotel", "Food", "Activities", "Transport", "Shopping", "Other"];

// Brand-friendly colors per category so each one always reads the same way.
const CATEGORY_COLORS = {
  Flights: "#A7773F",
  Hotel: "#5A6F45",
  Food: "#A77C81",
  Activities: "#8B6B3E",
  Transport: "#6B655D",
  Shopping: "#C9A86A",
  Other: "#B8AE9F",
};

const fmtDay = (d) => {
  const dt = new Date(String(d).length === 10 ? `${d}T12:00:00` : d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// One thin stacked bar + a legend, instead of four rings (several of them empty).
function SpendingBreakdown({ expenses, totalSpent }) {
  const totals = {};
  expenses.forEach((e) => { const c = e.category || "Other"; totals[c] = (totals[c] || 0) + (Number(e.amount) || 0); });
  const rows = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h3 className="font-heading text-[18px] text-foreground mb-3">Where it's going</h3>
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-[#E7D9C6]">
        {rows.map(([label, amt]) => (
          <div key={label} style={{ width: `${(amt / totalSpent) * 100}%`, background: CATEGORY_COLORS[label] || CATEGORY_COLORS.Other }} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {rows.map(([label, amt]) => (
          <div key={label} className="flex items-center gap-2 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[label] || CATEGORY_COLORS.Other }} />
            <span className="text-foreground flex-1">{label}</span>
            <span className="text-muted-foreground text-[12px]">{Math.round((amt / totalSpent) * 100)}%</span>
            <span className="text-foreground font-medium w-20 text-right">${amt.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetTab({ trip, onUpdate }) {
  const [form, setForm] = useState({ name: "", category: "Food", amount: "", date: "" });
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(trip.budget_target || ""));
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  // Latest trip + a save queue so two quick adds/removes can't overwrite each other.
  const latestRef = useRef(trip);
  latestRef.current = trip;
  const queueRef = useRef(Promise.resolve());
  const save = (compute) => {
    queueRef.current = queueRef.current
      .then(async () => {
        const patch = compute(latestRef.current);
        if (!patch) return;
        const result = await ent.Trip.update(trip.id, patch);
        if (result) { latestRef.current = result; onUpdate(result); }
      })
      .catch((err) => { console.error("Budget save failed:", err); toast.error("Couldn't save that change. Try again."); });
    return queueRef.current;
  };

  const expenses = trip.expense_items || [];
  const budgetTarget = trip.budget_target || 0;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = budgetTarget - totalSpent;
  const pct = budgetTarget > 0 ? Math.min((totalSpent / budgetTarget) * 100, 100) : 0;
  const isOverBudget = budgetTarget > 0 && totalSpent > budgetTarget;
  const isNearBudget = !isOverBudget && pct >= 80 && budgetTarget > 0;

  // Group expenses by category, keeping each item's original index so
  // "remove" still targets the right entry in the flat expense_items array.
  const expenseGroups = [];
  const groupMap = new Map();
  expenses.forEach((e, idx) => {
    const cat = e.category || "Other";
    if (!groupMap.has(cat)) {
      const group = { category: cat, items: [], total: 0 };
      groupMap.set(cat, group);
      expenseGroups.push(group);
    }
    const group = groupMap.get(cat);
    group.items.push({ ...e, idx });
    group.total += Number(e.amount) || 0;
  });
  expenseGroups.sort((a, b) => b.total - a.total);

  const toggleCategory = (cat) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const saveBudget = async () => {
    await save(() => ({ budget_target: budgetInput ? Number(budgetInput) : null }));
    setEditingBudget(false);
  };

  const addExpense = async () => {
    if (!form.name.trim() || !form.amount) return;
    const entry = { ...form, name: form.name.trim(), amount: Number(form.amount) };
    setForm({ name: "", category: form.category, amount: "", date: "" });
    setShowForm(false);
    await save((t) => ({ expense_items: [...(t.expense_items || []), entry] }));
  };

  const removeExpense = (idx) => save((t) => ({ expense_items: (t.expense_items || []).filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4 font-body">
      <SpendingBreakdown expenses={expenses} totalSpent={totalSpent} />

      {/* Budget summary */}
      {editingBudget ? (
        <div className="bg-card border border-border rounded-2xl p-5">
          <label className="text-xs text-muted-foreground mb-1.5 block">Budget target ($)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveBudget()}
              className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F]"
              placeholder="0"
              autoFocus
            />
            <button onClick={saveBudget} className="flex items-center gap-1 bg-[#A7773F] text-[#F7F3EC] px-4 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-colors">
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={() => { setEditingBudget(false); setBudgetInput(String(trip.budget_target || "")); }} className="px-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : budgetTarget > 0 ? (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="font-heading text-[18px] text-foreground">Budget target</span>
            <div className="flex items-center gap-2">
              <span className="font-heading text-[18px] text-foreground">${budgetTarget.toLocaleString()}</span>
              <button onClick={() => setEditingBudget(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Spent: <strong>${totalSpent.toLocaleString()}</strong></span>
            <span className={`text-xs font-semibold ${isOverBudget ? "text-[#8F6368]" : isNearBudget ? "text-[#8B6B3E]" : "text-foreground"}`}>
              {isOverBudget
                ? `Over by $${(totalSpent - budgetTarget).toLocaleString()}`
                : `$${remaining.toLocaleString()} remaining`}
            </span>
          </div>
          <div className="h-1.5 bg-[#E7D9C6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? "bg-[#A77C81]" : "bg-[#A7773F]"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-right">{Math.round(pct)}% used</p>
        </div>
      ) : (
        <div className="bg-muted border border-dashed border-border rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">No budget target set.</p>
          <button onClick={() => setEditingBudget(true)} className="text-xs font-medium" style={{ color: "#A7773F" }}>Set budget target</button>
        </div>
      )}

      {/* Add expense — collapsed until tapped */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed rounded-2xl py-3 text-sm font-medium"
          style={{ borderColor: "#A7773F", color: "#A7773F" }}
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} /> Add expense
        </button>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-heading text-[18px] text-foreground">New expense</h3>
          <input
            placeholder="What was it?"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addExpense()}
            autoFocus
            className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F] transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${form.category === c ? "bg-[#E7D9C6] text-foreground" : "border border-border text-muted-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Amount ($)"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F]"
            />
            <DateInput
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#A7773F]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addExpense}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#A7773F] text-[#F7F3EC] px-4 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} /> Add expense
            </button>
            <button onClick={() => { setShowForm(false); setForm({ name: "", category: form.category, amount: "", date: "" }); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Expense list — grouped by category, collapsed by default so a
          trip with many expenses doesn't turn into one long scroll. */}
      {expenses.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-heading text-[18px] text-foreground">Expenses</h3>
            <span className="text-xs text-muted-foreground">{expenses.length} items</span>
          </div>
          <div className="divide-y divide-border">
            {expenseGroups.map((group) => {
              const isOpen = expandedCats.has(group.category);
              return (
                <div key={group.category}>
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className="text-sm text-foreground font-medium">{group.category}</span>
                      <span className="text-xs text-muted-foreground">({group.items.length})</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">${group.total.toLocaleString()}</span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-border/60 bg-muted/30">
                      {group.items.map((e) => (
                        <div key={e.idx} className="flex items-center gap-3 pl-9 pr-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{e.name}</p>
                            {e.date && <span className="text-xs text-muted-foreground">{fmtDay(e.date)}</span>}
                          </div>
                          <span className="text-sm font-medium text-foreground flex-shrink-0">${Number(e.amount).toLocaleString()}</span>
                          <button onClick={() => removeExpense(e.idx)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted flex justify-between items-center">
            <span className="text-sm font-medium text-foreground">Total spent</span>
            <span className="text-base font-bold text-foreground">${totalSpent.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No expenses yet. Add items above.</p>
        </div>
      )}
    </div>
  );
}
