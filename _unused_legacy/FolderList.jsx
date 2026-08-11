import { FolderPlus, Folder as FolderIcon, ChevronRight, X, Inbox } from "lucide-react";

export default function FolderList({ folders, notes, activeFolder, onSelect, onAdd, onDelete }) {
  const countFor = (folderId) => notes.filter(n => n.folder_id === folderId).length;
  const unfiledCount = notes.filter(n => !n.folder_id).length;

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Folders</span>
        <button onClick={onAdd} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="New folder">
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>
      <div className="pb-1.5">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-3 px-4 py-2 transition-colors hover:bg-secondary group ${activeFolder === null ? "bg-secondary" : ""}`}
        >
          <Inbox className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={`text-sm flex-1 text-left truncate ${activeFolder === null ? "font-medium text-foreground" : "text-muted-foreground"}`}>All Notes</span>
          <span className="text-xs text-muted-foreground">{notes.length}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
        </button>
        {folders.map(f => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`w-full flex items-center gap-3 px-4 py-2 transition-colors hover:bg-secondary group ${activeFolder === f.id ? "bg-secondary" : ""}`}
          >
            <FolderIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className={`text-sm flex-1 text-left truncate ${activeFolder === f.id ? "font-medium text-foreground" : "text-muted-foreground"}`}>{f.name}</span>
            <span className="text-xs text-muted-foreground">{countFor(f.id)}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}