import { useState, useEffect, useMemo, useRef } from "react";
import { Check, X, Clock, MapPin, Link2, ExternalLink } from "lucide-react";
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

export const ACTIVITY_PRESETS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Coffee",
  "Check-in",
  "Check-out",
  "Flight",
  "Airport arrival",
  "Train",
  "Transfer",
  "Sightseeing",
  "Museum",
  "Beach",
  "Hiking",
  "Shopping",
  "Spa",
  "Tour",
  "Event",
  "Nightlife",
  "Free time",
  "Rest",
];

export default function ActivityModal({ open, initialActivity, tripLocations, dayLabel, dayOptions, initialDayDate, itinerary, onSave, onClose }) {
  const [time, setTime] = useState("");
  const [activity, setActivity] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [link, setLink] = useState("");
  const [dayDate, setDayDate] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const initRef = useRef(null);
  initRef.current = initialActivity;

  const dayActivities = useMemo(() => {
    if (!itinerary || !dayDate) return [];
    const d = itinerary.find(x => x.date === dayDate);
    return (d?.activities || []).filter(a => a.time).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [itinerary, dayDate]);
  const suggested = useMemo(() => suggestWindow(dayActivities), [dayActivities]);

  useEffect(() => {
    if (open && initialActivity) {
      setTime(initialActivity.time || "");
      setActivity(initialActivity.activity || "");
      setName(initialActivity.name || "");
      setLocation(initialActivity.location || "");
      setAddress(initialActivity.address || "");
      setLink(initialActivity.link || "");
      setNotes(initialActivity.notes || "");
    } else if (open) {
      setTime("");
      setActivity("");
      setName("");
      setLocation("");
      setAddress("");
      setLink("");
      setNotes("");
    }
    if (open && dayOptions && dayOptions.length) {
      setDayDate(initialDayDate || initialActivity?.dayDate || dayOptions[0].date || "");
    }
  }, [open, initialActivity, dayOptions, initialDayDate]);

  // Auto-populate address for saved items via the same geocoder used elsewhere
  useEffect(() => {
    if (!open || !dayOptions || address) return;
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
  }, [open, dayOptions, address]);

  if (!open) return null;

  const isEdit = !!initialActivity;

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
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Time</label>
            <div className="relative flex items-center bg-muted border border-border rounded-lg" style={{ height: '40px' }}>
              <Clock className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring [&::-webkit-calendar-picker-indicator]:hidden"
                style={{ height: '40px', lineHeight: '40px' }}
              />
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
            <label className="text-xs text-muted-foreground mb-2 block">Activity</label>
            <DropdownInput
              value={activity}
              onChange={setActivity}
              options={ACTIVITY_PRESETS}
              placeholder="Select or type activity…"
            />
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
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Venue, hotel, or restaurant name…"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Location</label>
            <DropdownInput
              value={location}
              onChange={setLocation}
              options={tripLocations}
              placeholder="Select or type location…"
              icon={MapPin}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Address {addrLoading && <span className="text-muted-foreground/60">· auto-filling…</span>}</label>
            <AddressInput value={address} onChange={setAddress} placeholder="Search or type address…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Website</label>
            <div className="relative flex items-center bg-muted border border-border rounded-lg" style={{ height: '40px' }}>
              <Link2 className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://…"
                className="w-full bg-transparent border-none pl-9 pr-3 text-sm outline-none focus:border-ring"
                style={{ height: '40px', lineHeight: '40px' }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Notes</label>
            <textarea
              placeholder="Add notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full min-h-[40px] bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 pt-3 border-t border-border">
          <button
            onClick={() => onSave(dayOptions ? { time, activity, name, location, address, link, notes, dayDate } : { time, activity, name, location, address, link, notes })}
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