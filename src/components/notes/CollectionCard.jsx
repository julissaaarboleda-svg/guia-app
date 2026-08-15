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
      className="group relative w-full h-[96px] flex flex-col items-center justify-center text-center bg-card border border-border/50 rounded-2xl p-2 transition-all hover:shadow-[0_4px_16px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0"
    >
      {folder.pinned && (
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span
        className="w-11 h-11 rounded-[11px] flex items-center justify-center mb-2 flex-shrink-0"
        style={{ backgroundColor: `${color}1F` }}
      >
        {useEmoji ? (
          <span className="text-[22px] leading-none">{folder.emoji}</span>
        ) : (
          <FolderIcon className="w-[23px] h-[23px]" style={{ color }} strokeWidth={1.6} />
        )}
      </span>
      <p className="font-body text-[13px] font-medium text-foreground leading-tight truncate max-w-full px-1">{folder.name}</p>
      <p className="font-body text-[11px] text-[#8E8A84] mt-0.5 truncate max-w-full">
        {count} {count === 1 ? "note" : "notes"}
      </p>
    </button>
  );
}