import { useState, useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

// Real worldwide city autocomplete, backed by geo-search.js's cities-worldwide
// mode — type "Mia" and get Miami/Miamisburg/Miajadas with their country
// (and state, when needed to tell same-named cities apart), same as a real
// flight-booking city field. Not limited to the trip's own countries.
export default function CitySearchInput({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleInput = (v) => {
    setQuery(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/.netlify/functions/geo-search?type=cities-worldwide&q=${encodeURIComponent(v.trim())}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const pick = (label) => {
    setQuery(label);
    onChange(label);
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative flex items-center bg-muted border border-border rounded-lg h-10">
        <MapPin className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder || "Search any city…"}
          className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring h-10"
        />
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : (
            results.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => pick(label)}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors truncate"
              >
                {label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
