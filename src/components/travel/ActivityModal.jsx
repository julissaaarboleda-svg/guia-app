import { useState, useEffect, useMemo, useRef } from "react";
import { Check, X, Clock, MapPin, Link2, ExternalLink, Plane, Building2 } from "lucide-react";
import DropdownInput from "./DropdownInput";
import AddressInput from "./AddressInput";

function minToHHMM(m) { const h = Math.floor(m / 60), mm = m % 60; return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; }
function fmt12(t) { if (!t) return ""; let [h, m] = t.split(":").map(Number); const ap = h < 12 ? "AM" : "PM"; let hp = h % 12; if (hp === 0) hp = 12; return `${hp}:${String(m || 0).padStart(2, "0")} ${ap}`; }
function suggestWindow(activities) {
  const busy = activities.map(a => a.time).filter(Boolean).map(t => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }).sort((a, b) => a - b);
  const dayStart = 9 * 60, dayEnd = 21 * 60, dur = 120;
  if (busy.length === 0) return { start: minToHHMM(dayStart), end: minToHHMM(dayStart + dur) };
  let prev = dayStart;
  for (const t of busy) {
    if (t - prev >= dur) return { start: minToHHMM(prev), end: minToHHMM(Math.min(prev + dur, t)) };
    prev = Math.max(prev, t + 90);
  }
  if (dayEnd - prev >= dur) return { start: minToHHMM(prev), end: minToHHMM(prev + dur) };
  return null;
}

// Restaurant and Activity get their own trimmed preset lists instead of one
// long shared list — picking "Restaurant" shouldn't show Museum/Hiking/etc.
export const RESTAURANT_PRESETS = ["Breakfast", "Lunch", "Dinner", "Coffee"];
export const ACTIVITY_PRESETS = ["Sightseeing", "Museum", "Beach", "Hiking", "Shopping", "Spa", "Tour", "Event", "Nightlife", "Free time", "Rest"];

const CATEGORY_TABS = [
  { key: "flight", label: "Flight", Icon: Plane },
  { key: "hotel", label: "Stay", Icon: Building2 },
  { key: "restaurant", label: "Restaurant", Icon: null },
  { key: "activity", label: "Activity", Icon: MapPin },
];

// Shared "combined date+time" field: shows one formatted chip
// ("Fri, Sep 3 · 5:18 PM") and expands into real date/time inputs on tap,
// rather than two separate plain boxes.
function DateTimeField({ label, date, time, onDateChange, onTimeChange }) {
  const [expanded, setExpanded] = useState(!date && !time);
  const display = date || time
    ? `${date ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "No date"}${time ? ` · ${fmt12(time)}` : ""}`
    : "Set date & time";

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-2 block">{label}</label>
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-2 bg-muted border border-border rounded-lg px-3 h-10 text-sm text-foreground text-left hover:border-ring transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          {display}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
            onBlur={() => { if (date && time) setExpanded(false); }}
            className="w-full bg-muted border border-border rounded-lg px-2.5 h-10 text-sm outline-none focus:border-ring transition-colors"
          />
          <input
            type="time"
            value={time}
            onChange={e => onTimeChange(e.target.value)}
            onBlur={() => { if (date && time) setExpanded(false); }}
            className="w-full bg-muted border border-border rounded-lg px-2.5 h-10 text-sm outline-none focus:border-ring transition-colors"
          />
        </div>
      )}
    </div>
  );
}

