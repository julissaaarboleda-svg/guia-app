import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, FileText, MoreHorizontal, MapPin, ArrowRight, Pin, ChevronDown, ChevronRight } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import CollectionCard from "./CollectionCard";
import { accentHex, COLLECTION_ACCENTS } from "./collectionAccents";

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
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [placeFilter, setPlaceFilter] = useState("All");

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
  const folderColor = (id) => { const f = folders.find((x) => x.id === id); return f ? accentHex(f.accent_color) : "#A7773F"; };
  // Checklists have no color setting yet, so each gets a steady brand color from its id.
  const LIST_COLORS = Object.values(COLLECTION_ACCENTS);
  const listColor = (id = "") => LIST_COLORS[[...String(id)].reduce((t, ch) => t + ch.charCodeAt(0), 0) % LIST_COLORS.length];

  const sortNotes = (list) => list.sort((x, y) => new Date(sortNewest ? y.updated_date : x.updated_date) - new Date(sortNewest ? x.updated_date : y.updated_date));
  const searching = !!query.trim();
  const matches = (n) => { const q = query.toLowerCase(); return n.title?.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q); };

  const pinned = useMemo(
    () => (searching ? [] : sortNotes(plainNotes.filter((n) => n.pinned))),
    [plainNotes, searching, sortNewest] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const recentAll = useMemo(() => {
    const base = searching ? plainNotes.filter(matches) : plainNotes.filter((n) => !n.pinned);
    return sortNotes([...base]);
  }, [plainNotes, query, sortNewest]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = showAllRecent || searching ? recentAll : recentAll.slice(0, 6);

  const renderNoteRow = (n, i) => {
    const fname = n.folder_id ? folderName(n.folder_id) : null;
    const preview = stripHtml(n.content).replace(/\s+/g, " ").trim();
    return (
      <div key={n.id} className={`flex items-start transition-colors ${i !== 0 ? "border-t border-border/40" : ""}`}>
        <button onClick={() => onOpenNote(n)} className="flex-1 min-w-0 py-3 pl-4 pr-2 flex items-start gap-3 text-left hover:bg-secondary/50 transition-colors">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: n.folder_id ? folderColor(n.folder_id) : "#A7773F" }}>
            <FileText className="w-[17px] h-[17px] text-white" strokeWidth={1.5} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-[16px] text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
            {preview && <p className="font-body text-[12.5px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{preview}</p>}
            <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
              {n.pinned && <Pin className="w-3 h-3 text-[#A7773F] flex-shrink-0" strokeWidth={1.8} />}
              <span className="font-body text-[11px] text-muted-foreground flex-shrink-0">{noteDateLabel(n.updated_date)}</span>
              {fname && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full truncate" style={{ background: `${folderColor(n.folder_id)}1F`, color: folderColor(n.folder_id) === "#7D8A53" ? "#566033" : folderColor(n.folder_id) === "#A77C81" ? "#8F5F65" : folderColor(n.folder_id) }}>{fname}</span>}
            </div>
          </div>
        </button>
        <button onClick={() => onNoteMenu(n)} aria-label="Note options" className="w-8 h-8 mt-2 mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    );
  };

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
    let list = savedPlaces.filter((p) => placeFilter === "All" || p.type === placeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.type?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q));
    }
    list.sort((a, b) => new Date(sortNewest ? b.updated_date : a.updated_date) - new Date(sortNewest ? a.updated_date : b.updated_date));
    return list;
  }, [savedPlaces, query, sortNewest, placeFilter]);
  const [placeShut, setPlaceShut] = useState(() => { try { return JSON.parse(localStorage.getItem("guia-places-shut") || "{}"); } catch { return {}; } });
  const togglePlaceGroup = (k) => setPlaceShut((c) => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem("guia-places-shut", JSON.stringify(n)); } catch { /* optional */ } return n; });
  const placeGroups = useMemo(() => [
    { key: "try", label: "To try", list: filteredPlaces.filter((p) => !p.visited) },
    { key: "been", label: "Been there", list: filteredPlaces.filter((p) => p.visited)
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || String(b.visited_on || "").localeCompare(String(a.visited_on || ""))) },
  ], [filteredPlaces]);
  const placeTypes = useMemo(() => [...new Set(savedPlaces.map((p) => p.type).filter(Boolean))], [savedPlaces]);

  const subtitle = { notes: "Capture, plan and keep what matters.", checklists: "Track what needs doing.", places: "Somewhere you want to check out." }[view];
  const addLabel = { notes: "Note", checklists: "Checklist", places: "Place" }[view];
  const onAdd = () => (view === "notes" ? onQuickCapture() : view === "checklists" ? onQuickCapture("list") : onAddPlace());

  return (
    <div className="px-6 md:px-10 lg:px-14 pb-8 max-w-[1200px] 2xl:max-w-[1400px] mx-auto w-full space-y-3" style={{ paddingTop: "1rem" }}>
      {/* Header */}
      <header className="pb-1">
        <h1 className="font-heading text-[30px] leading-tight font-bold text-foreground">Notes</h1>
        <p className="font-heading italic text-[15px] text-muted-foreground mt-0.5">{subtitle}</p>
      </header>

      {/* Three-way toggle */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: "notes", label: "Notes" },
          { id: "checklists", label: "Checklists" },
          { id: "places", label: "Saved places" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-3.5 py-1.5 rounded-full font-body text-[12.5px] font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              view === t.id ? "bg-[#2E2A27] text-[#F7F3EC]" : "border border-border bg-card text-muted-foreground hover:text-foreground"
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
          className="h-10 px-1.5 font-body text-[13px] font-medium text-[#A7773F] flex-shrink-0 whitespace-nowrap hover:opacity-80 transition-opacity"
        >
          + New {addLabel.toLowerCase()}
        </button>
      </div>

      {/* ---------------- NOTES VIEW ---------------- */}
      {view === "notes" && (
        <>
          <section className="space-y-2.5 pt-1">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[20px] text-foreground leading-tight">Collections</h2>
              {visibleFolders.length > 0 && <span className="font-body text-[11px] text-muted-foreground">Press and hold to edit</span>}
            </div>
            {loading ? (
              <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2].map((i) => <div key={i} className="h-[52px] w-[150px] flex-shrink-0 rounded-2xl bg-card border border-border/50 animate-pulse" />)}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap pb-0.5">
                {visibleFolders.map((f) => (
                  <CollectionCard key={f.id} folder={f} count={countFor(f.id)} onOpen={onOpenCollection} onLongPress={onLongPressCollection} compact />
                ))}
                <button onClick={onNewCollection} className="flex-shrink-0 h-[52px] px-4 rounded-2xl border border-dashed border-border bg-card/40 font-body text-[13px] text-muted-foreground hover:bg-card transition-colors">
                  + New
                </button>
              </div>
            )}
          </section>

          {pinned.length > 0 && (
            <section className="space-y-2.5 pt-2">
              <h2 className="font-heading text-[20px] text-foreground leading-tight">Pinned</h2>
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">{pinned.map(renderNoteRow)}</div>
            </section>
          )}

          <section className="space-y-2.5 pt-2">
            <div className="flex items-end justify-between">
              <h2 className="font-heading text-[20px] text-foreground leading-tight">{searching ? "Results" : pinned.length ? "Recent" : "Recent notes"}</h2>
              {recentAll.length > 6 && !searching && (
                <button onClick={() => setShowAllRecent((v) => !v)} className="font-body text-[12px] font-medium text-[#A7773F] flex items-center gap-1">
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
                <p className="font-heading text-base text-foreground">{query ? "No notes match your search." : pinned.length ? "Everything else is pinned." : "No notes yet."}</p>
                {!query && !pinned.length && <p className="text-xs text-muted-foreground mt-1">Tap + Note to write your first one.</p>}
              </div>
            ) : (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">{recent.map(renderNoteRow)}</div>
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
            <div className="space-y-2.5">
              {recentChecklists.map((n) => {
                const items = n.list_items || [];
                const done = items.filter((it) => it.checked).length;
                const pct = items.length ? Math.round((done / items.length) * 100) : 0;
                const complete = items.length > 0 && done === items.length;
                const left = items.filter((it) => !it.checked);
                const lc = listColor(n.id);
                return (
                  <div key={n.id} className="bg-card border border-border/60 rounded-2xl flex items-start" style={{ borderLeft: `4px solid ${lc}` }}>
                    <button onClick={() => onOpenNote(n)} className="flex-1 min-w-0 p-3.5 text-left">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-heading text-[16px] text-foreground truncate leading-snug">{n.title || "Untitled"}</p>
                        <span className="font-body text-[11px] text-muted-foreground flex-shrink-0">{done} of {items.length}</span>
                      </div>
                      {items.length > 0 && (
                        <div className="h-1 rounded-full bg-[#EFE9DF] overflow-hidden mt-2.5">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: lc }} />
                        </div>
                      )}
                      {complete ? <p className="font-body text-[12.5px] mt-2 text-[#566033]">All done</p>
                        : left.length ? (
                          <div className="mt-2 space-y-1">
                            {left.slice(0, 3).map((it, k) => (
                              <p key={k} className="font-body text-[12.5px] flex items-center gap-1.5 min-w-0"><span className="w-3 h-3 rounded-full border-[1.5px] border-muted-foreground/40 flex-shrink-0" /><span className="truncate text-foreground">{it.text}</span></p>
                            ))}
                            {left.length > 3 && <p className="font-body text-[11.5px] text-muted-foreground pl-[18px]">+{left.length - 3} more</p>}
                          </div>
                        ) : <p className="font-body text-[12.5px] mt-2 text-muted-foreground">Empty list</p>}
                    </button>
                    <button onClick={() => onNoteMenu(n)} aria-label="Checklist options" className="w-8 h-8 mt-2 mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
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
          {placeTypes.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {["All", ...placeTypes].map((t) => (
                <button key={t} onClick={() => setPlaceFilter(t)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 border transition-colors ${placeFilter === t ? "bg-[#F3E8D6] text-[#8A5F27] border-[#E6D3B0]" : "border-border text-muted-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
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
              {placeGroups.filter((g) => g.list.length).map((g, gi) => (
                <div key={g.key} className={gi ? "border-t border-border/60" : ""}>
                  <button onClick={() => togglePlaceGroup(g.key)} aria-expanded={!placeShut[g.key]}
                    className="w-full flex items-center gap-1.5 px-4 py-2.5 text-left">
                    {placeShut[g.key] ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />}
                    <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">{g.label} · {g.list.length}</span>
                  </button>
                  {!placeShut[g.key] && g.list.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 px-4 border-t border-border/40">
                      <span className="w-11 h-11 rounded-xl bg-[#A7773F1F] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <MapPin className="w-4 h-4 text-[#A7773F]" strokeWidth={1.8} />}
                      </span>
                      <button onClick={() => onPlaceMenu(p)} className="flex-1 min-w-0 text-left">
                        <p className="font-heading text-[16px] text-foreground truncate leading-snug">{p.name || "Untitled place"}</p>
                        <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">
                          {p.visited && Number(p.rating) > 0 && <span className="text-[#A7773F] tracking-[1px] mr-1.5">{"★".repeat(p.rating)}<span className="text-[#D9CBB3]">{"★".repeat(5 - p.rating)}</span></span>}
                          {[p.type, p.address].filter(Boolean).join(" · ")}
                        </p>
                        {p.notes && <p className="font-heading italic text-[12.5px] text-foreground/80 mt-0.5 truncate">{p.notes}</p>}
                      </button>
                      {(p.maps_url || p.address) && (
                        <a
                          href={p.maps_url || mapsUrl(p.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-1.5 text-[12px] font-medium text-[#A7773F] hover:text-[#8A5F2E] transition-colors flex-shrink-0"
                          title="Open in maps"
                        >
                          Directions
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
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
