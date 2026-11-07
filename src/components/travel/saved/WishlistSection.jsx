import { useState } from "react";
import { Heart, Star, Plus, Bookmark, MoreVertical, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { categoryMeta, WISHLIST_FILTERS } from "./categoryMeta";
import PillDropdown from "./PillDropdown";
import AddOwnItem from "./AddOwnItem";

export default function WishlistSection({ items, city, empty, onRemove, onAddToItinerary, onAddOwn, onAddToMemories }) {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? items : items.filter((i) => (i.category || "").toLowerCase() === filter);

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-accent" />
          <h2 className="font-heading text-[18px] text-foreground font-semibold">Wishlist{items.length > 0 ? ` · ${items.length}` : ""}</h2>
        </div>
        <PillDropdown label="Filter " value={filter} onChange={setFilter} options={WISHLIST_FILTERS} />
      </div>
      <p className="font-body text-[12px] text-muted-foreground mb-3">Places you've saved for this trip.</p>

      <div className="mb-3">
        <AddOwnItem onClick={onAddOwn} />
      </div>

      {shown.length > 0 ? (
        <div className="space-y-2.5">
          {shown.map((it) => {
            const meta = categoryMeta(it.category);
            return (
              <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-2.5 relative">
                <div className="w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden bg-muted">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
                      <meta.Icon className="w-5 h-5 text-white/80" strokeWidth={1.4} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <span className="font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{it.categoryLabel || meta.label}</span>
                  {it.website ? (
                    <a href={it.website} target="_blank" rel="noopener noreferrer" className="font-heading text-[14px] text-foreground font-semibold leading-tight mt-0.5 truncate block hover:text-accent transition-colors">{it.name}</a>
                  ) : (
                    <p className="font-heading text-[14px] text-foreground font-semibold leading-tight mt-0.5 truncate">{it.name}</p>
                  )}
                  {it.rating ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-accent fill-accent" />
                      <span className="font-body text-[11px] text-foreground">{it.rating}</span>
                      {it.reviewCount ? <span className="font-body text-[11px] text-muted-foreground">({it.reviewCount})</span> : null}
                    </div>
                  ) : null}
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5 truncate">
                    {[it.city, it.price].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onAddToItinerary(it)}
                      className="inline-flex items-center gap-1 px-3 h-7 rounded-full bg-accent text-accent-foreground font-body text-[11px] font-medium hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-3 h-3" /> Add to itinerary
                    </button>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute top-1.5 right-1.5 p-1.5 text-muted-foreground hover:text-foreground rounded-full" aria-label="More">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 rounded-lg">
                    {onAddToMemories && (
                      <DropdownMenuItem onClick={() => onAddToMemories(it)} className="gap-2 cursor-pointer">
                        <Bookmark className="w-4 h-4" /> Save to memories
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onRemove(it.id)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Heart className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="font-body text-[13px] text-muted-foreground">No saved places yet for {city}.</p>
          <p className="font-body text-[11px] text-muted-foreground/70 mt-0.5">Tap ♡ on a Top Pick to save it here.</p>
        </div>
      ) : (
        <p className="font-body text-[12px] text-muted-foreground py-2 px-1">No places match this filter.</p>
      )}
    </section>
  );
}