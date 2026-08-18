import { useState, useEffect } from "react";
import { searchCities, searchCountries } from "@/lib/cityData";
import { parseISO, eachDayOfInterval, format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Edit2, Check, X, Trash2, Plane, Home, MapPin, DollarSign, Calendar, Heart, List, Info, Download, Plus, Trash, Clock, Upload, ImageIcon, Pencil, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FlightTimeline from "./FlightTimeline";
import SavedTab from "./saved/SavedTab";
import PackingTab from "./PackingTab";
import ItineraryTab from "./ItineraryTab";
import ReactQuill from "react-quill";
import BudgetTab from "./BudgetTab";
import MemoriesTab from "./MemoriesTab";
import BottomNav from "@/components/BottomNav";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import "react-quill/dist/quill.snow.css";
import DateInput from "@/components/DateInput";

const TABS = [
  { id: "Itinerary", label: "Itinerary" },
  { id: "About", label: "Saved" },
  { id: "Packing", label: "Packing" },
  { id: "Budget", label: "Budget" },
  { id: "Recap", label: "Memories" },
];

const statusOptions = ["planning", "confirmed", "completed"];
const statusColors = {
  planning:  "bg-amber-50 text-amber-700 border-amber-100",
  confirmed: "bg-green-50 text-green-700 border-green-100",
  completed: "bg-stone-100 text-stone-500 border-stone-200",
};

export default function TripDetail({ trip, onBack, onUpdate, initialTab, initialEditOpen }) {
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
        const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
        if (p.length > 0) setPrefs(p[0]);
      } catch {}
    };
    load();
  }, []);

  const save = async () => {
    // Same fix as NewJourneySheet — capture typed-but-unconfirmed text in the
    // country/city inputs so it isn't silently lost if Save is tapped before
    // pressing Enter or clicking a suggestion.
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

    // Only regenerate itinerary if trip dates actually changed
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

    const updated = await base44.entities.Trip.update(trip.id, updateData);
    onUpdate(updated);
    setEditing(false);
  };

  const deleteTrip = async () => {
    if (!confirm("Delete this trip?")) return;
    setDeletingTrip(true);
    try {
      await base44.entities.Trip.delete(trip.id);
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

  // Order cities by their first chronological mention in the itinerary
  // Cities are shown in exactly the order set on the trip — no automatic
  // reordering. An earlier version tried to re-sort by whichever city was
  // "first mentioned" in the itinerary's actual text content, but that's
  // fragile: a city that simply hasn't been typed anywhere yet (very common
  // right after auto-generating blank days) would lose its place to
  // whichever city happened to get a stray mention first, silently
  // overriding the order the person deliberately chose.
  const orderedCities = trip.cities || [];

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
          {/* Back + actions */}
          <div className="flex items-center justify-between" style={{ paddingTop: '8px' }}>
            <button onClick={onBack} className="p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
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
                <DropdownMenuItem onClick={() => { setPhotoUrl(trip.hero_image_url || ""); setShowPhotoModal(true); }} className="gap-2 cursor-pointer">
                  <ImageIcon className="w-4 h-4" /> Cover photo
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

          {/* Cover photo + title + status + route */}
          <div className="flex gap-4 items-start pt-2">
            <button
              onClick={() => { setPhotoUrl(trip.hero_image_url || ""); setShowPhotoModal(true); }}
              className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex-shrink-0 bg-secondary flex items-center justify-center"
            >
              {trip.hero_image_url ? (
                <img src={trip.hero_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-muted-foreground" strokeWidth={1.6} />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading text-[26px] leading-tight text-foreground font-semibold truncate">
                  {trip.flag_emoji && <span className="text-xl leading-none mr-1">{trip.flag_emoji}</span>}
                  {trip.title}
                </h1>
                <button
                  onClick={() => setEditing(true)}
                  className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span className={`inline-flex font-body text-[11px] px-2.5 py-0.5 rounded-full border ${statusColors[trip.status || "planning"]}`}>
                  {trip.status || "planning"}
                </span>
              </div>
              {(orderedCities.length > 0 || trip.country) && (
                <div className="flex items-center gap-1 font-body text-[13px] text-muted-foreground min-w-0 mt-1.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{(orderedCities.length > 0 ? orderedCities : [trip.country]).filter(Boolean).join(" → ")}</span>
                  <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
                </div>
              )}
            </div>
          </div>

          {/* Trip metadata — pill badges */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              {daysUntil !== null && daysUntil > 0 ? `${daysUntil} days away` : "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              {tripDays ? `${tripDays} days long` : "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 font-body text-[12px] text-foreground bg-secondary px-3 py-1.5 rounded-full">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              {trip.cities?.length || 0} cities
            </span>
          </div>
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
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-30 disabled:cursor-not-allowed">
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
                          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-30 disabled:cursor-not-allowed">
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
                  const updated = await base44.entities.Trip.update(trip.id, { hero_image_url: photoUrl || "" });
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
          {tab === "Itinerary" && <ItineraryTab trip={trip} onUpdate={onUpdate} cityOrder={orderedCities} />}

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

export function DetailsTab({ trip, onUpdate }) {
  const [editingFlights, setEditingFlights] = useState(false);
  const [editingStays, setEditingStays] = useState(false);
  const [flightList, setFlightList] = useState(() => {
    if (trip.flights?.length > 0) return trip.flights;
    const legacy = [trip.flight_info?.outbound, trip.flight_info?.return]
      .filter(f => f && (f.airline || f.departure_airport))
      .map((f, i) => ({ ...f, label: i === 0 ? "Outbound" : "Return" }));
    return legacy.length > 0 ? legacy : [];
  });
  const [stayList, setStayList] = useState(trip.stay_info || []);

  const addFlight = () => {
    setFlightList([...flightList, { label: "", airline: "", flight_number: "", departure_date: "", departure_time: "", departure_airport: "", arrival_date: "", arrival_time: "", arrival_airport: "", seat: "", terminal_gate: "" }]);
  };

  const removeFlight = (index) => {
    setFlightList(flightList.filter((_, i) => i !== index));
  };

  const updateFlight = (index, field, value) => {
    const updated = [...flightList];
    updated[index] = { ...updated[index], [field]: value };
    setFlightList(updated);
  };

  const saveFlights = async () => {
    const updateData = { flights: flightList };

    // Auto-generate itinerary days from trip start/end dates only (not flight dates)
    if (trip.start_date && trip.end_date) {
      const start = parseISO(trip.start_date);
      const end = parseISO(trip.end_date);
      if (end >= start) {
        const days = eachDayOfInterval({ start, end });
        const existing = trip.itinerary || [];
        const newItinerary = days.map((d, i) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const alreadyExists = existing.find(e => e.date === dateStr);
          return alreadyExists ? { ...alreadyExists, day: i + 1 } : { day: i + 1, date: dateStr, title: "", description: "", activities: [] };
        });

        // Add arrival info to the matching day (fall back to day 1 if arrival date is outside trip range)
        const outbound = flightList.find(f => f.label === "Outbound" || (!f.label && flightList.indexOf(f) === 0));
        if (outbound) {
          const matchDate = outbound.arrival_date || outbound.departure_date;
          let dayIndex = matchDate ? newItinerary.findIndex(d => d.date === matchDate) : -1;
          if (dayIndex < 0) dayIndex = 0; // fall back to first day
          if (dayIndex >= 0) {
            const arrivalActivity = {
              time: outbound.arrival_time || "",
              activity: `Arrive at ${outbound.arrival_airport || "destination"}`,
              location: outbound.arrival_airport || "",
              notes: outbound.airline ? `${outbound.airline} ${outbound.flight_number || ""}`.trim() : "",
            };
            const day = newItinerary[dayIndex];
            // Only add if not already present
            const exists = day.activities?.some(a => a.activity === arrivalActivity.activity);
            if (!exists) {
              day.activities = [arrivalActivity, ...(day.activities || [])];
            }
          }
        }

        updateData.itinerary = newItinerary;
      }
    }

    const updated = await base44.entities.Trip.update(trip.id, updateData);
    onUpdate(updated);
    setEditingFlights(false);
  };

  const saveStays = async () => {
    const updated = await base44.entities.Trip.update(trip.id, { stay_info: stayList });
    onUpdate(updated);
    setEditingStays(false);
  };

  const deleteStay = async (index) => {
    const updated = stayList.filter((_, i) => i !== index);
    const saved = await base44.entities.Trip.update(trip.id, { stay_info: updated });
    setStayList(updated);
    onUpdate(saved);
  };

  const clearFlights = async () => {
    if (!confirm("Clear all flight info?")) return;
    const saved = await base44.entities.Trip.update(trip.id, { flights: [], flight_info: {} });
    onUpdate(saved);
  };

  const addStay = () => {
    setStayList([...stayList, {}]);
  };

  const removeStay = (index) => {
    setStayList(stayList.filter((_, i) => i !== index));
  };

  const updateStay = (index, field, value) => {
    const updated = [...stayList];
    updated[index] = { ...updated[index], [field]: value };
    setStayList(updated);
  };

  return (
    <div className="space-y-4 font-body">
      {/* Flights Section */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div
          className={`flex items-center justify-between mb-3 ${!editingFlights ? "cursor-pointer" : ""}`}
          onClick={!editingFlights ? () => setEditingFlights(true) : undefined}
        >
          <h3 className="font-heading text-sm font-medium text-foreground flex items-center gap-2"><Plane className="w-4 h-4" /> ✈️ Flights</h3>
          {!editingFlights ? (
            <div className="flex items-center gap-1">
              {(trip.flights?.length > 0 || trip.flight_info?.outbound?.airline || trip.flight_info?.return?.airline) && (
                <button onClick={e => { e.stopPropagation(); clearFlights(); }} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash className="w-4 h-4" /></button>
              )}
              <button onClick={e => { e.stopPropagation(); setEditingFlights(true); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveFlights} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"><Check className="w-3 h-3" /> Save</button>
              <button onClick={() => setEditingFlights(false)} className="text-muted-foreground hover:text-foreground text-xs px-2">Cancel</button>
            </div>
          )}
        </div>
        {editingFlights ? (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button onClick={addFlight} className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1.5 rounded-lg hover:opacity-90 transition-colors">
                <Plus className="w-3 h-3" /> Add flight
              </button>
            </div>
            {flightList.map((flight, index) => (
              <div key={index} className="bg-muted border border-border rounded-xl p-4 relative">
                {flightList.length > 1 && (
                  <button onClick={() => removeFlight(index)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash className="w-4 h-4" />
                  </button>
                )}
                <div className="mb-3">
                  <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                  <select value={flight.label || ""} onChange={e => updateFlight(index, "label", e.target.value)} className="w-full bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring">
                    <option value="">Select label…</option>
                    <option value="Outbound">Outbound</option>
                    <option value="Layover">Layover</option>
                    <option value="Return">Return</option>
                    <option value="Connection">Connection</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Airline" value={flight.airline || ""} onChange={e => updateFlight(index, "airline", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                  <input placeholder="Flight #" value={flight.flight_number || ""} onChange={e => updateFlight(index, "flight_number", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                  <div><label className="text-xs text-muted-foreground mb-1 block">Departure date</label><DateInput value={flight.departure_date || ""} onChange={e => updateFlight(index, "departure_date", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Clock className="w-3 h-3" /> Departure time</label><input type="time" value={flight.departure_time || ""} onChange={e => updateFlight(index, "departure_time", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Arrival date</label><DateInput value={flight.arrival_date || ""} onChange={e => updateFlight(index, "arrival_date", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Clock className="w-3 h-3" /> Arrival time</label><input type="time" value={flight.arrival_time || ""} onChange={e => updateFlight(index, "arrival_time", e.target.value)} /></div>
                  <input placeholder="From (e.g. LAX)" value={flight.departure_airport || ""} onChange={e => updateFlight(index, "departure_airport", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                  <input placeholder="To (e.g. NRT)" value={flight.arrival_airport || ""} onChange={e => updateFlight(index, "arrival_airport", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                  <input placeholder="Seat" value={flight.seat || ""} onChange={e => updateFlight(index, "seat", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                  <input placeholder="Gate" value={flight.terminal_gate || ""} onChange={e => updateFlight(index, "terminal_gate", e.target.value)} className="bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <FlightTimeline flights={trip.flights} flightInfo={trip.flight_info} />
        )}
      </div>

      {/* Stays Section */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div
          className={`flex items-center justify-between mb-3 ${!editingStays ? "cursor-pointer" : ""}`}
          onClick={!editingStays ? () => setEditingStays(true) : undefined}
        >
          <h3 className="font-heading text-sm font-medium text-foreground flex items-center gap-2"><Home className="w-4 h-4" /> 🏨 Stays</h3>
          {!editingStays ? (
            <button onClick={e => { e.stopPropagation(); setEditingStays(true); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveStays} className="flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"><Check className="w-3 h-3" /> Save</button>
              <button onClick={() => setEditingStays(false)} className="text-muted-foreground hover:text-foreground text-xs px-2">Cancel</button>
            </div>
          )}
        </div>
        {editingStays ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={addStay} className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1.5 rounded-lg hover:opacity-90 transition-colors">
                <Plus className="w-3 h-3" /> Add stay
              </button>
            </div>
            {stayList.map((stay, index) => (
              <div key={index} className="bg-muted border border-border rounded-xl p-4 relative">
                {stayList.length > 1 && (
                  <button onClick={() => removeStay(index)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash className="w-4 h-4" />
                  </button>
                )}
                <p className="text-xs text-muted-foreground mb-2">Stay #{index + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Property name</label><input placeholder="e.g. The Grand Hotel" value={stay.property_name || ""} onChange={e => updateStay(index, "property_name", e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Property type</label><select value={stay.property_type || ""} onChange={e => updateStay(index, "property_type", e.target.value)} className="w-full bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"><option value="">Select type...</option><option value="Hotel">Hotel</option><option value="Airbnb">Airbnb</option><option value="Vacation Rental">Vacation Rental</option><option value="Family & Friends">Family &amp; Friends</option><option value="Hostel">Hostel</option><option value="Resort">Resort</option><option value="Other">Other</option></select></div>
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Address</label><input placeholder="Street address" value={stay.address || ""} onChange={e => updateStay(index, "address", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Check-in date</label><DateInput value={stay.check_in_date || ""} onChange={e => updateStay(index, "check_in_date", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Clock className="w-3 h-3" /> Check-in time</label><input type="time" value={stay.check_in_time || ""} onChange={e => updateStay(index, "check_in_time", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Check-out date</label><DateInput value={stay.check_out_date || ""} onChange={e => updateStay(index, "check_out_date", e.target.value)} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1"><Clock className="w-3 h-3" /> Check-out time</label><input type="time" value={stay.check_out_time || ""} onChange={e => updateStay(index, "check_out_time", e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Confirmation #</label><input placeholder="e.g. ABC123456" value={stay.confirmation_number || ""} onChange={e => updateStay(index, "confirmation_number", e.target.value)} /></div>
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Contact phone</label><input placeholder="Phone number" value={stay.contact_phone || ""} onChange={e => updateStay(index, "contact_phone", e.target.value)} /></div>
                  <textarea placeholder="Notes" value={stay.notes || ""} onChange={e => updateStay(index, "notes", e.target.value)} rows={2} className="col-span-2 bg-card border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          stayList && stayList.length > 0 ? (
            <div className="space-y-3">
              {stayList.map((stay, index) => (
                <div key={index} className={`relative group ${stayList.length > 1 ? "pb-3 border-b border-border last:border-0 last:pb-0" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {stayList.length > 1 && <p className="text-xs text-muted-foreground mb-1">Stay #{index + 1}</p>}
                      {stay.property_name &&               <p className="font-heading font-medium text-foreground">{stay.property_name}</p>}
                      {stay.property_type && <p className="text-xs text-muted-foreground">{stay.property_type}</p>}
                      {stay.address && <p className="text-sm text-muted-foreground">{stay.address}</p>}
                      {stay.check_in_date && <p className="text-xs text-muted-foreground mt-1">Check-in: {stay.check_in_date} {stay.check_in_time}</p>}
                      {stay.check_out_date && <p className="text-xs text-muted-foreground">Check-out: {stay.check_out_date} {stay.check_out_time}</p>}
                      {stay.confirmation_number && <p className="text-xs text-muted-foreground">Confirmation: {stay.confirmation_number}</p>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteStay(index); }} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">No stay info yet</p>
          )
        )}
      </div>

    </div>
  );
}
