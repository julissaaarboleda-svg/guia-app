import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, Pencil, Plus, MoreHorizontal } from "lucide-react";
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

export default function NotesLanding({
  notes, folders, loading,
  onQuickCapture, onOpenCollection, onOpenNote,
  onNewCollection, onLongPressCollection, onNoteMenu,
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  const visibleFolders = useMemo(
    () => folders.filter((f) => !f.archived).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    [folders]
  );

  const countFor = (folderId) => notes.filter((n) => n.folder_id === folderId).length;
  const folderName = (id) => folders.find((f) => f.id === id)?.name;

  const recent = useMemo(() => {
    let list = [...notes];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((n) => n.title?.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    }
    list.sort((a, b) => new Date(sortNewest ? b.updated_date : a.updated_date) - new Date(sortNewest ? a.updated_date : b.updated_date));
    return list.slice(0, 6);
  }, [notes, query, sortNewest]);

  return (
    <div className="px-6 md:px-10 lg:px-14 pb-8 max-w-[900px] mx-auto w-full space-y-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="min-w-0 flex-1 pr-3">
          <h1 className="font-heading text-[2rem] leading-[2.1rem] font-semibold text-[#232323]">Notes</h1>
          <p className="font-body text-[13px] text-[#7C7A76] mt-0.5 truncate">
            Capture ideas and inspiration.
          </p>
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

      {showSearch && (
        <div className="-mt-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-card border border-border rounded-xl px-4 py-2 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
      )}

      {/* Quick Capture */}
      <button
        onClick={onQuickCapture}
        className="w-full h-[46px] flex items-center gap-3 bg-card border border-border/60 rounded-2xl pl-4 pr-5 text-left transition-all hover:shadow-[0_4px_16px_-12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 active:translate-y-0"
      >
        <span className="w-6 h-6 rounded-full bg-[#B49399] flex items-center justify-center flex-shrink-0">
          <Pencil className="w-3 h-3 text-white" strokeWidth={1.8} />
        </span>
        <span className="font-body text-[13px] text-[#6E6B67]">Write a note…</span>
      </button>

      {/* Collections — horizontal scroll */}
      <section className="space-y-2.5">
        <div className="flex items-end justify-between">
          <h2 className="font-heading text-lg text-[#232323] font-semibold leading-tight">Collections</h2>
          <button className="font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors">View All</button>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[80px] rounded-2xl bg-card border border-border/50 animate-pulse" />
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
              className="h-[80px] flex flex-col items-center justify-center bg-transparent border border-dashed border-border/60 rounded-2xl transition-all hover:border-[#B49399]/60 hover:bg-card/40"
            >
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center mb-1">
                <Plus className="w-3 h-3 text-[#B49399]" strokeWidth={1.6} />
              </div>
              <p className="font-body text-[11px] font-medium text-muted-foreground">New</p>
            </button>
          </div>
        )}
      </section>

      {/* Recent Notes */}
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
    </div>
  );
}