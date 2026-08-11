import { useState, useEffect } from "react";
import { Folder as FolderIcon, Smile, Palette, Check, X } from "lucide-react";
import { COLLECTION_ACCENTS, accentHex } from "./collectionAccents";

const EMOJI_CHOICES = ["📁", "✈️", "🏡", "👗", "💼", "🍳", "📚", "❤️", "✨", "🎯", "🌿", "☕", "🎵", "📷", "💡", "🌊"];

export default function NewCollectionSheet({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [iconType, setIconType] = useState("folder");
  const [emoji, setEmoji] = useState("📁");
  const [accent, setAccent] = useState("sage");
  const [section, setSection] = useState("name");

  useEffect(() => {
    if (open) { setName(""); setIconType("folder"); setEmoji("📁"); setAccent("sage"); setSection("name"); }
  }, [open]);

  if (!open) return null;
  const accentColor = accentHex(accent);
  const canCreate = name.trim().length > 0;

  const submit = () => {
    if (!canCreate) return;
    onCreate({
      name: name.trim(),
      icon_type: iconType,
      emoji: iconType === "emoji" ? emoji : undefined,
      accent_color: accent,
    });
  };

  const previewIcon = iconType === "emoji" ? emoji : <FolderIcon className="w-4 h-4" style={{ color: accentColor }} strokeWidth={1.6} />;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
          <p className="font-heading text-base text-foreground">New Collection</p>
          <button
            onClick={submit}
            disabled={!canCreate}
            className="font-body text-[14px] font-medium transition-colors disabled:text-muted-foreground/40 text-foreground hover:opacity-80"
          >
            Create
          </button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-1" />

        {/* Live preview */}
        <div className="flex flex-col items-center pt-3 pb-2">
          {iconType === "emoji" ? (
            <span className="text-[26px] leading-none mb-2">{emoji}</span>
          ) : (
            <FolderIcon className="w-6 h-6 mb-2" style={{ color: accentColor }} strokeWidth={1.6} />
          )}
          <p className="font-body text-[14px] font-medium text-foreground">{name.trim() || "Collection name"}</p>
        </div>

        {/* Name section */}
        <button onClick={() => setSection("name")} className="w-full flex items-center gap-3 px-5 py-3 text-left border-t border-border/60">
          <span className="font-body text-[13px] text-muted-foreground w-16 shrink-0">Name</span>
          {section === "name" ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSection("icon")}
              placeholder="e.g. Travel, Recipes…"
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-[14px] text-foreground outline-none focus:border-ring transition-colors"
            />
          ) : (
            <span className="flex-1 font-body text-[14px] text-foreground truncate">{name.trim() || <span className="text-muted-foreground/50">Tap to name</span>}</span>
          )}
        </button>

        {/* Icon section */}
        <button onClick={() => setSection(section === "icon" ? "name" : "icon")} className="w-full flex items-center gap-3 px-5 py-3 text-left border-t border-border/60">
          <Smile className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.6} />
          <span className="font-body text-[13px] text-muted-foreground w-14 shrink-0">Icon</span>
          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIconType("folder"); }}
              className={`px-3 py-1 rounded-full text-[12px] font-body transition-colors ${iconType === "folder" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
            >
              Folder
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIconType("emoji"); setSection("icon"); }}
              className={`px-3 py-1 rounded-full text-[12px] font-body transition-colors ${iconType === "emoji" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
            >
              Emoji
            </button>
            {iconType === "emoji" && <span className="text-lg leading-none">{emoji}</span>}
          </div>
        </button>

        {section === "icon" && iconType === "emoji" && (
          <div className="px-5 pb-3 border-t border-border/60">
            <div className="grid grid-cols-8 gap-1.5 pt-3">
              {EMOJI_CHOICES.map((em) => (
                <button
                  key={em}
                  onClick={() => setEmoji(em)}
                  className={`aspect-square rounded-lg text-lg flex items-center justify-center transition-all ${emoji === em ? "bg-secondary ring-2 ring-foreground" : "hover:bg-secondary"}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Accent section */}
        <div className="px-5 py-3 border-t border-border/60">
          <div className="flex items-center gap-3 mb-2.5">
            <Palette className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.6} />
            <span className="font-body text-[13px] text-muted-foreground w-14 shrink-0">Color</span>
          </div>
          <div className="flex flex-wrap gap-2.5 pl-7">
            {Object.entries(COLLECTION_ACCENTS).map(([key, hex]) => (
              <button
                key={key}
                onClick={() => setAccent(key)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${accent === key ? "ring-2 ring-offset-2 ring-offset-card ring-foreground" : ""}`}
                style={{ backgroundColor: hex }}
              >
                {accent === key && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-6 pt-1">
          <button
            onClick={submit}
            disabled={!canCreate}
            className="w-full py-2.5 rounded-xl bg-foreground text-background text-[14px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-40 transition-opacity"
          >
            <Check className="w-4 h-4" /> Create Collection
          </button>
        </div>
      </div>
    </div>
  );
}