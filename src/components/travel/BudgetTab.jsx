import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, DollarSign, Edit2, Check, X } from "lucide-react";
import DateInput from "@/components/DateInput";

const CATEGORIES = ["Flights", "Hotel", "Food", "Activities", "Transport", "Shopping", "Other"];

export default function BudgetTab({ trip, onUpdate }) {
  const [form, setForm] = useState({ name: "", category: "Food", amount: "", date: "" });
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(trip.budget_target || ""));

  const expenses = trip.expense_items || [];
  const budgetTarget = trip.budget_target || 0;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = budgetTarget - totalSpent;
  const pct = budgetTarget > 0 ? Math.min((totalSpent / budgetTarget) * 100, 100) : 0;
  const isOverBudget = budgetTarget > 0 && totalSpent > budgetTarget;
  const isNearBudget = !isOverBudget && pct >= 80 && budgetTarget > 0;

  const saveBudget = async () => {
    const updated = await base44.entities.Trip.update(trip.id, { budget_target: budgetInput ? Number(budgetInput) : null });
    onUpdate(updated);
    setEditingBudget(false);
  };

  const addExpense = async () => {
    if (!form.name.trim() || !form.amount) return;
    const updated = [...expenses, { ...form, amount: Number(form.amount) }];
    const result = await base44.entities.Trip.update(trip.id, { expense_items: updated });
    onUpdate(result);
    setForm({ name: "", category: "Food", amount: "", date: "" });
  };

  const removeExpense = async (idx) => {
    const updated = expenses.filter((_, i) => i !== idx);
    const result = await base44.entities.Trip.update(trip.id, { expense_items: updated });
    onUpdate(result);
  };

  return (
    <div className="space-y-4 font-body">
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
              className="flex-1 bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder="0"
              autoFocus
            />
            <button onClick={saveBudget} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-colors">
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
            <span className="text-sm font-medium text-foreground">Budget target</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">${budgetTarget.toLocaleString()}</span>
              <button onClick={() => setEditingBudget(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Spent: <strong>${totalSpent.toLocaleString()}</strong></span>
            <span className={`text-xs font-semibold ${isOverBudget ? "text-destructive" : isNearBudget ? "text-amber-600" : "text-green-700"}`}>
              {isOverBudget
                ? `Over by $${(totalSpent - budgetTarget).toLocaleString()}`
                : `$${remaining.toLocaleString()} remaining`}
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isOverBudget ? "bg-destructive" : isNearBudget ? "bg-amber-500" : "bg-green-600"}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">{Math.round(pct)}% used</p>
        </div>
      ) : (
        <div className="bg-muted border border-dashed border-border rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">No budget target set.</p>
          <button onClick={() => setEditingBudget(true)} className="text-xs text-foreground font-medium underline">Set budget target</button>
        </div>
      )}

      {/* Add expense */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-heading font-medium text-foreground">Add expense</h3>
        <input
          placeholder="Expense name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && addExpense()}
          className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            placeholder="Amount ($)"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Date (optional)</label>
          <DateInput
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <button
          onClick={addExpense}
          className="w-full flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Expense list */}
      {expenses.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-heading font-medium text-foreground">Expenses</h3>
            <span className="text-xs text-muted-foreground">{expenses.length} items</span>
          </div>
          <div className="divide-y divide-border">
            {expenses.map((e, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{e.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{e.category}</span>
                    {e.date && <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground flex-shrink-0">${Number(e.amount).toLocaleString()}</span>
                <button onClick={() => removeExpense(idx)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
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