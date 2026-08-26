import { useState } from "react";
import { Plus, Trash2, Check, Pencil, X } from "lucide-react";

export default function ProjectContributions({ contributions, onAdd, onUpdate, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [markingIdx, setMarkingIdx] = useState(null);
  const [amountInput, setAmountInput] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const total = contributions.reduce((sum, c) => sum + (c.status === "received" ? Number(c.amount) || 0 : 0), 0);
  const receivedCount = contributions.filter((c) => c.status === "received").length;

  const submitAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), status: "expected", amount: null });
    setName("");
    setShowForm(false);
  };

  const startMarkReceived = (idx) => {
    setMarkingIdx(idx);
    setAmountInput("");
  };

  const confirmReceived = (idx) => {
    const amt = parseFloat(amountInput);
    if (!amt || amt <= 0) return;
    onUpdate(idx, { status: "received", amount: amt });
    setMarkingIdx(null);
    setAmountInput("");
  };

  const startEdit = (c, idx) => {
    setEditingIdx(idx);
    setEditName(c.name || "");
    setEditAmount(c.amount != null ? String(c.amount) : "");
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    const amt = parseFloat(editAmount);
    onUpdate(editingIdx, {
      name: editName.trim(),
      amount: amt > 0 ? amt : null,
      status: amt > 0 ? "received" : "expected",
    });
    setEditingIdx(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-foreground">Received so far</span>
        <span className="text-base font-bold" style={{ color: "#A7773F" }}>${total.toLocaleString()}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {contributions.length} {contributions.length === 1 ? "person" : "people"} said they'll give
        {contributions.length > 0 && ` · ${receivedCount} ${receivedCount === 1 ? "has" : "have"} sent it`}
      </p>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-2.5 text-sm font-medium mb-3 transition-colors"
          style={{ borderColor: "#A7773F", color: "#A7773F" }}
        >
          <Plus className="w-4 h-4" /> Add expected contributor
        </button>
      ) : (
        <div className="mb-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAdd()}
            placeholder="Their name"
            autoFocus
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="flex gap-2">
            <button onClick={submitAdd} className="flex-1 flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{ backgroundColor: "#A7773F" }}>
              <Plus className="w-4 h-4" /> Add
            </button>
            <button onClick={() => { setShowForm(false); setName(""); }} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No one added yet.</p>
        ) : (
          contributions.map((c, i) => {
            if (editingIdx === i) {
              return (
                <div key={i} className="py-2.5 border-t border-border">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    autoFocus
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring mb-2"
                  />
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Leave blank if not received yet"
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
            if (markingIdx === i) {
              return (
                <div key={i} className="flex items-center gap-2 py-2 border-t border-border">
                  <span className="text-sm text-foreground flex-1 truncate">{c.name}</span>
                  <div className="relative w-24 flex-shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmReceived(i)}
                      autoFocus
                      placeholder="0.00"
                      className="w-full bg-muted border border-input rounded-lg pl-5 pr-2 py-1.5 text-xs outline-none focus:border-ring"
                    />
                  </div>
                  <button onClick={() => confirmReceived(i)} className="text-white rounded-full p-1.5 flex-shrink-0" style={{ backgroundColor: "#7D8A53" }}>
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setMarkingIdx(null)} className="text-muted-foreground/50 hover:text-foreground flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }
            const received = c.status === "received";
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-t border-border">
                <span className="text-sm text-foreground flex-1 truncate">{c.name}</span>
                {received && (
                  <span className="text-sm font-medium text-foreground flex-shrink-0">${Number(c.amount).toLocaleString()}</span>
                )}
                <button
                  onClick={() => (received ? startEdit(c, i) : startMarkReceived(i))}
                  className="flex-shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors"
                  style={received ? { background: "#7D8A5320", color: "#5F6A3F" } : { background: "#A77C8120", color: "#8A5F64" }}
                >
                  {received ? "Received" : "Expected — tap to mark"}
                </button>
                <button onClick={() => startEdit(c, i)} className="text-muted-foreground/50 hover:text-foreground flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onRemove(i)} className="text-muted-foreground/50 hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