// "Count as a stop" toggle for Flight (arrival city) and Stay (hotel city) —
// pre-checked, but always overridable, so a layover never silently becomes
// an official trip city the way Punta Cana did during import.
function StopToggle({ city, checked, onChange }) {
  if (!city) return null;
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 bg-muted border border-border rounded-lg px-3 py-2.5 text-left"
    >
      <span className="text-[12.5px] text-foreground">
        Add <span className="font-medium">{city}</span> as a stop on this trip?
      </span>
      <span
        className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ${checked ? "bg-accent" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

export default function ActivityModal({ open, initialActivity, tripLocations, dayLabel, dayOptions, initialDayDate, itinerary, trip, onSave, onClose }) {
  const [category, setCategory] = useState("activity");

  // Shared/simple fields (Restaurant + Activity)
  const [time, setTime] = useState("");
  const [activity, setActivity] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [link, setLink] = useState("");
  const [dayDate, setDayDate] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);

  // Flight-specific fields
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");
  const [depCity, setDepCity] = useState("");
  const [arrDate, setArrDate] = useState("");
  const [arrTime, setArrTime] = useState("");
  const [arrCity, setArrCity] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [countArrivalAsStop, setCountArrivalAsStop] = useState(true);

  // Stay-specific fields
  const [checkInDate, setCheckInDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [countHotelAsStop, setCountHotelAsStop] = useState(true);

  const initRef = useRef(null);
  initRef.current = initialActivity;

  const existingCities = useMemo(() => (trip?.cities || []).map(c => (c || "").toLowerCase()), [trip]);

  const dayActivities = useMemo(() => {
    if (!itinerary || !dayDate) return [];
    const d = itinerary.find(x => x.date === dayDate);
    return (d?.activities || []).filter(a => a.time).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [itinerary, dayDate]);
  const suggested = useMemo(() => suggestWindow(dayActivities), [dayActivities]);

  useEffect(() => {
    if (!open) return;
    const init = initialActivity;
    // Detect category from an existing item so editing opens the right tab
    const detectedCategory = init?.category || (init ? guessCategoryFromLegacy(init) : "activity");
    setCategory(detectedCategory);

    if (init) {
      setTime(init.time || ""); setActivity(init.activity || ""); setName(init.name || "");
      setLocation(init.location || ""); setAddress(init.address || ""); setLink(init.link || ""); setNotes(init.notes || "");
      setDepDate(init.departure?.date || ""); setDepTime(init.departure?.time || ""); setDepCity(init.departure?.city || "");
      setArrDate(init.arrival?.date || ""); setArrTime(init.arrival?.time || ""); setArrCity(init.arrival?.city || "");
      setAirline(init.airline || ""); setFlightNum(init.flightNumber || "");
      setCheckInDate(init.checkIn?.date || ""); setCheckInTime(init.checkIn?.time || "");
      setCheckOutDate(init.checkOut?.date || ""); setCheckOutTime(init.checkOut?.time || "");
      setHotelName(init.name || "");
    } else {
      setTime(""); setActivity(""); setName(""); setLocation(""); setAddress(""); setLink(""); setNotes("");
      setDepDate(""); setDepTime(""); setDepCity(""); setArrDate(""); setArrTime(""); setArrCity("");
      setAirline(""); setFlightNum("");
      setCheckInDate(""); setCheckInTime(""); setCheckOutDate(""); setCheckOutTime(""); setHotelName("");
      setCountArrivalAsStop(true); setCountHotelAsStop(true);
    }
    if (dayOptions && dayOptions.length) {
      setDayDate(initialDayDate || init?.dayDate || dayOptions[0].date || "");
    }
  }, [open, initialActivity, dayOptions, initialDayDate]);

  // Auto-populate address for saved items via the same geocoder used elsewhere
  useEffect(() => {
    if (!open || !dayOptions || address || category === "flight") return;
    const init = initRef.current;
    if (!init || !init.name) return;
    let alive = true;
    setAddrLoading(true);
    const q = `${init.name}, ${init.location || ""}`.trim();
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1`, { headers: { "Accept-Language": "en-US,en" } })
      .then(r => r.json())
      .then(data => { if (alive && data && data[0]) setAddress(data[0].display_name); })
      .catch(() => {})
      .finally(() => { if (alive) setAddrLoading(false); });
    return () => { alive = false; };
  }, [open, dayOptions, address, category]);

  if (!open) return null;
  const isEdit = !!initialActivity;
  const presets = category === "restaurant" ? RESTAURANT_PRESETS : ACTIVITY_PRESETS;

  // Whether the current toggle-relevant city is genuinely new (not already
  // an official trip city) — used to decide whether to even show the toggle.
  const arrIsNewCity = arrCity && !existingCities.includes(arrCity.toLowerCase());
  const hotelCityIsNew = location && !existingCities.includes(location.toLowerCase());

  const handleSave = () => {
    let payload;
    if (category === "flight") {
      payload = {
        category: "flight",
        activity: activity || "Flight",
        time: depTime,
        departure: { date: depDate, time: depTime, city: depCity },
        arrival: { date: arrDate, time: arrTime, city: arrCity },
        airline, flightNumber: flightNum,
        location: arrCity, name: [airline, flightNum].filter(Boolean).join(" · "), notes,
        ...(dayOptions ? { dayDate } : {}),
        _newStopCity: arrIsNewCity && countArrivalAsStop ? arrCity : null,
      };
    } else if (category === "hotel") {
      payload = {
        category: "hotel",
        activity: activity || "Hotel stay",
        time: checkInTime,
        checkIn: { date: checkInDate, time: checkInTime },
        checkOut: { date: checkOutDate, time: checkOutTime },
        name: hotelName, address, link, location, notes,
        ...(dayOptions ? { dayDate } : {}),
        _newStopCity: hotelCityIsNew && countHotelAsStop ? location : null,
      };
    } else {
      payload = {
        category, time, activity, name, location, address, link, notes,
        ...(dayOptions ? { dayDate } : {}),
      };
    }
    onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm shadow-editorial flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-heading text-base text-foreground">
            {isEdit ? "Edit activity" : "Add activity"}
            {dayLabel && <span className="text-muted-foreground font-body text-xs ml-1.5">· {dayLabel}</span>}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-5 pb-3">
          {CATEGORY_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setCategory(t.key)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                category === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {dayOptions && dayOptions.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Date</label>
              <select
                value={dayDate}
                onChange={e => setDayDate(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
              >
                {dayOptions.map(o => (
                  <option key={o.date} value={o.date}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* ---------------- FLIGHT ---------------- */}
          {category === "flight" && (
            <>
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Departure</p>
                <DateTimeField label="Date & time" date={depDate} time={depTime} onDateChange={setDepDate} onTimeChange={setDepTime} />
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">City / Airport</label>
                  <DropdownInput value={depCity} onChange={setDepCity} options={tripLocations} placeholder="Departure city…" icon={MapPin} />
                </div>
              </div>
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pt-2">Arrival</p>
                <DateTimeField label="Date & time" date={arrDate} time={arrTime} onDateChange={setArrDate} onTimeChange={setArrTime} />
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">City / Airport</label>
                  <DropdownInput value={arrCity} onChange={setArrCity} options={tripLocations} placeholder="Arrival city…" icon={MapPin} />
                </div>
                {arrIsNewCity && (
                  <StopToggle city={arrCity} checked={countArrivalAsStop} onChange={setCountArrivalAsStop} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Airline</label>
                  <input value={airline} onChange={e => setAirline(e.target.value)} placeholder="e.g. LATAM"
                    className="w-full bg-muted border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-ring transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Flight #</label>
                  <input value={flightNum} onChange={e => setFlightNum(e.target.value)} placeholder="e.g. LA3142"
                    className="w-full bg-muted border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-ring transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Confirmation number, seat, etc."
                  className="w-full min-h-[40px] bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
              </div>
            </>
          )}

          {/* ---------------- STAY ---------------- */}
          {category === "hotel" && (
            <>
              <DateTimeField label="Check-in" date={checkInDate} time={checkInTime} onDateChange={setCheckInDate} onTimeChange={setCheckInTime} />
              <DateTimeField label="Check-out" date={checkOutDate} time={checkOutTime} onDateChange={setCheckOutDate} onTimeChange={setCheckOutTime} />
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Hotel name</label>
                <input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="Hotel name…"
                  className="w-full bg-muted border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-ring transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">City</label>
                <DropdownInput value={location} onChange={setLocation} options={tripLocations} placeholder="Select or type city…" icon={MapPin} />
              </div>
              {hotelCityIsNew && (
                <StopToggle city={location} checked={countHotelAsStop} onChange={setCountHotelAsStop} />
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Address {addrLoading && <span className="text-muted-foreground/60">· auto-filling…</span>}</label>
                <AddressInput value={address} onChange={setAddress} placeholder="Search or type address…" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground block">Website</label>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                      <ExternalLink className="w-3 h-3" /> Visit website
                    </a>
                  )}
                </div>
                <div className="relative flex items-center bg-muted border border-border rounded-lg h-10">
                  <Link2 className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                  <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
                    className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring h-10" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Confirmation number, room preferences, etc."
                  className="w-full min-h-[40px] bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
              </div>
            </>
          )}

          {/* ---------------- RESTAURANT / ACTIVITY (shared shape) ---------------- */}
          {(category === "restaurant" || category === "activity") && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Time</label>
                <div className="relative flex items-center bg-muted border border-border rounded-lg h-10">
                  <Clock className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring h-10 [&::-webkit-calendar-picker-indicator]:hidden" />
                </div>
                {dayOptions && suggested && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-body text-[11px] text-muted-foreground">Suggested window: <span className="text-foreground">{fmt12(suggested.start)} – {fmt12(suggested.end)}</span></span>
                    <button type="button" onClick={() => setTime(suggested.start)} className="ml-auto text-[11px] text-accent hover:underline">Use start</button>
                  </div>
                )}
                {dayOptions && dayActivities.length > 0 && (
                  <p className="font-body text-[10px] text-muted-foreground mt-1">Already scheduled: {dayActivities.map(a => fmt12(a.time)).join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">{category === "restaurant" ? "Meal" : "Activity"}</label>
                <DropdownInput value={activity} onChange={setActivity} options={presets} placeholder={category === "restaurant" ? "Select or type meal…" : "Select or type activity…"} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground block">Name</label>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                      <ExternalLink className="w-3 h-3" /> Visit website
                    </a>
                  )}
                </div>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={category === "restaurant" ? "Restaurant name…" : "Venue name…"}
                  className="w-full bg-muted border border-border rounded-lg px-3 h-10 text-sm outline-none focus:border-ring transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Location</label>
                <DropdownInput value={location} onChange={setLocation} options={tripLocations} placeholder="Select or type location…" icon={MapPin} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Address {addrLoading && <span className="text-muted-foreground/60">· auto-filling…</span>}</label>
                <AddressInput value={address} onChange={setAddress} placeholder="Search or type address…" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Website</label>
                <div className="relative flex items-center bg-muted border border-border rounded-lg h-10">
                  <Link2 className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                  <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
                    className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring h-10" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add notes…"
                  className="w-full min-h-[40px] bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-border">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
          >
            <Check className="w-4 h-4" /> {isEdit ? "Save" : "Add activity"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Old items created before category tabs existed don't have a `category`
// field — guess a reasonable one from their content so editing an old item
// opens on a sensible tab, without needing to migrate any stored data.
function guessCategoryFromLegacy(item) {
  const text = `${item.activity || ""} ${item.name || ""}`.toLowerCase();
  if (/flight|airline|airport/.test(text)) return "flight";
  if (/hotel|check-in|check-out|stay/.test(text)) return "hotel";
  if (/dinner|lunch|breakfast|restaurant|reservation|coffee/.test(text)) return "restaurant";
  return "activity";
}
