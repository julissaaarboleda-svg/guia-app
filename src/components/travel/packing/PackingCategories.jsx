import { ChevronRight, Plus } from "lucide-react";
import { Wallet, Shirt, Droplets, Plug, Pill, Package } from "lucide-react";
import { PACKING_CATEGORIES } from "@/lib/packingAi";

const ICONS = {
  essentials: Wallet,
  clothing: Shirt,
  toiletries: Droplets,
  tech: Plug,
  health: Pill,
  misc: Package,
};

export default function PackingCategories({ items, onOpenCategory, onAddCustom }) {
  const countFor = (id) => items.filter((i) => (i.category || "misc") === id).length;
  const packedFor = (id) => items.filter((i) => (i.category || "misc") === id && i.packed).length;

  return (
    <div>
      <h3 className="font-heading text-[14px] font-medium text-foreground mb-1">Packing categories</h3>
      <p className="font-body text-[11px] text-muted-foreground mb-3">Tap a category to view and manage your items.</p>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {PACKING_CATEGORIES.map((c) => {
          const Icon = ICONS[c.id] || Package;
          const total = countFor(c.id);
          const packed = packedFor(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onOpenCategory(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#555B40" }}
              >
                <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="flex-1 font-body text-[13px] text-foreground font-medium">{c.label}</span>
              <span className="font-body text-[11px] text-muted-foreground">{packed} / {total} items</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
      <button
        onClick={onAddCustom}
        className="w-full mt-3 border border-dashed border-border rounded-2xl py-3 flex items-center justify-center gap-2 text-foreground hover:bg-secondary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="font-body text-[13px] font-medium">Add Custom Item</span>
      </button>
    </div>
  );
}