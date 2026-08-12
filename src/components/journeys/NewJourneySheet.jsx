import { useState } from "react";
import { X, Plus, MapPin } from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import { searchCountries, searchCities } from "@/lib/cityData";

export default function NewJourneySheet({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ title: "", country: "", cities: "", start_date: "", end_date: "", budget_target: "" });
  const [countryInput, setCountryInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [countrySugs, setCountrySugs] = useState([]);
  const [citySugs, setCitySugs] = useState([]);

  if (!open) return null;

  const selectedCountries = form.country ? form.country.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const reset = () => {
    setForm({ title: "", country: "", cities: "", start_date: "", end_date: "", budget_target: "" });
    setCountryInput(""); setCityInput(""); setCountrySugs([]); setCitySugs([]);
  };

  const submit = () => {
    if (!form.title.trim()) return;
    // Capture any text still sitting in the inputs that was typed but never
    // explicitly confirmed with Enter/a suggestion click — otherwise it's
    // silently lost on submit, which is the actual "cities won't save" bug.
    const existingCities = form.cities ? form.cities.split(",").map((c) => c.trim()).filter(Boolean) : [];
    const finalCities = cityInput.trim() && !existingCities.includes(cityInput.trim())
      ? [...existingCities, cityInput.trim()]
      : existingCities;
    const existingCountries = form.country ? form.country.split(",").map((c) => c.trim()).filter(Boolean) : [];
    const finalCountries = countryInput.trim() && !existingCountries.includes(countryInput.trim())
      ? [...existingCountries, countryInput.trim()]
      : existingCountries;

    onCreate({
      title: form.title.trim(),
      country: finalCountries.join(", "),
      cities: finalCities,
      start_date: form.start_date || "",
      end_date: form.end_date || "",
      budget_target: form.budget_target ? Number(form.budget_target) : null,
    });
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl shadow-2xl border border-border max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="font-heading text-lg text-foreground">New Journey</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="h-1 w-10 rounded-full bg-border mx-auto mb-1" />

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <label className="font-body text-[11px] text-muted-foreground mb-1.5 block">Journey name</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Amanpuri Winter"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-ring transition-colors font-heading"
            />
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground mb-1.5 block">Country (add more than one for multi-destination trips)</label>
            <input
              value={countryInput}
              onChange={(e) => { setCountryInput(e.target.value); if (e.target.value.length >= 1) searchCountries(e.target.value, setCountrySugs); else setCountrySugs([]); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const typed = countryInput.trim();
                  const existing = form.country ? form.country.split(",").map((c) => c.trim()).filter(Boolean) : [];
                  if (typed && !existing.includes(typed)) setForm((f) => ({ ...f, country: [...existing, typed].join(", ") }));
                  setCountryInput("");
                  setCountrySugs([]);
                }
              }}
              onBlur={() => setTimeout(() => setCountrySugs([]), 200)}
              placeholder="e.g. Brazil — search, or type and press Enter"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-ring transition-colors"
            />
            {countrySugs.length > 0 && (
              <div className="relative z-20">
                <div className="absolute w-full bg-card border border-border rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                  {countrySugs.map((s) => (
                    <button key={s} onMouseDown={() => {
                      const existing = form.country ? form.country.split(",").map((c) => c.trim()).filter(Boolean) : [];
                      if (!existing.includes(s)) setForm((f) => ({ ...f, country: [...existing, s].join(", ") }));
                      setCountryInput(""); setCountrySugs([]);
                    }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary border-b border-border last:border-0">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {form.country && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.country.split(",").map((c, i) => c.trim()).filter(Boolean).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 bg-secondary text-foreground px-2.5 py-1 rounded-full text-xs">{c}
                    <button onClick={() => setForm((f) => ({ ...f, country: f.country.split(",").map((x) => x.trim()).filter(Boolean).filter((x) => x !== c).join(", ") }))} className="text-muted-foreground hover:text-foreground">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="font-body text-[11px] text-muted-foreground mb-1.5 block">Cities</label>
            <input
              value={cityInput}
              disabled={selectedCountries.length === 0}
              onChange={(e) => { const q = e.target.value; setCityInput(q); if (selectedCountries.length > 0 && q.length >= 1) searchCities(q, selectedCountries, setCitySugs); else setCitySugs([]); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const typed = cityInput.trim();
                  const ex = form.cities ? form.cities.split(",").map((c) => c.trim()).filter(Boolean) : [];
                  if (typed && !ex.includes(typed)) setForm((f) => ({ ...f, cities: [...ex, typed].join(", ") }));
                  setCityInput("");
                  setCitySugs([]);
                }
              }}
              onBlur={() => setTimeout(() => setCitySugs([]), 200)}
              placeholder={selectedCountries.length === 0 ? "Add a destination first" : "Search cities, or type any city and press Enter"}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-ring transition-colors disabled:opacity-50"
            />
            {citySugs.length > 0 && (
              <div className="relative z-20">
                <div className="absolute w-full bg-card border border-border rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                  {citySugs.map((s) => (
                    <button key={s} onMouseDown={() => { const ex = form.cities ? form.cities.split(",").map((c) => c.trim()).filter(Boolean) : []; if (!ex.includes(s)) setForm((f) => ({ ...f, cities: [...ex, s].join(", ") })); setCityInput(""); setCitySugs([]); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary border-b border-border last:border-0">{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DateRangePicker
            label="Travel dates"
            startDate={form.start_date}
            endDate={form.end_date}
            onChange={({ startDate, endDate }) => setForm((f) => ({ ...f, start_date: startDate, end_date: endDate }))}
            placeholder="Select travel dates"
          />

          <div>
            <label className="font-body text-[11px] text-muted-foreground mb-1.5 block">Budget target ($)</label>
            <input type="number" value={form.budget_target} onChange={(e) => setForm((f) => ({ ...f, budget_target: e.target.value }))} placeholder="e.g. 5000" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-ring transition-colors" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button onClick={submit} disabled={!form.title.trim()} className="w-full flex items-center justify-center gap-1.5 bg-foreground text-background py-3 rounded-xl text-[15px] font-medium hover:opacity-90 transition-colors disabled:opacity-40">
            <Plus className="w-4 h-4" /> Create Journey
          </button>
        </div>
      </div>
    </div>
  );
}