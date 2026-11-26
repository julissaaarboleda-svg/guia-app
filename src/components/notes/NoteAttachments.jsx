import { FileText, X, Link2, Play } from "lucide-react";

const KIND_LABEL = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

export default function NoteAttachments({ attachments, onRemove, onPreview }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 py-2">
      {attachments.map((att, idx) => (
        <div key={idx} className="relative group">
          {att.type === "link" ? (
            <a href={att.url} target="_blank" rel="noopener noreferrer" className="block w-full rounded-lg border border-border bg-card overflow-hidden">
              <div className="relative aspect-[4/5] bg-[#EFE8DC] flex items-center justify-center">
                {att.thumb_url ? <img src={att.thumb_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <Link2 className="w-7 h-7 text-[#A7773F]" />}
                {att.is_video && (
                  <span className="relative w-10 h-10 rounded-full bg-white/85 flex items-center justify-center shadow-sm"><Play className="w-5 h-5 text-[#2E2A27] ml-0.5" fill="currentColor" /></span>
                )}
                <span className="absolute top-1.5 left-1.5 text-[10px] text-white bg-black/45 px-1.5 py-0.5 rounded-full">{KIND_LABEL[att.kind] || att.site || "Link"}</span>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[11.5px] leading-snug text-foreground line-clamp-2">{att.title || att.site || att.name || att.url}</p>
                {att.author && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{att.author}</p>}
              </div>
            </a>
          ) : att.type === "image" ? (
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
          {onRemove && (
            <button
              onClick={() => onRemove(idx)}
              className="absolute top-1.5 right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}