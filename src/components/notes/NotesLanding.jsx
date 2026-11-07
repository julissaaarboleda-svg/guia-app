import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, FileText, MoreHorizontal, MapPin, Navigation, ChevronRight, ArrowRight } from "lucide-react";
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
  const [showAllCollections, setShowAllCollections] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  // Checklist notes already carry note_type "list" — Checklists is purely a
  // filtered view of the same data, not a separate thing to migrate.
  const plainNotes = useMemo(() => notes.filter((n) => n.note_type !== "list"), [notes]);
  const checklistNotes = useMemo(() => notes.filter((n) => n.note_type === "list"), [notes]);

  const visibleFolders = useMemo(
    () => folders.filter((f) => !f.archived).sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (plainNotes.some((n) => n.folder_id === b.id) ? 1 : 0) - (plainNotes.some((n) => n.folder_id === a.id) ? 1 : 0)),
    [folders, plainNotes]
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
    return showAllRecent ? list : list.slice(0, 6);
  }, [plainNotes, query, sortNewest, showAllRecent]);

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

  const subtitle = { notes: "Capture, plan and keep what matters.", checklists: "Track what needs doing.", places: "Somewhere you want to check out." }[view];
  const addLabel = { notes: "Note", checklists: "Checklist", places: "Place" }[view];
  const onAdd = () => (view === "notes" ? onQuickCapture() : view === "checklists" ? onQuickCapture("list") : onAddPlace());
  const shownFolders = showAllCollections ? visibleFolders : visibleFolders.slice(0, 4);

  return (
    <div className="px-6 md:px-10 lg:px-14 pb-8 max-w-[900px] mx-auto w-full space-y-3" style={{ paddingTop: "1rem" }}>
      {/* Header */}
      <header className="pb-1">
        <h1 className="font-heading text-[34px] leading-tight font-bold text-foreground">Notes</h1>
        <p className="font-heading italic text-[15px] text-muted-foreground mt-0.5">{subtitle}</p>
      </header>

      {/* Three-way toggle */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: "notes", label: "Notes" },
          { id: "checklists", label: "Checklists" },
          { id: "places", label: "Saved Places" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-2 rounded-full font-heading text-[14px] whitespace-nowrap flex-shrink-0 transition-colors ${
              view === t.id ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search, sort, add */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-card border border-border rounded-full px-4 h-10">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "places" ? "Search saved places…" : view === "checklists" ? "Search checklists…" : "Search notes…"}
            className="flex-1 min-w-0 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setSortNewest((s) => !s)}
          aria-label={sortNewest ? "Sorted newest first" : "Sorted oldest first"}
          title={sortNewest ? "Newest first" : "Oldest first"}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-border bg-card text-foreground flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.6} />
        </button>
        <button
          onClick={onAdd}
          className="h-10 px-4 rounded-full bg-[#A7773F] text-[#F7F3EC] font-heading text-[13px] flex-shrink-0 hover:opacity-90 transition-opacity"
        >
          + {addLabel}
        </button>
      </div>

      {/* ---------------- NOTES VIEW ---------------- */}
      {view === "notes" && (
        <>
          <section className="space-y-3 pt-2">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[22px] text-foreground leading-tight">Collections</h2>
              {visibleFolders.length > 4 && (
                <button onClick={() => setShowAllCollections((v) => !v)} className="font-heading text-[13px] text-[#A7773F] flex items-center gap-1">
                  {showAllCollections ? "Show less" : "View all"} {!showAllCollections && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[76px] rounded-2xl bg-card border border-border/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {shownFolders.map((f) => (
                  <CollectionCard
                    key={f.id}
                    folder={f}
                    count={countFor(f.id)}
                    onOpen={onOpenCollection}
                    onLongPress={onLongPressCollection}
                  />
                ))}
              </div>
            )}
            <button
              onClick={onNewCollection}
              className="w-full h-11 flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 font-heading text-[14px] text-foreground hover:bg-card transition-colors"
            >
              + New collection
            </button>
          </section>

          <section className="space-y-3 pt-2">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[22px] text-foreground leading-tight">Recent notes</h2>
              {plainNotes.length > 6 && !query && (
                <button onClick={() => setShowAllRecent((v) => !v)} className="font-heading text-[13px] text-[#A7773F] flex items-center gap-1">
                  {showAllRecent ? "Show less" : "View all"} {!showAllRecent && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            {loading ? (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[62px] border-t border-border/40 first:border-t-0 animate-pulse" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl py-8 text-center">
                <p className="font-heading text-base text-foreground">{query ? "No notes match your search." : "No notes yet."}</p>
                {!query && <p className="text-xs text-muted-foreground mt-1">Tap + Note to write your first one.</p>}
              </div>
            ) : (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                {recent.map((n, i) => {
                  const fname = n.folder_id ? folderName(n.folder_id) : null;
                  return (
                  <div key={n.id} className={`flex items-center transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}>
                    <button
                      onClick={() => onOpenNote(n)}
                      className="flex-1 min-w-0 py-3 pl-4 pr-2 flex items-center gap-3 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <span className="w-10 h-10 rounded-xl bg-[#F0E6D6] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-[18px] h-[18px] text-[#8B6B3E]" strokeWidth={1.5} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading text-[16px] text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
                        <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">
                          {noteDateLabel(n.updated_date)}{fname ? ` · ${fname}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
                    </button>
                    <button
                      onClick={() => onNoteMenu(n)}
                      aria-label="Note options"
                      className="w-8 h-8 mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ---------------- CHECKLISTS VIEW ---------------- */}
      {view === "checklists" && (
        <>
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
