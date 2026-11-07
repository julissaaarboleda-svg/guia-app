import { useState, useEffect } from "react";
import { searchCities, searchCountries } from "@/lib/cityData";
import { parseISO, eachDayOfInterval, format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { ArrowLeft, Edit2, Check, X, Trash2, MapPin, Calendar, Download, Plus, Clock, Upload, ImageIcon, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SavedTab from "./saved/SavedTab";
import PackingTab from "./PackingTab";
import ItineraryTab from "./ItineraryTab";
import BudgetTab from "./BudgetTab";
import MemoriesTab from "./MemoriesTab";
import BottomNav from "@/components/BottomNav";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import "react-quill/dist/quill.snow.css";
import DateInput from "@/components/DateInput";

const TABS = [
  { id: "Itinerary", label: "Itinerary" },
  { id: "About", label: "Explore" },
  { id: "Packing", label: "Packing" },
  { id: "Budget", label: "Budget" },
  { id: "Recap", label: "Memories" },
];

const statusOptions = ["planning", "confirmed", "completed"];
const statusColors = {
  planning:  "bg-amber-50 text-amber-700 border-amber-100",
  confirmed: "bg-green-50 text-green-700 border-green-100",
  completed: "bg-secondary text-muted-foreground border-border",
};

export default function TripDetail({ trip, onBack, onUpdate, initialTab, initialEditOpen, initialDate }) {
  const [tab, setTab] = useState(initialTab && TABS.some(t => t.id === initialTab) ? initialTab : "Itinerary");
  const [editing, setEditing] = useState(!!initialEditOpen);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [countrySuggestions, setCountrySuggestions] = useState([]);
  const [countryInput, setCountryInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [form, setForm] = useState({
    title: trip.title,
    description: trip.description || "",
    country: trip.country || "",
    cities: (trip.cities || []).join(", "),
    flag_emoji: trip.flag_emoji || "",
    start_date: trip.start_date || "",
    end_date: trip.end_date || "",
    status: trip.status || "planning",
    notes: typeof trip.notes === 'string' ? trip.notes : (trip.notes?.content || ""),
    budget_target: trip.budget_target || "",
    hero_image_url: trip.hero_image_url || "",
  });
  const [uploading, setUploading] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(trip.hero_image_url || "");
  const [prefs, setPrefs] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        const p = await ent.UserPreferences.filter({ user_email: u.email });
        if (p.length > 0) setPrefs(p[0]);
      } catch {}
    };
    load();
  }, []);

  const save = async () => {
    const existingCountries = form.country ? form.country.split(",").map(c => c.trim()).filter(Boolean) : [];
    const finalCountries = countryInput.trim() && !existingCountries.includes(countryInput.trim())
      ? [...existingCountries, countryInput.trim()] : existingCountries;
    const existingCitiesArr = form.cities ? form.cities.split(",").map(c => c.trim()).filter(Boolean) : [];
    const finalCities = cityInput.trim() && !existingCitiesArr.includes(cityInput.trim())
      ? [...existingCitiesArr, cityInput.trim()] : existingCitiesArr;

    const updateData = {
      ...form,
      description: form.description || "",
      country: finalCountries.join(", "),
      cities: finalCities,
      budget_target: form.budget_target ? Number(form.budget_target) : null,
      hero_image_url: form.hero_image_url || "",
      notes: typeof form.notes === 'string'
        ? { format: "rich_text", content: form.notes, list_items: [] }
        : (form.notes || { format: "rich_text", content: "", list_items: [] }),
    };

    const datesChanged = form.start_date !== trip.start_date || form.end_date !== trip.end_date;
    if (datesChanged && form.start_date && form.end_date) {
      const start = parseISO(form.start_date);
      const end = parseISO(form.end_date);
      if (end >= start) {
        const days = eachDayOfInterval({ start, end });
        const existing = trip.itinerary || [];
        const newItinerary = days.map((d, i) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const alreadyExists = existing.find(e => e.date === dateStr);
          return alreadyExists ? { ...alreadyExists, day: i + 1 } : { day: i + 1, date: dateStr, title: "", description: "", activities: [] };
        });
        updateData.itinerary = newItinerary;
      }
    }

    const updated = await ent.Trip.update(trip.id, updateData);
    onUpdate(updated);
    setEditing(false);
  };

  const deleteTrip = async () => {
    if (!confirm("Delete this trip?")) return;
    setDeletingTrip(true);
    try {
      await ent.Trip.delete(trip.id);
      onBack();
    } catch (err) {
      console.error("Delete trip failed:", err);
      alert("Couldn't delete this trip — please try again.");
      setDeletingTrip(false);
    }
  };

  const exportPdf = async () => {
    try {
      const response = await base44.functions.invoke("exportTripPdf", { tripId: trip.id });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${trip.title.replace(/[^a-z0-9]/gi, "_")}_itinerary.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    }
  };

  const totalSpent = (trip.expense_items || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const budgetPct = trip.budget_target ? Math.min(100, Math.round((totalSpent / trip.budget_target) * 100)) : 0;
  const budgetColor = budgetPct >= 100 ? '#dc2626' : budgetPct >= 80 ? '#d97706' : '#2D6A4F';

  const daysUntil = trip.start_date
    ? Math.ceil((parseISO(trip.start_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const tripDays = (trip.start_date && trip.end_date)
    ? Math.ceil((parseISO(trip.end_date) - parseISO(trip.start_date)) / (1000 * 60 * 60 * 24)) + 1
    : null;

  const orderedCities = trip.cities || [];

  const onMemoriesTab = tab === "Recap";

  return (
    <div className="min-h-screen bg-background">
      {deletingTrip && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
          <div className="w-7 h-7 border-2 border-border border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Deleting trip...</p>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 md:px-8 pb-28 md:pb-10">
        {/* Unified journey header */}
        <div>
          {/* Back + actions — always visible, regardless of tab */}
          <div className="flex items-center justify-between" style={{ paddingTop: '8px' }}>
            <button onClick={onBack} className="flex items-center gap-1.5 p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
              {onMemoriesTab && <span className="font-body text-sm">Back</span>}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" aria-label="Trip actions">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-lg">
                <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2 cursor-pointer">
                  <Edit2 className="w-4 h-4" /> Edit trip
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf} className="gap-2 cursor-pointer">
                  <Download className="w-4 h-4" /> Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={deleteTrip} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4" /> Delete trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Cover photo + title + status + route + metadata pills — hidden on
              the Memories tab, since MemoriesCover already shows the photo,
              title, and trip stats. Showing both was redundant. */}
          {!onMemoriesTab && (
            <>
              <button
                onClick={() => { setPhotoUrl(trip.hero_image_url || ""); setShowPhotoModal(true); }}
                className="relative block w-full h-[210px] rounded-2xl overflow-hidden mt-2 text-left"
                aria-label="Change cover photo"
              >
                {trip.hero_image_url ? (
                  <img src={trip.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/40" strokeWidth={1.4} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
                <div className="absolute left-4 right-4 bottom-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    {trip.start_date && (
                      <span className="inline-block font-body text-[9px] px-2.5 py-1 rounded-full" style={{ background: "#A7773F", color: "#F7F3EC" }}>
                        {format(parseISO(trip.start_date), "MMM d")}{trip.end_date ? ` – ${format(parseISO(trip.end_date), "d")}` : ""}
                      </span>
                    )}
                    <span className="inline-block font-body text-[9px] px-2.5 py-1 rounded-full bg-white/20 text-white capitalize backdrop-blur-sm">
                      {trip.status || "planning"}
                    </span>
                  </div>
                  <p className="font-heading text-xl text-white font-semibold leading-tight truncate">
                    {trip.flag_emoji && <span className="mr-1">{trip.flag_emoji}</span>}
                    {trip.title}
                  </p>
                  {(orderedCities.length > 0 || trip.country) && (
                    <p className="font-body text-[11px] text-white/75 mt-1 truncate">
                      {(orderedCities.length > 0 ? orderedCities : [trip.country]).filter(Boolean).join(" → ")}
                    </p>
                  )}
                </div>
              </button>

              {(daysUntil > 0 || tripDays || trip.cities?.length > 0) && (
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {daysUntil > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                      {daysUntil} days away
                    </span>
                  )}
                  {tripDays && (
                    <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                      {tripDays} days long
                    </span>
                  )}
                  {trip.cities?.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                      {trip.cities.length} {trip.cities.length === 1 ? "city" : "cities"}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)}>
            <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-editorial" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5 p-6 pb-0">
                <h2 className="font-heading text-lg text-foreground">Edit Trip</h2>
                <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Trip name</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors font-heading text-lg" />
                </div>
                <div className="relative">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Country (add more than one for multi-destination trips)</label>
                  {(() => {
                    const existingCountries = form.country ? form.country.split(",").map(c => c.trim()).filter(Boolean) : [];
                    const addCountry = (c) => {
                      if (c && !existingCountries.includes(c)) setForm(f => ({ ...f, country: [...existingCountries, c].join(", ") }));
                      setCountryInput("");
                      setCountrySuggestions([]);
                    };
                    return (
                      <>
                        <div className="flex gap-2">
                          <input
                            value={countryInput}
                            onChange={e => { setCountryInput(e.target.value); if (e.target.value.length >= 1) searchCountries(e.target.value, setCountrySuggestions); else setCountrySuggestions([]); }}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCountry(countryInput.trim()); } }}
                            onBlur={() => setTimeout(() => setCountrySuggestions([]), 200)}
                            className="flex-1 min-w-0 bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors"
                            placeholder="e.g. Colombia — search, or type and tap +" />
                          <button type="button" onClick={() => addCountry(countryInput.trim())} disabled={!countryInput.trim()}
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#A7773F] text-[#F7F3EC] disabled:opacity-30 disabled:cursor-not-allowed">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        {countrySuggestions.length > 0 && (
                          <div className="absolute z-20 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {countrySuggestions.map((c, i) => (
                              <button key={i} onMouseDown={() => addCountry(c)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary border-b border-border last:border-0">{c}</button>
                            ))}
                          </div>
                        )}
                        {existingCountries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {existingCountries.map((c) => (
                              <span key={c} className="inline-flex items-center gap-1 bg-secondary text-foreground px-2.5 py-1 rounded-full text-xs">
                                {c}
                                <button onClick={() => setForm(f => ({ ...f, country: existingCountries.filter(x => x !== c).join(", ") }))} className="text-muted-foreground hover:text-foreground">×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="relative">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Cities</label>
                  {(() => {
                    const selectedCountries = form.country ? form.country.split(",").map(c => c.trim()).filter(Boolean) : [];
                    const addedCities = form.cities ? form.cities.split(",").map(c => c.trim()).filter(Boolean) : [];
                    const addCity = (c) => {
                      const typed = (c || "").trim();
                      if (typed && !addedCities.includes(typed)) {
                        setForm(f => ({ ...f, cities: [...addedCities, typed].join(", ") }));
                      }
                      setCityInput("");
                      setCitySuggestions([]);
                    };
                    return (
                      <>
                        <div className="flex gap-2">
                        <input placeholder={selectedCountries.length === 0 ? "Select a country first" : "Search and add cities... (or type and tap +)"}
                          disabled={selectedCountries.length === 0}
                          value={cityInput}
                          onChange={e => { const q = e.target.value; setCityInput(q); setCitySuggestions([]); if (selectedCountries.length > 0 && q.length >= 1) searchCities(q, selectedCountries, setCitySuggestions); }}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCity(cityInput);
                            }
                          }}
                          onBlur={() => setTimeout(() => setCitySuggestions([]), 200)}
                          className="flex-1 min-w-0 bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                        <button type="button" onClick={() => addCity(cityInput)} disabled={!cityInput.trim() || selectedCountries.length === 0}
                          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#A7773F] text-[#F7F3EC] disabled:opacity-30 disabled:cursor-not-allowed">
                          <Plus className="w-4 h-4" />
                        </button>
                        </div>
                        {citySuggestions.length > 0 && (
                          <div className="absolute z-20 w-full bg-card border border-border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                            {citySuggestions.map((city, i) => (
                              <button key={i} onMouseDown={() => {
                                if (!addedCities.includes(city)) { const updated = [...addedCities, city]; setForm(f => ({ ...f, cities: updated.join(", ") })); }
                                setCityInput("");
                                setCitySuggestions([]);
                              }} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary border-b border-border last:border-0">{city}</button>
                            ))}
                          </div>
                        )}
                        {addedCities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {addedCities.map((city, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-secondary text-foreground px-2.5 py-1 rounded-full text-xs">
                                {city}
                                <button onClick={() => { const updated = addedCities.filter((_, idx) => idx !== i); setForm(f => ({ ...f, cities: updated.join(", ") })); }}
                                  className="text-muted-foreground hover:text-foreground">×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Flag emoji</label>
                  <input value={form.flag_emoji} onChange={e => setForm(f => ({ ...f, flag_emoji: e.target.value }))}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Start date</label>
                    <DateInput value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">End date</label>
                    <DateInput value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Budget target ($)</label>
                  <input type="number" value={form.budget_target} onChange={e => setForm(f => ({ ...f, budget_target: e.target.value }))}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors resize-none" />
                </div>
              </div>
              </div>
              <div className="flex gap-2 mt-5 p-6 pt-0 border-t border-border sticky bottom-0 bg-card">
                <button onClick={save} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
                  <Check className="w-4 h-4" /> Save Changes
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Photo edit modal */}
        {showPhotoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowPhotoModal(false)}>
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-editorial" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-lg text-foreground">Cover Photo</h2>
                <button onClick={() => setShowPhotoModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {photoUrl && (
                  <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                    <img src={photoUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Image URL</label>
                  <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors"
                    placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${uploading ? "bg-muted text-muted-foreground" : "bg-muted border border-input text-foreground hover:border-ring"}`}>
                    {uploading ? "Uploading..." : <><Upload className="w-3 h-3" /> Upload image</>}
                    <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setPhotoUrl(file_url);
                      } catch (err) {
                        console.error("Upload failed:", err);
                      } finally {
                        setUploading(false);
                      }
                    }} disabled={uploading} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={async () => {
                  const updated = await ent.Trip.update(trip.id, { hero_image_url: photoUrl || "" });
                  onUpdate(updated);
                  setShowPhotoModal(false);
                }} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => { setShowPhotoModal(false); setPhotoUrl(trip.hero_image_url || ""); }} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky journey tabs (Level 2) */}
        <div className="sticky top-0 z-20 -mx-4 md:-mx-8 mt-3 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="px-4 md:px-8 flex gap-5 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`font-body py-3 text-sm transition-colors whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="pt-5">
          {tab === "Itinerary" && <ItineraryTab trip={trip} onUpdate={onUpdate} cityOrder={orderedCities} initialDate={initialDate} />}

          {tab === "Packing" && <PackingTab trip={trip} onUpdate={onUpdate} />}

          {tab === "About" && <SavedTab trip={trip} onUpdate={onUpdate} cityOrder={orderedCities} />}
          {tab === "Budget" && <BudgetTab trip={trip} onUpdate={onUpdate} />}
          {tab === "Recap" && <MemoriesTab trip={trip} onUpdate={onUpdate} />}
        </div>
      </div>
      <BottomNav prefs={prefs} onFeedback={() => setShowFeedback(true)} />
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
