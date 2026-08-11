import { FolderPlus, X } from "lucide-react";

export default function FolderBar({ folders, activeFolder, onSelect, onAdd, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          activeFolder === null
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        All Notes
      </button>
      {folders.map(f => (
        <div key={f.id} className="flex-shrink-0 flex items-center">
          {activeFolder === f.id ? (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-foreground text-background">
              <span>{f.name}</span>
              <button
                onClick={() => onDelete(f.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSelect(f.id)}
              className="px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {f.name}
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border"
      >
        <FolderPlus className="w-3.5 h-3.5" /> New Folder
      </button>
    </div>
  );
}