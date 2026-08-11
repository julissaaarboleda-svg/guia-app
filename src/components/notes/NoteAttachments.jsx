import { FileText, X } from "lucide-react";

export default function NoteAttachments({ attachments, onRemove, onPreview }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 py-2">
      {attachments.map((att, idx) => (
        <div key={idx} className="relative group">
          {att.type === "image" ? (
            <img
              src={att.url}
              alt={att.name}
              onClick={() => onPreview?.(att)}
              className="w-full aspect-square object-cover rounded-lg border border-border cursor-pointer"
            />
          ) : (
            <button
              onClick={() => window.open(att.url, "_blank", "noopener,noreferrer")}
              className="w-full aspect-square flex flex-col items-center justify-center bg-secondary rounded-lg border border-border p-3"
            >
              <FileText className="w-6 h-6 text-muted-foreground mb-1.5" />
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {att.name}
              </span>
            </button>
          )}
          <button
            onClick={() => onRemove(idx)}
            className="absolute top-1.5 right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}