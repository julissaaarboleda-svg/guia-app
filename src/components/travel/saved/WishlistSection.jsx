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
        <div className="grid grid-cols-2 gap-2.5">
          {shown.map((it) => {
            const meta = categoryMeta(it.category);
            return (
              <div key={it.id} className="rounded-xl border border-border bg-card overflow-hidden relative flex flex-col">
                <div className="relative h-[92px] bg-muted">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
                      <meta.Icon className="w-6 h-6 text-white/80" strokeWidth={1.4} />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 font-body text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full bg-white/85 text-foreground/80">{it.categoryLabel || meta.label}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white" aria-label="More">
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
                <div className="p-2.5 flex flex-col flex-1">
                  <div className="min-h-[52px] flex-1">
                    {it.website ? (
                      <a href={it.website} target="_blank" rel="noopener noreferrer" className="font-heading text-[13px] text-foreground font-semibold leading-tight line-clamp-2 hover:text-accent transition-colors">{it.name}</a>
                    ) : (
                      <p className="font-heading text-[13px] text-foreground font-semibold leading-tight line-clamp-2">{it.name}</p>
                    )}
                    {it.rating ? (
                      <div className="flex items-center gap-1 mt-1 font-body text-[10px] text-muted-foreground">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        {Number(it.rating).toFixed(1)}{it.reviewCount ? ` (${it.reviewCount})` : ""}
                        {it.price ? <span>· {it.price}</span> : null}
                      </div>
                    ) : null}
                    <p className="font-body text-[10.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {it.description || [it.city, it.price].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <button
                      onClick={() => onAddToItinerary(it)}
                      className="w-full inline-flex items-center justify-center gap-1 py-1 font-body text-[10.5px] text-[#A7773F] font-medium hover:opacity-80 transition-opacity"
                    >
                      <Plus className="w-3 h-3" /> Add to itinerary
                    </button>
                  </div>
                </div>
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