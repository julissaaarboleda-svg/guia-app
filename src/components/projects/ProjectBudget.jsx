import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export default function ProjectBudget({ target, expenses, onSetTarget, onAddExpense, onRemoveExpense }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(target || "");

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = target > 0 && total > target;

  const submit = () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    onAddExpense({ name: name.trim(), amount: amt });
    setName("");
    setAmount("");
    setShowForm(false);
  };

  const saveTarget = () => {
    const t = parseFloat(targetInput);
    onSetTarget(t > 0 ? t : 0);
    setEditingTarget(false);
  };

  return (
    <div>
      {/* Spent / target */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-foreground">Spent</span>
        <span className="text-sm font-semibold" style={{ color: over ? "#DC2626" : "#A7773F" }}>
          ${total.toLocaleString()}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: "#A7773F26" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? "#DC2626" : "#A7773F" }}
        />
      </div>
      {editingTarget ? (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Budget target: $</span>
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTarget()}
            autoFocus
            className="w-24 bg-muted border border-input rounded-md px-2 py-1 text-xs outline-none focus:border-ring"
          />
          <button onClick={saveTarget} className="text-xs font-medium" style={{ color: "#A7773F" }}>Save</button>
          <button onClick={() => setEditingTarget(false)} className="text-xs text-muted-foreground">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => { setTargetInput(target || ""); setEditingTarget(true); }}
          className="text-xs text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          {target > 0 ? `of $${target.toLocaleString()} budget` : "Set a budget target"}
        </button>
      )}

      {/* Add expense — collapsed behind a button until tapped */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-2.5 text-sm font-medium mb-3 transition-colors"
          style={{ borderColor: "#A7773F", color: "#A7773F" }}
        >
          <Plus className="w-4 h-4" /> Add expense
        </button>
      ) : (
        <div className="mb-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What was it for?"
            autoFocus
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="0.00"
              className="w-full bg-muted border border-input rounded-lg pl-6 pr-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
              <Plus className="w-4 h-4" /> Add
            </button>
            <button onClick={() => { setShowForm(false); setName(""); setAmount(""); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-1">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No expenses yet.</p>
        ) : (
          expenses.map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-t border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{e.name}</p>
              </div>
              <span className="text-sm font-medium text-foreground flex-shrink-0">${Number(e.amount).toLocaleString()}</span>
              <button onClick={() => onRemoveExpense(i)} className="text-muted-foreground/50 hover:text-destructive flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
