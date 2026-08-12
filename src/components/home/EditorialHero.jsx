import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, ChevronDown, Check } from "lucide-react";

const MODES = [
  { id: "photo_quote", label: "Photo + Quote" },
  { id: "photo", label: "Photo Only" },
  { id: "quote", label: "Quote Only" },
  { id: "hide", label: "Hide Hero" },
];

export default function EditorialHero({ image, quote, mode, setMode, onUpload }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef(null);

  if (mode === "hide") return null;
  const showQuote = mode === "photo_quote" || mode === "quote";
  const showPhoto = mode === "photo_quote" || mode === "photo";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full h-[26vh] min-h-[210px] max-h-[290px] rounded-[24px]"
    >
      <div className="absolute inset-0 rounded-[24px] overflow-hidden bg-charcoal">
        {showPhoto && image && (
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {mode === "quote" && (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/30 to-charcoal" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30" />
        {showQuote && quote && (
          <div className="absolute bottom-5 left-6 right-6 max-w-[85%] z-10">
            <p className="font-heading italic text-[#F5F1EB] text-lg sm:text-xl leading-relaxed drop-shadow-md">
              {quote.text}
            </p>
            <p className="font-body text-[#F5F1EB]/70 text-xs mt-2 tracking-wide">— {quote.author}</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-5 z-20">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1 bg-white/15 backdrop-blur-md text-white border border-white/20 rounded-full px-2.5 py-1 text-[11px] font-body font-medium hover:bg-white/25 transition-colors"
        >
          Customize
          <ChevronDown className={`w-2.5 h-2.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg py-1 z-30">
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
    </motion.div>
  );
}