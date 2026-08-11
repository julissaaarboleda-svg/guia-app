import { useRef } from "react";
import { Folder as FolderIcon } from "lucide-react";
import { accentHex } from "./collectionAccents";

export default function CollectionCard({ folder, count, onOpen, onLongPress }) {
  const pressTimer = useRef(null);
  const color = accentHex(folder.accent_color);
  const useEmoji = folder.icon_type === "emoji" && folder.emoji;

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
      className="group relative w-full h-[80px] flex flex-col items-center justify-center text-center bg-card border border-border/50 rounded-2xl p-2 transition-all hover:shadow-[0_4px_16px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0"
    >
      {folder.pinned && (
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {useEmoji ? (
        <span className="text-[15px] leading-none mb-1.5">{folder.emoji}</span>
      ) : (
        <FolderIcon className="w-[15px] h-[15px] mb-1.5" style={{ color }} strokeWidth={1.6} />
      )}
      <p className="font-body text-[13px] font-medium text-foreground leading-tight truncate max-w-full px-1">{folder.name}</p>
      <p className="font-body text-[10px] text-[#8E8A84] mt-0.5 truncate max-w-full">
        {count} {count === 1 ? "note" : "notes"}
      </p>
    </button>
  );
}