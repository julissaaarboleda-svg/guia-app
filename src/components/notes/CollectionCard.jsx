import { useRef } from "react";
import { Folder as FolderIcon, ChevronRight } from "lucide-react";

const isUrl = (v) => typeof v === "string" && /^https?:\/\//.test(v);
import { accentHex } from "./collectionAccents";

export const COLLECTION_CATEGORIES = ["Personal", "Home", "Work", "Travel", "Other"];

export default function CollectionCard({ folder, count, onOpen, onLongPress }) {
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
      className="group relative w-full min-h-[76px] flex items-center gap-3 text-left bg-card border border-border/60 rounded-2xl px-3 py-3 transition-all hover:-translate-y-0.5 active:translate-y-0"
    >
      <span
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}1F` }}
      >
        {folder.icon_type === "image" && isUrl(folder.emoji) ? (
          <img src={folder.emoji} alt="" className="w-11 h-11 rounded-xl object-cover" />
        ) : folder.icon_type === "emoji" && folder.emoji ? (
          <span className="text-[22px] leading-none">{folder.emoji}</span>
        ) : (
          <FolderIcon className="w-[22px] h-[22px]" style={{ color }} strokeWidth={1.5} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <p className="font-heading text-[15px] text-foreground leading-tight line-clamp-2 break-words">{folder.name}</p>
        <p className="font-body text-[12px] text-muted-foreground mt-0.5 truncate">
          {count} {count === 1 ? "note" : "notes"}
        </p>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
    </button>
  );
}
