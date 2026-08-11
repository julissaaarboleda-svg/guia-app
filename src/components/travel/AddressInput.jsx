import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, X } from "lucide-react";

let debounceTimer = null;

async function searchAddresses(query) {
  if (!query || query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
  try {
    const resp = await fetch(url, { headers: { "Accept-Language": "en-US,en" } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.map((r) => ({ label: r.display_name }));
  } catch {
    return [];
  }
}

export default function AddressInput({ value, onChange, placeholder = "Search address…" }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  useEffect(() => { setQuery(value || ""); }, [value]);

  const runSearch = (q) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const results = await searchAddresses(q);
      setSuggestions(results);
      setLoading(false);
      setOpen(true);
    }, 350);
  };

  const handleType = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setHighlight(-1);
    if (v.trim().length >= 3) { setLoading(true); runSearch(v); }
    else { setSuggestions([]); setOpen(false); setLoading(false); }
  };

  const pick = (s) => {
    setQuery(s.label);
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);
    setHighlight(-1);
  };

  const onKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && highlight >= 0) { e.preventDefault(); pick(suggestions[highlight]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center bg-muted border border-border rounded-lg" style={{ height: "40px" }}>
        <MapPin className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={query}
          onChange={handleType}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="w-full bg-transparent border-none pl-9 pr-8 text-sm outline-none focus:border-ring"
          style={{ height: "40px", lineHeight: "40px" }}
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => { setQuery(""); onChange(""); setSuggestions([]); setOpen(false); }}
            className="absolute right-2 text-muted-foreground hover:text-foreground"
            aria-label="Clear address"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 border-b border-border last:border-0 flex items-start gap-2 ${highlight === i ? "bg-secondary" : ""}`}
            >
              <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground/60 flex-shrink-0" />
              <span className="font-body text-[12px] text-foreground leading-snug">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}