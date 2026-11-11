import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, ChevronDown, Check, Move } from "lucide-react";
import AdjustableImage from "@/components/ui/AdjustableImage";
import ImageAdjuster from "@/components/ui/ImageAdjuster";
import HeroRings from "@/components/home/HeroRings";
const MODES = [
  { id: "photo_rings", label: "Photo + Progress" },
  { id: "photo_quote", label: "Photo + Quote" },
  { id: "photo", label: "Photo Only" },
  { id: "quote", label: "Quote Only" },
  { id: "hide", label: "Hide Hero" },
];
export default function EditorialHero({ image, imagePos, onAdjust, quote, mode, setMode, onUpload, rings = [], onCustomizeRings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const fileRef = useRef(null);
  if (mode === "hide") return null;
  const split = mode === "photo_rings" && rings.length > 0;
  const showQuote = mode === "photo_quote" || mode === "quote";
  const showPhoto = mode === "photo_quote" || mode === "photo" || mode === "photo_rings";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`relative w-full rounded-[24px] ${split ? "h-[188px] lg:h-[210px] border border-border/60 bg-card" : "h-[150px] lg:h-[190px]"}`}
    >
      {split && (
        <div className="absolute inset-y-0 right-0 left-[46%] lg:left-[55%]">
          <HeroRings circles={rings} onCustomize={onCustomizeRings} />
        </div>
      )}
      <div className={`absolute inset-y-0 left-0 overflow-hidden bg-charcoal ${split ? "right-[54%] lg:right-[45%] rounded-l-[24px]" : "right-0 rounded-[24px]"}`}>
        {showPhoto && image && (
          <AdjustableImage src={image} pos={imagePos} className="absolute inset-0" />
        )}
        {mode === "quote" && (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/30 to-charcoal" />
        )}
        {!split && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />}
        {showQuote && quote && (
          <div className="absolute bottom-3.5 left-5 right-16 max-w-[85%] z-10">
            <p className="font-heading italic text-[#F5F1EB] text-[15px] sm:text-xl leading-snug drop-shadow-md line-clamp-3">
              {quote.text}
            </p>
            <p className="font-body text-[#F5F1EB]/70 text-[11px] mt-1 tracking-wide">— {quote.author}</p>
          </div>
        )}
      </div>
      <div className={`absolute z-20 ${split ? "bottom-2.5 left-2.5" : "bottom-4 right-5"}`}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1 bg-white/15 backdrop-blur-md text-white border border-white/20 rounded-full px-2.5 py-1 text-[11px] font-body font-medium hover:bg-white/25 transition-colors"
        >
          {split ? "Photo" : "Customize"}
          <ChevronDown className={`w-2.5 h-2.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className={`absolute mt-2 w-44 ${split ? "left-0" : "right-0"} bg-card border border-border rounded-xl shadow-lg py-1 z-30`}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-body text-foreground hover:bg-secondary transition-colors"
                >
                  {m.label}
                  {mode === m.id && <Check className="w-3.5 h-3.5 text-olive" />}
                </button>
              ))}
              <div className="border-t border-border my-1" />
              {showPhoto && image && (
                <button
                  onClick={() => { setAdjusting(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-body text-foreground hover:bg-secondary transition-colors"
                >
                  <Move className="w-3.5 h-3.5" /> Adjust photo
                </button>
              )}
              <button
                onClick={() => { fileRef.current?.click(); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-body text-foreground hover:bg-secondary transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload photo
              </button>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
      </div>
      <ImageAdjuster open={adjusting} src={image} pos={imagePos} aspect={split ? 1.1 : 3 / 1} title="Adjust banner photo" onClose={() => setAdjusting(false)} onSave={(p) => onAdjust?.(p)} />
    </motion.div>
  );
}
