import { useState } from "react";
import { X, Check } from "lucide-react";

const CATEGORIES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "museum", label: "Museum" },
  { value: "experience", label: "Experience" },
];

export default function ManualItemModal({ city, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      category,
      categoryLabel: CATEGORIES.find((c) => c.value === category)?.label || "Pick",
      description: description.trim(),
      website: website.trim(),
      rating: null,
      reviewCount: null,
      price: "",
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm shadow-editorial flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-lg text-foreground">Add your own item</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Place name…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">City</label>
            <input value={city} disabled className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="A short note…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 border-t border-border">
          <button
            onClick={submit}
            className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Check className="w-4 h-4" /> Add to wishlist
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}