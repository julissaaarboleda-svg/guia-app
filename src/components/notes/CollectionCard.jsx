import { useRef } from "react";
import { Folder as FolderIcon, ChevronRight } from "lucide-react";
import { posStyle } from "@/lib/imagePos";

const isUrl = (v) => typeof v === "string" && /^https?:\/\//.test(v);
import { accentHex } from "./collectionAccents";

export const COLLECTION_CATEGORIES = ["Personal", "Home", "Work", "Travel", "Other"];

export default function CollectionCard({ folder, count, onOpen, onLongPress, compact = false }) {
  const pressTimer = useRef(null);
  const color = accentHex(folder.accent_color);

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(10);
      onLongPress(folder);
    }, 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <button
      onClick={() => onOpen(folder)}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(folder); }}
      style={compact ? { backgroundColor: color } : undefined}
      className={compact
        ? "group relative flex-shrink-0 max-w-[220px] flex items-center gap-2.5 text-left rounded-2xl pl-2.5 pr-4 py-2 transition-opacity hover:opacity-90"
        : "group relative w-full min-h-[76px] flex items-center gap-3 text-left bg-card border border-border/60 rounded-2xl px-3 py-3 transition-all hover:-translate-y-0.5 active:translate-y-0"}
    >
      <span
        className={`${compact ? "w-9 h-9" : "w-11 h-11"} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}
        style={{ backgroundColor: compact ? "rgba(255,255,255,0.18)" : `${color}1F` }}
      >
        {folder.icon_type === "image" && isUrl(folder.emoji) ? (
          <img src={folder.emoji} alt="" className="w-full h-full object-cover" style={posStyle(folder.photo_pos)} />
        ) : folder.icon_type === "emoji" && folder.emoji ? (
          <span className="text-[22px] leading-none">{folder.emoji}</span>
        ) : (
          <FolderIcon className="w-[22px] h-[22px]" style={{ color: compact ? "#fff" : color }} strokeWidth={1.5} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <p className={`font-heading ${compact ? "text-white" : "text-foreground"} leading-tight break-words ${compact ? "text-[14px] truncate" : "text-[15px] line-clamp-2"}`}>{folder.name}</p>
        <p className={`font-body text-[12px] mt-0.5 truncate ${compact ? "text-white/80" : "text-muted-foreground"}`}>
          {count} {count === 1 ? "note" : "notes"}
        </p>
      </span>
      {!compact && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />}
    </button>
  );
}
