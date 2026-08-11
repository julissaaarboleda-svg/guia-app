import { Plus, ChevronRight } from "lucide-react";

export default function AddOwnItem({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 text-left hover:bg-secondary/40 transition-colors"
    >
      <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center flex-shrink-0">
        <Plus className="w-4 h-4 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] font-semibold text-foreground">Add your own place</p>
        <p className="font-body text-[11px] text-muted-foreground leading-snug mt-0.5">
          Can't find it in our suggestions? Add it to your wishlist.
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}