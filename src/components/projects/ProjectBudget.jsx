import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

// Same small palette/helpers used in ProjectTasks.jsx, so a person's color
// stays consistent across every part of a shared project.
const CHIP_COLORS = ["#A7773F", "#7D8A53", "#A77C81", "#6B655D", "#8A6530"];
function colorForPerson(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}
function initialsFor(email, currentEmail) {
  if (email === currentEmail) return "Me".slice(0, 2).toUpperCase();
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function ProjectBudget({ target, expenses, collaborators = [], currentEmail, onSetTarget, onAddExpense, onRemoveExpense, onReassignExpense }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(currentEmail || "");
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(target || "");
  const [reassigningIdx, setReassigningIdx] = useState(null);

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = target > 0 && total > target;

  const submit = () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    onAddExpense({ name: name.trim(), amount: amt, paid_by: paidBy || null });
    setName("");
    setAmount("");
    setPaidBy(currentEmail || "");
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
          {collaborators.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-shrink-0">Paid by</span>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="flex-1 bg-muted border border-input rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-ring"
              >
                <option value={currentEmail}>Me</option>
                {collaborators.filter((c) => c !== currentEmail).map((c) => (
                  <option key={c} value={c}>{c.split("@")[0]}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
              <Plus className="w-4 h-4" /> Add
            </button>
            <button onClick={() => { setShowForm(false); setName(""); setAmount(""); setPaidBy(currentEmail || ""); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
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
              {collaborators.length > 0 && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setReassigningIdx(reassigningIdx === i ? null : i)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold hover:ring-2 hover:ring-offset-1 transition-all"
                    style={e.paid_by
                      ? { background: colorForPerson(e.paid_by), "--tw-ring-color": colorForPerson(e.paid_by) }
                      : { background: "#C4BEB2" }}
                    title={e.paid_by ? (e.paid_by === currentEmail ? "Me — tap to change" : `${e.paid_by} — tap to change`) : "Tap to set who paid"}
                  >
                    {e.paid_by ? initialsFor(e.paid_by, currentEmail) : "?"}
                  </button>
                  {reassigningIdx === i && (
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[130px]">
                      <button
                        onClick={() => { onReassignExpense(i, currentEmail); setReassigningIdx(null); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary ${e.paid_by === currentEmail ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        Me
                      </button>
                      {collaborators.filter((c) => c !== currentEmail).map((c) => (
                        <button
                          key={c}
                          onClick={() => { onReassignExpense(i, c); setReassigningIdx(null); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary truncate ${e.paid_by === c ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                        >
                          {c.split("@")[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
