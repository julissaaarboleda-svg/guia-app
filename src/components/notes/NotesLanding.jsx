import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, Pencil, Plus, MoreHorizontal, MapPin, Navigation } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import CollectionCard from "./CollectionCard";

const noteDateLabel = (d) => {
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
};

const stripHtml = (html) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || "";
};

// Universal Google Maps search link — opens whatever maps app is installed,
// or falls back to the browser. Same approach used for itinerary addresses.
function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function NotesLanding({
  notes, folders, savedPlaces = [], loading,
  onQuickCapture, onOpenCollection, onOpenNote,
  onNewCollection, onLongPressCollection, onNoteMenu,
  onAddPlace, onPlaceMenu,
}) {
  const [view, setView] = useState("notes"); // "notes" | "checklists" | "places"
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  // Checklist notes already carry note_type "list" — Checklists is purely a
  // filtered view of the same data, not a separate thing to migrate.
  const plainNotes = useMemo(() => notes.filter((n) => n.note_type !== "list"), [notes]);
  const checklistNotes = useMemo(() => notes.filter((n) => n.note_type === "list"), [notes]);

  const visibleFolders = useMemo(
    () => folders.filter((f) => !f.archived).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    [folders]
  );

  const countFor = (folderId) => plainNotes.filter((n) => n.folder_id === folderId).length;
  const folderName = (id) => folders.find((f) => f.id === id)?.name;

  const recent = useMemo(() => {
    let list = [...plainNotes];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((n) => n.title?.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    }
    list.sort((a, b) => new Date(sortNewest ? b.updated_date : a.updated_date) - new Date(sortNewest ? a.updated_date : b.updated_date));
    return list.slice(0, 6);
  }, [plainNotes, query, sortNewest]);

  const recentChecklists = useMemo(() => {
    let list = [...checklistNotes];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((n) => n.title?.toLowerCase().includes(q));
    }
    list.sort((a, b) => new Date(sortNewest ? b.updated_date : a.updated_date) - new Date(sortNewest ? a.updated_date : b.updated_date));
    return list;
  }, [checklistNotes, query, sortNewest]);

  const filteredPlaces = useMemo(() => {
    let list = [...savedPlaces];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.type?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q));
    }
    list.sort((a, b) => new Date(sortNewest ? b.updated_date : a.updated_date) - new Date(sortNewest ? a.updated_date : b.updated_date));
    return list;
  }, [savedPlaces, query, sortNewest]);

  const subtitle = { notes: "Capture ideas and inspiration.", checklists: "Track what needs doing.", places: "Somewhere you want to check out." }[view];

  return (
    <div className="px-6 md:px-10 lg:px-14 pb-8 max-w-[900px] mx-auto w-full space-y-3" style={{ paddingTop: "1rem" }}>
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground truncate">Notes</h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 pt-1.5 flex-shrink-0">
          <button
            onClick={() => setShowSearch((s) => !s)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showSearch ? "bg-secondary text-foreground" : "text-foreground hover:bg-secondary"}`}
          >
            <Search className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => setSortNewest((s) => !s)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      {/* Three-way toggle */}
      <div className="flex gap-1.5">
        {[
          { id: "notes", label: "Notes" },
          { id: "checklists", label: "Checklists" },
          { id: "places", label: "Saved Places" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-3.5 py-1.5 rounded-full font-body text-[12.5px] font-medium transition-colors ${
              view === t.id ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showSearch && (
        <div className="-mt-1">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "places" ? "Search saved places…" : view === "checklists" ? "Search checklists…" : "Search notes…"}
            className="w-full bg-card border border-border rounded-xl px-4 py-2 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
      )}

      {/* ---------------- NOTES VIEW ---------------- */}
      {view === "notes" && (
        <>
          <button
            onClick={onQuickCapture}
            className="w-full h-[46px] flex items-center gap-3 bg-card border border-border/60 rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="w-6 h-6 rounded-full bg-[#B49399] flex items-center justify-center flex-shrink-0">
              <Pencil className="w-3 h-3 text-white" strokeWidth={1.8} />
            </span>
            <span className="font-body text-[13px] text-[#6E6B67]">Write a note…</span>
          </button>

          <section className="space-y-2.5">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-lg text-[#232323] font-semibold leading-tight">Collections</h2>
              <button className="font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors">View All</button>
            </div>
            {loading ? (
              <div className="grid grid-cols-3 gap-2.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[108px] rounded-2xl bg-card border border-border/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {visibleFolders.map((f) => (
                  <CollectionCard
                    key={f.id}
                    folder={f}
                    count={countFor(f.id)}
                    onOpen={onOpenCollection}
                    onLongPress={onLongPressCollection}
                  />
                ))}
                <button
                  onClick={onNewCollection}
                  className="h-[108px] flex flex-col items-center justify-center bg-transparent border border-dashed border-border/60 rounded-2xl transition-all hover:border-[#B49399]/60 hover:bg-card/40"
                >
                  <div className="w-11 h-11 rounded-[11px] bg-secondary flex items-center justify-center mb-2">
                    <Plus className="w-[22px] h-[22px] text-[#B49399]" strokeWidth={1.6} />
                  </div>
                  <p className="font-body text-[13px] font-medium text-muted-foreground">New</p>
                </button>
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-lg text-[#232323] font-semibold leading-tight">Recent Notes</h2>
              <button className="font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors">View All</button>
            </div>
            {loading ? (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[62px] border-t border-border/40 first:border-t-0 animate-pulse" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl py-8 text-center">
                <p className="font-body text-[14px] text-[#7C7A76]">
                  {query ? "No notes match your search." : "No notes yet. Tap “Write a note” to begin."}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                {recent.map((n, i) => (
                  <div
                    key={n.id}
                    className={`flex items-center transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}
                  >
                    <button
                      onClick={() => onOpenNote(n)}
                      className="flex-1 min-w-0 h-[52px] flex items-center px-4 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-[13.5px] font-medium text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
                        <p className="font-body text-[10px] text-[#8E8A84] mt-0.5 truncate">
                          {noteDateLabel(n.updated_date)}{n.folder_id ? ` · ${folderName(n.folder_id)}` : ""}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => onNoteMenu(n)}
                      className="w-8 h-8 mr-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ---------------- CHECKLISTS VIEW ---------------- */}
      {view === "checklists" && (
        <>
          <button
            onClick={() => onQuickCapture("list")}
            className="w-full h-[46px] flex items-center gap-3 bg-card border border-border/60 rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="w-6 h-6 rounded-full bg-[#B49399] flex items-center justify-center flex-shrink-0">
              <Plus className="w-3 h-3 text-white" strokeWidth={1.8} />
            </span>
            <span className="font-body text-[13px] text-[#6E6B67]">New checklist…</span>
          </button>

          {loading ? (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[62px] border-t border-border/40 first:border-t-0 animate-pulse" />
              ))}
            </div>
          ) : recentChecklists.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-2xl py-8 text-center">
              <p className="font-body text-[14px] text-[#7C7A76]">
                {query ? "No checklists match your search." : "No checklists yet."}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              {recentChecklists.map((n, i) => {
                const items = n.list_items || [];
                const done = items.filter((it) => it.checked).length;
                const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                return (
                  <div key={n.id} className={`flex items-center transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}>
                    <button
                      onClick={() => onOpenNote(n)}
                      className="flex-1 min-w-0 py-2.5 px-4 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[13.5px] font-medium text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
                        <span className="font-body text-[10.5px] font-semibold flex-shrink-0" style={{ color: done === items.length && items.length > 0 ? "#5F6A3F" : "#8A5F64" }}>
                          {done}/{items.length}
                        </span>
                      </div>
                      {items.length > 0 && (
                        <div className="h-[3px] rounded-full bg-[#EFE9DF] overflow-hidden mt-1.5">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#7D8A53" : "#A77C81" }} />
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => onNoteMenu(n)}
                      className="w-8 h-8 mr-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------------- SAVED PLACES VIEW ---------------- */}
      {view === "places" && (
        <>
          <button
            onClick={onAddPlace}
            className="w-full h-[46px] flex items-center gap-3 bg-card border border-border/60 rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="w-6 h-6 rounded-full bg-[#B49399] flex items-center justify-center flex-shrink-0">
              <Plus className="w-3 h-3 text-white" strokeWidth={1.8} />
            </span>
            <span className="font-body text-[13px] text-[#6E6B67]">Save a place…</span>
          </button>

          {loading ? (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[62px] border-t border-border/40 first:border-t-0 animate-pulse" />
              ))}
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-2xl py-8 text-center">
              <p className="font-body text-[14px] text-[#7C7A76]">
                {query ? "No saved places match your search." : "Nowhere saved yet."}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              {filteredPlaces.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 py-2.5 px-4 transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}>
                  <span className="w-9 h-9 rounded-[10px] bg-[#A7773F1F] flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-[#A7773F]" strokeWidth={1.8} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[13.5px] font-medium text-foreground truncate leading-snug">{p.name || "Untitled place"}</p>
                    <p className="font-body text-[10.5px] text-[#8E8A84] mt-0.5 truncate">
                      {[p.type, p.address].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {p.address && (
                    <a
                      href={mapsUrl(p.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center text-[#A7773F] hover:text-[#8A5F2E] transition-colors flex-shrink-0"
                      title="Open in maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => onPlaceMenu(p)}
                    className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
