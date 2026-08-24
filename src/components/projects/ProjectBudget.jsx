import { useState } from "react";
import { Plus, Trash2, Check, Pencil } from "lucide-react";

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

// Expenses can now have more than one payer. Older expenses only ever had
// a single `paid_by` string — this reads either shape so nothing existing
// breaks.
function payersFor(expense) {
  if (Array.isArray(expense.paid_by)) return expense.paid_by;
  if (expense.paid_by) return [expense.paid_by];
  return [];
}

export default function ProjectBudget({ target, expenses, collaborators = [], currentEmail, onSetTarget, onAddExpense, onRemoveExpense, onReassignExpense, onUpdateExpense }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState([currentEmail].filter(Boolean));
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(target || "");
  const [reassigningIdx, setReassigningIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [expandedIdx, setExpandedIdx] = useState(null);

  const isSettled = (expense, email) => (expense.settled_by || []).includes(email);

  const toggleSettled = (idx, email) => {
    const expense = expenses[idx];
    const current = expense.settled_by || [];
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    onUpdateExpense(idx, { settled_by: next });
  };

  const startEdit = (e, i) => {
    setEditingIdx(i);
    setEditName(e.name || "");
    setEditAmount(String(e.amount ?? ""));
  };

  const saveEdit = () => {
    const amt = parseFloat(editAmount);
    if (!editName.trim() || !amt || amt <= 0) return;
    onUpdateExpense(editingIdx, { name: editName.trim(), amount: amt });
    setEditingIdx(null);
  };

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const over = target > 0 && total > target;

  const togglePayer = (email) => {
    setPaidBy((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  };

  const submit = () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    onAddExpense({ name: name.trim(), amount: amt, paid_by: paidBy.length > 0 ? paidBy : null });
    setName("");
    setAmount("");
    setPaidBy([currentEmail].filter(Boolean));
    setShowForm(false);
  };

  const saveTarget = () => {
    const t = parseFloat(targetInput);
    onSetTarget(t > 0 ? t : 0);
    setEditingTarget(false);
  };

  const togglePayerFor = (idx, email) => {
    const current = payersFor(expenses[idx]);
    const next = current.includes(email) ? current.filter((e) => e !== email) : [...current, email];
    onReassignExpense(idx, next);
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
      <div className="h-2.5 rounded-full overflow-hidden mb-1" style={{ background: "#EFE9DF" }}>
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
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Paid by</p>
              <div className="flex flex-wrap gap-1.5">
                {currentEmail && (
                  <button
                    onClick={() => togglePayer(currentEmail)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${paidBy.includes(currentEmail) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-input"}`}
                    style={paidBy.includes(currentEmail) ? { backgroundColor: colorForPerson(currentEmail) } : undefined}
                  >
                    {paidBy.includes(currentEmail) && <Check className="w-3 h-3" />} Me
                  </button>
                )}
                {collaborators.filter((c) => c !== currentEmail).map((c) => (
                  <button
                    key={c}
                    onClick={() => togglePayer(c)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${paidBy.includes(c) ? "text-white border-transparent" : "bg-muted text-muted-foreground border-input"}`}
                    style={paidBy.includes(c) ? { backgroundColor: colorForPerson(c) } : undefined}
                  >
                    {paidBy.includes(c) && <Check className="w-3 h-3" />} {c.split("@")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
              <Plus className="w-4 h-4" /> Add
            </button>
            <button onClick={() => { setShowForm(false); setName(""); setAmount(""); setPaidBy([currentEmail].filter(Boolean)); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
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
          expenses.map((e, i) => {
            if (editingIdx === i) {
              return (
                <div key={i} className="py-2.5 border-t border-border">
                  <input
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    placeholder="What was it for?"
                    autoFocus
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring mb-2"
                  />
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(ev) => setEditAmount(ev.target.value)}
                      onKeyDown={(ev) => ev.key === "Enter" && saveEdit()}
                      placeholder="0.00"
                      className="w-full bg-muted border border-input rounded-lg pl-6 pr-3 py-2 text-sm outline-none focus:border-ring"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 text-white py-1.5 rounded-lg text-xs font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
                      Save
                    </button>
                    <button onClick={() => setEditingIdx(null)} className="px-3 py-1.5 text-muted-foreground text-xs hover:text-foreground transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            const payers = payersFor(e);
            const allSettled = payers.length > 0 && payers.every((p) => isSettled(e, p));
            const isExpanded = expandedIdx === i;
            return (
              <div key={i} className="border-t border-border">
                <div className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => payers.length > 0 && setExpandedIdx(isExpanded ? null : i)}
                    className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                  >
                    <p className="text-sm text-foreground truncate">{e.name}</p>
                    {payers.length > 0 && (
                      <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${allSettled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                        {allSettled ? "Settled" : "Tracking"}
                      </span>
                    )}
                  </button>
                  <span className="text-sm font-medium text-foreground flex-shrink-0">${Number(e.amount).toLocaleString()}</span>
                {collaborators.length > 0 && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setReassigningIdx(reassigningIdx === i ? null : i)}
                      className="flex items-center -space-x-1.5"
                      title={payers.length > 0 ? payers.map((p) => (p === currentEmail ? "Me" : p)).join(", ") + " — tap to change" : "Tap to set who paid"}
                    >
                      {payers.length === 0 ? (
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: "#C4BEB2" }}>?</span>
                      ) : (
                        <>
                          {payers.slice(0, 3).map((email, idx) => (
                            <span
                              key={email}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-card"
                              style={{ background: colorForPerson(email), zIndex: 3 - idx }}
                            >
                              {initialsFor(email, currentEmail)}
                            </span>
                          ))}
                          {payers.length > 3 && (
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold border-2 border-card bg-muted-foreground">
                              +{payers.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {reassigningIdx === i && (
                      <>
                        <div className="fixed inset-0 z-[9]" onClick={() => setReassigningIdx(null)} />
                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[150px]">
                          {currentEmail && (
                            <button
                              onClick={() => togglePayerFor(i, currentEmail)}
                              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-secondary"
                            >
                              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${payers.includes(currentEmail) ? "bg-accent border-accent" : "border-input"}`}>
                                {payers.includes(currentEmail) && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              <span className={payers.includes(currentEmail) ? "font-semibold text-foreground" : "text-muted-foreground"}>Me</span>
                            </button>
                          )}
                          {collaborators.filter((c) => c !== currentEmail).map((c) => (
                            <button
                              key={c}
                              onClick={() => togglePayerFor(i, c)}
                              className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs hover:bg-secondary"
                            >
                              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${payers.includes(c) ? "bg-accent border-accent" : "border-input"}`}>
                                {payers.includes(c) && <Check className="w-2.5 h-2.5 text-white" />}
                              </span>
                              <span className={`truncate ${payers.includes(c) ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{c.split("@")[0]}</span>
                            </button>
                          ))}
                          <div className="border-t border-border mt-1 pt-1">
                            <button
                              onClick={() => setReassigningIdx(null)}
                              className="w-full text-center px-3 py-1.5 text-xs font-medium text-accent hover:bg-secondary"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={() => startEdit(e, i)} className="text-muted-foreground/50 hover:text-foreground flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onRemoveExpense(i)} className="text-muted-foreground/50 hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                </div>

                {isExpanded && payers.length > 0 && (
                  <div className="pb-2.5 pl-1 space-y-1.5">
                    {payers.map((email) => {
                      const share = Number(e.amount) / payers.length;
                      const settled = isSettled(e, email);
                      return (
                        <div key={email} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                              style={{ background: colorForPerson(email) }}
                            >
                              {initialsFor(email, currentEmail)}
                            </span>
                            <span className="text-xs text-foreground truncate">
                              {email === currentEmail ? "Me" : email.split("@")[0]} · ${share.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleSettled(i, email)}
                            className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors ${
                              settled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {settled ? (
                              <><Check className="w-2.5 h-2.5" /> Settled</>
                            ) : (
                              `Owes $${share.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
