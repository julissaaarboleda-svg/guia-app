import { useState, useEffect } from "react";
import {
  Pencil, Smile, RefreshCw, Palette, Pin, Archive, Trash2, X, Check,
} from "lucide-react";
import { COLLECTION_ACCENTS } from "./collectionAccents";

const EMOJI_CHOICES = ["📁", "✈️", "🏡", "👗", "💼", "🍳", "📚", "❤️", "✨", "🎯", "🌿", "☕", "🎵", "📷", "💡", "🌊"];

export default function CollectionSheet({ folder, onClose, onUpdate, onDelete }) {
  const [step, setStep] = useState("menu");
  const [name, setName] = useState(folder?.name || "");
  const [emoji, setEmoji] = useState(folder?.emoji || "📁");

  useEffect(() => {
    setName(folder?.name || "");
    setEmoji(folder?.emoji || "📁");
    setStep("menu");
  }, [folder]);

  if (!folder) return null;

  const commit = (patch, msg) => { onUpdate(folder.id, patch); if (msg) {} onClose(); };

  const MENU = [
    { icon: Pencil, label: "Rename", action: () => setStep("rename") },
    { icon: Smile, label: "Change Icon", action: () => setStep("icon") },
    {
      icon: RefreshCw, label: folder.icon_type === "emoji" ? "Use Folder Icon" : "Use Emoji",
      action: () => commit({ icon_type: folder.icon_type === "emoji" ? "folder" : "emoji" }),
    },
    { icon: Palette, label: "Accent Color", action: () => setStep("color") },
    { icon: Pin, label: folder.pinned ? "Unpin Collection" : "Pin Collection", action: () => commit({ pinned: !folder.pinned }) },
    { icon: Archive, label: folder.archived ? "Unarchive" : "Archive", action: () => commit({ archived: !folder.archived }) },
    { icon: Trash2, label: "Delete", danger: true, action: () => { if (confirm("Delete this collection? Notes will be kept but unfiled.")) { onDelete(folder.id); onClose(); } } },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden animate-in">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-8" />
          <p className="font-heading text-base text-foreground">{folder.name}</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-1" />

        {step === "menu" && (
          <div className="px-2 pb-6 pt-2">
            {MENU.map((m) => (
              <button
                key={m.label}
                onClick={m.action}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors hover:bg-secondary ${m.danger ? "text-destructive" : "text-foreground"}`}
              >
                <m.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.6} />
                <span className="font-body text-[15px]">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === "rename" && (
          <div className="px-5 pb-6 pt-2">
            <p className="font-body text-[13px] text-muted-foreground mb-2">Collection name</p>
            <input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && commit({ name: name.trim() })}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-ring transition-colors"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep("menu")} className="flex-1 py-2.5 rounded-xl border border-border text-[14px] text-muted-foreground hover:text-foreground transition-colors">Back</button>
              <button
                onClick={() => name.trim() && commit({ name: name.trim() })}
                className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-[14px] font-medium flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        )}

        {step === "icon" && (
          <div className="px-5 pb-6 pt-2">
            <p className="font-body text-[13px] text-muted-foreground mb-3">Choose an emoji</p>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_CHOICES.map((em) => (
                <button
                  key={em}
                  onClick={() => setEmoji(em)}
                  className={`aspect-square rounded-xl text-xl flex items-center justify-center transition-all ${emoji === em ? "bg-secondary ring-2 ring-foreground" : "hover:bg-secondary"}`}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep("menu")} className="flex-1 py-2.5 rounded-xl border border-border text-[14px] text-muted-foreground hover:text-foreground transition-colors">Back</button>
              <button
                onClick={() => commit({ icon_type: "emoji", emoji })}
                className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-[14px] font-medium flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Set Icon
              </button>
            </div>
          </div>
        )}

        {step === "color" && (
          <div className="px-5 pb-6 pt-2">
            <p className="font-body text-[13px] text-muted-foreground mb-3">Accent color</p>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(COLLECTION_ACCENTS).map(([key, hex]) => (
                <button
                  key={key}
                  onClick={() => commit({ accent_color: key })}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${folder.accent_color === key ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""}`}
                    style={{ backgroundColor: hex }}
                  >
                    {folder.accent_color === key && <Check className="w-4 h-4 text-white" />}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("menu")} className="w-full mt-5 py-2.5 rounded-xl border border-border text-[14px] text-muted-foreground hover:text-foreground transition-colors">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}