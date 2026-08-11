import { X, Check, Trash2, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { PACKING_CATEGORIES, categoryMeta } from "@/lib/packingAi";
import { Wallet, Shirt, Droplets, Plug, Pill, Package } from "lucide-react";

const ICONS = {
  essentials: Wallet,
  clothing: Shirt,
  toiletries: Droplets,
  tech: Plug,
  health: Pill,
  misc: Package,
};

export default function CategorySheet({ categoryId, items, onClose, onToggle, onRemove, onAddItem }) {
  const cat = categoryMeta(categoryId);
  const Icon = ICONS[categoryId] || Package;
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const list = items.filter((i) => (i.category || "misc") === categoryId);
  const packed = list.filter((i) => i.packed).length;

  const submit = () => {
    if (!newName.trim()) return;
    onAddItem({ name: newName.trim(), category: categoryId, quantity: newQty, packed: false, source: "user" });
    setNewName("");
    setNewQty(1);
    setAdding(false);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-editorial flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "#555B40" }}
            >
              <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="font-heading text-[16px] text-foreground leading-tight">{cat.label}</h2>
              <p className="font-body text-[11px] text-muted-foreground">{packed} of {list.length} packed</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {list.length === 0 && !adding ? (
            <p className="font-body text-[13px] text-muted-foreground py-8 text-center">
              No items in this category yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {list.map((item, idx) => {
                const realIdx = items.findIndex((i) => i === item);
                return (
                  <div key={idx} className="flex items-center gap-3 py-3">
                    <button
                      onClick={() => onToggle(realIdx)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.packed ? "bg-[#555B40] border-[#555B40] text-white" : "border-input hover:border-ring"
                      }`}
                    >
                      {item.packed && <Check className="w-3 h-3" />}
                    </button>
                    <span
                      className={`flex-1 font-body text-[13px] ${
                        item.packed ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {item.name}
                      {item.quantity > 1 && <span className="text-muted-foreground"> ({item.quantity})</span>}
                    </span>
                    <button
                      onClick={() => onRemove(realIdx)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {adding ? (
            <div className="mt-4 p-3 rounded-xl border border-border bg-secondary/40">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Item name"
                className="w-full bg-card border border-input rounded-lg px-3 py-2 text-[13px] text-foreground outline-none focus:border-ring"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="font-body text-[11px] text-muted-foreground">Quantity</span>
                  <button
                    onClick={() => setNewQty((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-body text-[13px] text-foreground w-5 text-center">{newQty}</span>
                  <button
                    onClick={() => setNewQty((q) => q + 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAdding(false); setNewName(""); setNewQty(1); }}
                    className="px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-[12px] font-medium hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full mt-3 border border-dashed border-border rounded-xl py-2.5 flex items-center justify-center gap-2 text-foreground hover:bg-secondary/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-body text-[12px] font-medium">Add item to {cat.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}