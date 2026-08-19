import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Edit2, Check, X, Plus, Trash, Calendar, MapPin, Star } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { parseISO, format, addDays } from "date-fns";
import ActivityModal, { ACTIVITY_PRESETS } from "./ActivityModal";
import DropdownInput from "./DropdownInput";
import DateStrip from "./itinerary/DateStrip";
import TimelineCard from "./itinerary/TimelineCard";
import AddItemSheet from "./itinerary/AddItemSheet";
import { ADD_TYPE_BY_KEY, formatTime } from "./itinerary/activityTypes";
import { toast } from "sonner";
import { savePlaceToMemories, categoryFromActivity } from "@/lib/memoryUtils";
import DateInput from "@/components/DateInput";

function deriveAlerts(day) {
  const acts = day?.activities || [];
  if (acts.length === 0) return [];
  const pills = [];
  const noTime = acts.filter((a) => !a.time).length;
  if (noTime > 0) pills.push({ label: `${noTime} unscheduled`, tone: "amber" });
  const timed = acts
    .filter((a) => a.time)
    .map((a) => ({ ...a, mins: parseInt(a.time.split(":")[0], 10) * 60 + parseInt(a.time.split(":")[1], 10) }))
    .sort((a, b) => a.mins - b.mins);
  for (let i = 1; i < timed.length; i++) {
    const gapMins = timed[i].mins - timed[i - 1].mins;
    if (gapMins >= 180) {
      const gapH = Math.round((gapMins / 60) * 2) / 2;
      pills.push({ label: `${gapH}h gap`, tone: "amber" });
      break;
    }
  }
  if (acts.some((a) => /flight|airport|airline/i.test(`${a.activity} ${a.location}`))) {
    pills.push({ label: "Travel day", tone: "neutral" });
  }
  pills.push({ label: `${acts.length} planned`, tone: "neutral" });
  return pills.slice(0, 3);
}

function dayCity(day, trip, cityOrder) {
  const cities = ((cityOrder && cityOrder.length ? cityOrder : trip.cities) || []).filter(Boolean);
  if (cities.length === 0) return trip.country || "";
  if (cities.length === 1) return cities[0];

  // If the day's content references a specific city, use it
  const hay = `${day?.title || ""} ${day?.description || ""} ${(day?.activities || [])
    .map((a) => `${a.activity || ""} ${a.location || ""} ${a.notes || ""}`)
    .join(" ")}`.toLowerCase();
  const matched = cities
    .map((c) => ({ c, idx: hay.indexOf(c.toLowerCase()) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0];
  if (matched) return matched.c;

  // Otherwise map the day's date across the trip date range onto the city order
  if (day?.date && trip.start_date && trip.end_date) {
    const s = Date.parse(trip.start_date + "T00:00:00");
    const e = Date.parse(trip.end_date + "T00:00:00");
    const d = Date.parse(day.date + "T00:00:00");
    if (e > s) {
      const pos = Math.max(0, Math.min(1, (d - s) / (e - s)));
      const idx = Math.min(cities.length - 1, Math.round(pos * (cities.length - 1)));
      return cities[idx];
    }
  }
  return cities[0];
}

export default function ItineraryTab({ trip, onUpdate, cityOrder }) {
  const [itinerary, setItinerary] = useState(trip.itinerary || []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activityModal, setActivityModal] = useState({ open: false, dayIndex: null, actIndex: null, activity: null });
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [dayEdit, setDayEdit] = useState({ open: false, index: null, title: "", description: "", date: "" });
  const [importing, setImporting] = useState(false);
  const [confirmCities, setConfirmCities] = useState(null); // { cities: [...], checked: Set }

  const tripLocations = [...(trip.cities || []), trip.country].filter(Boolean);

  useEffect(() => { setItinerary(trip.itinerary || []); }, [trip.itinerary]);
  useEffect(() => { if (activeIdx > itinerary.length - 1) setActiveIdx(Math.max(0, itinerary.length - 1)); }, [itinerary.length, activeIdx]);

  const persist = async (next) => {
    const saved = await base44.entities.Trip.update(trip.id, { itinerary: next });
    onUpdate(saved);
    return saved;
  };

  // Auto-generate one day per date in the trip's range the first time this
  // tab is opened on a fresh trip. Previously nothing ever populated the
  // itinerary automatically — you had to add every day by hand, one at a
  // time, which is what made it look like "not all the dates" showed up.
  useEffect(() => {
    if (itinerary.length > 0 || !trip.start_date || !trip.end_date) return;
    const start = parseISO(trip.start_date);
    const end = parseISO(trip.end_date);
    if (end < start) return;
    const days = [];
    let cursor = start;
    let dayNum = 1;
    while (cursor <= end && dayNum <= 60) {
      days.push({ day: dayNum, date: format(cursor, "yyyy-MM-dd"), title: "", description: "", activities: [] });
      cursor = addDays(cursor, 1);
      dayNum++;
    }
    if (days.length > 0) {
      setItinerary(days);
      persist(days);
    }
  }, [trip.id, trip.start_date, trip.end_date]);

  const addDay = () => {
    let defaultDate = "";
    const dated = (itinerary || []).map((d) => d.date).filter(Boolean).sort();
    if (dated.length > 0) {
      defaultDate = format(addDays(parseISO(dated[dated.length - 1]), 1), "yyyy-MM-dd");
    } else if (trip.start_date) {
      defaultDate = trip.start_date;
    }
    setDayEdit({ open: true, index: null, title: "", description: "", date: defaultDate });
  };

  const deleteDay = async (index) => {
    if (!confirm("Delete this day?")) return;
    const next = itinerary.filter((_, i) => i !== index);
    setItinerary(next);
    setActiveIdx(Math.max(0, index - 1));
    persist(next);
  };

  const saveDayEdit = async () => {
    if (dayEdit.index === null) {
      const nextDay = (itinerary.length > 0 ? Math.max(...itinerary.map((d) => d.day)) : 0) + 1;
      const newDay = { day: nextDay, date: dayEdit.date || "", title: dayEdit.title, description: dayEdit.description, activities: [] };
      const next = [...itinerary, newDay].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return (a.day || 0) - (b.day || 0);
      });
      next.forEach((d, i) => { d.day = i + 1; });
      const newIdx = next.indexOf(newDay);
      setItinerary(next);
      setActiveIdx(newIdx >= 0 ? newIdx : next.length - 1);
      setDayEdit({ open: false, index: null, title: "", description: "", date: "" });
      persist(next);
      return;
    }
    // Editing an existing day's date needs to re-sort the whole array
    // afterward too — previously it just updated in place at the same
    // array position, so changing a day's date to something earlier or
    // later than its neighbors left the list visibly out of order.
    const next = [...itinerary];
    const editedDay = { ...next[dayEdit.index], title: dayEdit.title, description: dayEdit.description, date: dayEdit.date || next[dayEdit.index].date };
    next[dayEdit.index] = editedDay;
    next.sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return (a.day || 0) - (b.day || 0);
    });
    next.forEach((d, i) => { d.day = i + 1; });
    setItinerary(next);
    setActiveIdx(next.indexOf(editedDay));
    setDayEdit({ open: false, index: null, title: "", description: "", date: "" });
    persist(next);
  };

  const saveActivity = async (activity) => {
    const { dayIndex, actIndex } = activityModal;
    const { _newStopCity, ...cleanActivity } = activity;
    let next = [...itinerary];

    // A flight/stay only spills onto a second day when its "arrives/checks
    // out on a different day" toggle was left on — that's what puts an
    // explicit date on arrival/checkOut now. No toggle, no second date, no
    // companion entry.
    const spilloverDate = cleanActivity.category === "flight"
      ? cleanActivity.arrival?.date
      : cleanActivity.category === "hotel"
        ? cleanActivity.checkOut?.date
        : null;
    const entryKey = cleanActivity.category === "flight"
      ? `flight-${cleanActivity.flightNumber || ""}-${cleanActivity.departure?.time || ""}-${dayIndex}`
      : cleanActivity.category === "hotel"
        ? `hotel-${cleanActivity.name || ""}-${cleanActivity.checkIn?.time || ""}-${dayIndex}`
        : null;

    if (entryKey) {
      // Remove any previous companion entry for this same flight/stay from
      // every day, so editing it (e.g. turning the toggle off, or changing
      // the date) doesn't leave a stale duplicate behind.
      next = next.map((d) => ({
        ...d,
        activities: (d.activities || []).filter((a) => a._companionKey !== entryKey),
      }));
    }

    if (actIndex !== null) {
      next[dayIndex].activities[actIndex] = cleanActivity;
    } else {
      next[dayIndex].activities = [...(next[dayIndex].activities || []), cleanActivity];
    }
    // keep timed order for a clean timeline
    next[dayIndex].activities = [...next[dayIndex].activities].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

    // Spills onto a second day — place a companion entry there too, so it
    // doesn't only show up on the day it started.
    if (spilloverDate && entryKey) {
      const otherDayIdx = next.findIndex((d) => d.date === spilloverDate);
      if (otherDayIdx !== -1) {
        const isFlight = cleanActivity.category === "flight";
        const companion = {
          ...cleanActivity,
          time: isFlight ? cleanActivity.arrival.time : cleanActivity.checkOut.time,
          location: isFlight ? cleanActivity.arrival.city : cleanActivity.location,
          activity: isFlight ? `${cleanActivity.activity || "Flight"} (arrival)` : `${cleanActivity.activity || "Hotel stay"} (check-out)`,
          _companionKey: entryKey,
        };
        next[otherDayIdx].activities = [...(next[otherDayIdx].activities || []), companion]
          .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
      }
      // If that day genuinely isn't in the itinerary yet (outside the
      // trip's current date range), there's nowhere to place it — the
      // entry still saves correctly on its original day either way.
    }

    setItinerary(next);
    setActivityModal({ open: false, dayIndex: null, actIndex: null, activity: null });
    persist(next);
    // Note: itinerary entries (flights, stays) no longer add to trip.cities
    // automatically — the trip's official city list only ever reflects what
    // was set directly on the trip itself, not individual entries added later.
  };

  const removeActivity = async (dayIndex, actIndex) => {
    const deleted = itinerary[dayIndex]?.activities?.[actIndex];
    let next = [...itinerary];
    next[dayIndex].activities = next[dayIndex].activities.filter((_, i) => i !== actIndex);

    // If this was a multi-day flight (or its arrival-day companion), clean
    // up the matching entry on the other day too — otherwise deleting one
    // half leaves an orphaned card behind.
    const key = deleted?._companionKey || (
      deleted?.category === "flight"
        ? `flight-${deleted.flightNumber || ""}-${deleted.departure?.time || ""}-${dayIndex}`
        : deleted?.category === "hotel"
          ? `hotel-${deleted.name || ""}-${deleted.checkIn?.time || ""}-${dayIndex}`
          : null
    );
    if (key) {
      next = next.map((d, i) => (
        i === dayIndex ? d : { ...d, activities: (d.activities || []).filter((a) => a._companionKey !== key) }
      ));
    }

    setItinerary(next);
    persist(next);
  };

  const saveActivityToMemories = async (dayIndex, actIndex) => {
    const a = itinerary[dayIndex]?.activities?.[actIndex];
    if (!a) return;
    const isFlight = /flight/i.test(a.activity || "");
    const routeCities = (a.location || "").split("→").map((s) => s.trim()).filter(Boolean);
    const destCity = routeCities[routeCities.length - 1] || a.location || "";
    const res = await savePlaceToMemories(trip, {
      name: isFlight ? (destCity || a.activity || "") : (a.name || a.activity || ""),
      category: categoryFromActivity(a),
      source: "itinerary",
      source_ref: a.link || "",
      city: isFlight ? (destCity || a.location || dayCity(itinerary[dayIndex], trip, cityOrder)) : (a.location || dayCity(itinerary[dayIndex], trip, cityOrder)),
      notes: a.notes || "",
    });
    if (res.added) { onUpdate(res.trip); toast.success("Saved to memories"); }
    else toast("Already in memories");
  };

  const pickAddType = (typeKey) => {
    setAddItemOpen(false);
    const t = ADD_TYPE_BY_KEY[typeKey];
    const preset = { activity: t.label, location: "", notes: "", time: "" };
    if (typeKey === "note") preset.activity = "";
    setActivityModal({ open: true, dayIndex: activeIdx, actIndex: null, activity: preset });
  };

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract travel itinerary items from this document or booking email.

For FLIGHTS (including multi-leg journeys with layovers): return ONE single activity for the ENTIRE journey, not one per segment. Set activity to "Flight", name to the airline plus all flight numbers (e.g. "Arajet DM5103 / DM6088"), location to the full route using CITY names separated by arrows (e.g. "Miami → Punta Cana → São Paulo" — NEVER airport codes), time to the initial departure time (HH:MM 24h), date to the departure date (yyyy-MM-dd), and notes to a complete segment-by-segment breakdown: for each leg list airline, flight number, departure airport code + city + local time, arrival airport code + city + local time, and the layover duration between legs; include any confirmation number. Also return arrival_date (yyyy-MM-dd of the FINAL arrival), arrival_time (HH:MM 24h of the final arrival), and arrival_city (the CITY name of the final destination — never an airport code). If there is a layover/connection, also return layover_city (the CITY name of the layover airport), layover_date (yyyy-MM-dd when the layover occurs), layover_arrival_time (HH:MM 24h LOCAL clock time when the flight arrives at the layover airport), layover_departure_time (HH:MM 24h LOCAL clock time when the next leg departs the layover airport), and layover_duration (e.g. "5 hr 16 min"); leave all of these empty if the flight is nonstop.

For other items (hotels, restaurants, tours, events, weddings, invitations, save-the-dates): return one item per booking or event. This includes decorative/graphic invitations (e.g. a wedding invite with the date, time, and venue laid out in stylized text over a graphic background) — extract the same fields from those as you would from a plain-text confirmation; the visual style doesn't change what counts as a real event. Set date (yyyy-MM-dd — for a hotel stay output separate check-in and check-out items using their respective dates; for an invitation use the event date; empty string if none), time (HH:MM 24h or empty — convert any stated local time, e.g. "16:00h" or "4pm", to 24h), activity (short label e.g. "Hotel check-in", "Hotel check-out", "Dinner reservation", "Wedding ceremony"), name (the venue, hotel, restaurant, or event name if stated — e.g. a venue name printed on an invitation — otherwise empty string), location (the CITY name e.g. "Rio de Janeiro" — never the hotel or venue name, never an airport code), address (full street address if listed, otherwise empty string), link (the venue/hotel/restaurant website URL if stated, otherwise empty string), notes (confirmation number and key booking details, or for an invitation, the couple's/host's names and any other printed details).

Only include real travel/booking/event items. Return as { activities: [...] }.`,
        file_urls: [file_url],
        response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object", properties: { date: { type: "string" }, time: { type: "string" }, activity: { type: "string" }, name: { type: "string" }, location: { type: "string" }, address: { type: "string" }, link: { type: "string" },           notes: { type: "string" }, arrival_date: { type: "string" }, arrival_time: { type: "string" }, arrival_city: { type: "string" }, layover_city: { type: "string" }, layover_date: { type: "string" }, layover_duration: { type: "string" }, layover_arrival_time: { type: "string" }, layover_departure_time: { type: "string" } } } } } },
      });
      const acts = (res?.activities || [])
        .filter((a) => a && (a.activity || a.location || a.notes || a.name))
        .map((a) => ({ date: a.date || "", time: a.time || "", activity: a.activity || "", name: a.name || "", location: a.location || "", address: a.address || "", link: a.link || "", notes: a.notes || "", arrival_date: a.arrival_date || "", arrival_time: a.arrival_time || "", arrival_city: a.arrival_city || "", layover_city: a.layover_city || "", layover_date: a.layover_date || "", layover_duration: a.layover_duration || "", layover_arrival_time: a.layover_arrival_time || "", layover_departure_time: a.layover_departure_time || "" }));
      if (acts.length === 0) { toast.error("No itinerary items found in that file"); return; }
      // Detected new destination cities aren't added silently anymore — the
      // AI's guess at "final arrival city" can occasionally be wrong (as it
      // was with a layover once), so this gets a quick confirm step instead
      // of directly editing the trip's official city list.
      const existingCities = (trip.cities || []).map((c) => (c || "").toLowerCase());
      const newCities = [];
      for (const a of acts) {
        if (/flight/i.test(a.activity || "")) {
          const city = (a.arrival_city || a.location?.split("→").pop() || "").trim();
          if (city && !existingCities.includes(city.toLowerCase()) && !newCities.map((c) => c.toLowerCase()).includes(city.toLowerCase())) {
            newCities.push(city);
          }
        }
      }
      if (newCities.length > 0) {
        setConfirmCities({ cities: newCities, checked: new Set(newCities) });
      }
      // For multi-day flights, add an arrival activity on the arrival date so that day isn't empty
      const expanded = [];
      for (const a of acts) {
        expanded.push(a);
        if (/flight/i.test(a.activity || "") && a.arrival_date && a.arrival_date !== a.date) {
          expanded.push({
            date: a.arrival_date,
            time: a.arrival_time || "",
            activity: "Airport arrival",
            name: a.name,
            location: a.arrival_city || "",
            address: "",
            link: "",
            notes: `Arrival leg of ${a.name || "the flight"}.`,
          });
        }
        if (/flight/i.test(a.activity || "") && a.layover_city) {
          const from = a.layover_arrival_time ? formatTime(a.layover_arrival_time) : "";
          const to = a.layover_departure_time ? formatTime(a.layover_departure_time) : "";
          const window = from && to ? `${from} – ${to}` : (from ? `From ${from}` : "");
          expanded.push({
            date: a.layover_date || a.date,
            time: a.layover_arrival_time || "",
            activity: "Layover",
            name: `Layover in ${a.layover_city}`,
            location: a.layover_city,
            address: "",
            link: "",
            notes: [window, a.layover_duration ? `${a.layover_duration} layover` : ""].filter(Boolean).join(" · "),
          });
        }
      }
      // Route each item to the itinerary day matching its date; undated items fall back to the active day.
      const next = itinerary.map((d) => ({ ...d, activities: [...(d.activities || [])] }));
      const dateIndex = new Map();
      const mdIndex = new Map();
      next.forEach((d, i) => {
        if (d.date) {
          dateIndex.set(d.date, i);
          mdIndex.set(d.date.slice(5), i); // MM-DD for year-insensitive matching
        }
      });
      for (const a of expanded) {
        let targetIdx = a.date && dateIndex.has(a.date) ? dateIndex.get(a.date) : null;
        if (targetIdx === null && a.date) {
          const md = a.date.slice(5);
          if (mdIndex.has(md)) {
            targetIdx = mdIndex.get(md);
            a.date = next[targetIdx].date; // normalize to the trip's year
          }
        }
        if (targetIdx === null && a.date) {
          // No day exists yet for this date (e.g. itinerary was empty, or
          // the import found dates outside the trip's original range) —
          // create one instead of guessing where it goes, which is what
          // used to crash the whole import.
          const newDay = { day: next.length + 1, date: a.date, title: "", description: "", activities: [] };
          next.push(newDay);
          dateIndex.set(a.date, next.length - 1);
          targetIdx = next.length - 1;
        }
        if (targetIdx === null && next.length === 0) {
          // Truly nothing to attach an undated item to — create a fallback day.
          next.push({ day: 1, date: "", title: "", description: "", activities: [] });
          targetIdx = 0;
        }
        if (targetIdx === null) targetIdx = Math.min(activeIdx, next.length - 1);
        next[targetIdx].activities.push(a);
      }
      // Re-sort chronologically (new days may have been inserted out of
      // order above) and renumber so "Day 1, 2, 3…" stays correct.
      next.sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        if (a.date) return -1;
        if (b.date) return 1;
        return (a.day || 0) - (b.day || 0);
      });
      next.forEach((d, i) => { d.day = i + 1; });
      // Re-sort each affected day's activities by time
      next.forEach((d) => { d.activities = [...d.activities].sort((x, y) => (x.time || "99").localeCompare(y.time || "99")); });
      setItinerary(next);
      setAddItemOpen(false);
      persist(next);
      toast.success(`Imported ${acts.length} item${acts.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error("Import failed — try a different file");
    } finally {
      setImporting(false);
    }
  };

  const day = itinerary[activeIdx];
  const city = dayCity(day, trip, cityOrder);

  if (!itinerary || itinerary.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-heading text-lg text-foreground">Itinerary</h3>
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-body text-sm text-foreground">No itinerary yet</p>
          <p className="font-body text-xs text-muted-foreground mt-1 mb-4">Add your day-by-day plans or set trip dates to build a timeline.</p>
          <button onClick={addDay} className="inline-flex items-center gap-1.5 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Add a day
          </button>
        </div>
        <WishListSection trip={trip} onUpdate={onUpdate} />

        {/* Day edit modal — this needs to be reachable from the empty state too,
            since "Add a day" opens it before any day exists yet. It used to live
            only in the populated-itinerary render path below, so tapping "Add a
            day" on a brand-new trip set dayEdit.open=true but nothing ever
            appeared, since this component was still returning the empty-state
            branch above (itinerary was still empty). */}
        {dayEdit.open && (
          <div
            className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })}
          >
            <div
              className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-editorial flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="font-heading text-lg text-foreground">{dayEdit.index === null ? "Add day" : "Edit day"}</h2>
                <button onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
                  <DateInput
                    value={dayEdit.date}
                    onChange={(e) => setDayEdit((s) => ({ ...s, date: e.target.value }))}
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Day title</label>
                  <input
                    value={dayEdit.title}
                    onChange={(e) => setDayEdit((s) => ({ ...s, title: e.target.value }))}
                    placeholder="e.g. Explore old town"
                    className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors font-heading"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                  <ReactQuill
                    value={dayEdit.description}
                    onChange={(v) => setDayEdit((s) => ({ ...s, description: v }))}
                    placeholder="Notes about this day…"
                    className="bg-muted rounded-lg quill-notes"
                    theme="snow"
                    modules={{ clipboard: { matchVisual: false } }}
                  />
                </div>
              </div>
              <div className="flex gap-2 p-5 pt-3 border-t border-border">
                <button onClick={saveDayEdit} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg text-foreground">Itinerary</h3>
        <button onClick={addDay} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-3.5 h-3.5" /> Day
        </button>
      </div>

      <DateStrip days={itinerary} activeIndex={activeIdx} onSelect={setActiveIdx} onAddDay={addDay} />

      {/* Day header */}
      <div className="pt-1">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h4 className="font-heading text-[22px] text-foreground font-semibold leading-tight">
              {day?.date ? format(parseISO(day.date), "EEEE, MMMM d") : `Day ${day?.day}`}
            </h4>
            {city && (
              <p className="font-body text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" strokeWidth={1.8} /> {city}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setDayEdit({ open: true, index: activeIdx, title: day?.title || "", description: day?.description || "", date: day?.date || "" })}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              aria-label="Edit day"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteDay(activeIdx)}
              className="p-2 text-muted-foreground/60 hover:text-destructive hover:bg-secondary rounded-lg transition-colors"
              aria-label="Delete day"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
        {day?.title && <p className="font-body text-sm text-foreground mt-1">{day.title}</p>}
        {day?.description && (
          <div className="text-sm text-muted-foreground mt-1 quill-render" dangerouslySetInnerHTML={{ __html: day.description }} />
        )}
      </div>

      {/* Timeline */}
      <div className="pt-1">
        {day?.activities && day.activities.length > 0 ? (
          <div>
            {day.activities.map((activity, actIndex) => (
              <TimelineCard
                key={actIndex}
                activity={activity}
                isLast={actIndex === day.activities.length - 1}
                onEdit={() => setActivityModal({ open: true, dayIndex: activeIdx, actIndex, activity })}
                onDelete={() => removeActivity(activeIdx, actIndex)}
                onAddToMemories={() => saveActivityToMemories(activeIdx, actIndex)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
            <p className="font-body text-sm text-muted-foreground">Nothing planned yet for this day.</p>
          </div>
        )}

        <button
          onClick={() => setAddItemOpen(true)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary/60 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Add item type sheet */}
      <AddItemSheet open={addItemOpen} onClose={() => setAddItemOpen(false)} onPick={pickAddType} onImport={handleImport} importing={importing} />

      {confirmCities && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCities(null)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-base text-foreground mb-1">Add to your trip?</h2>
            <p className="font-body text-[13px] text-muted-foreground mb-4">
              The import found {confirmCities.cities.length === 1 ? "a new city" : "new cities"} not yet on your trip. Uncheck any that were just a layover, not a real stop.
            </p>
            <div className="space-y-2 mb-4">
              {confirmCities.cities.map((city) => (
                <label key={city} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmCities.checked.has(city)}
                    onChange={(e) => {
                      const next = new Set(confirmCities.checked);
                      if (e.target.checked) next.add(city); else next.delete(city);
                      setConfirmCities({ ...confirmCities, checked: next });
                    }}
                    className="w-4 h-4 accent-foreground"
                  />
                  <span className="font-body text-sm text-foreground">{city}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const toAdd = confirmCities.cities.filter((c) => confirmCities.checked.has(c));
                  if (toAdd.length > 0) {
                    try {
                      const updatedTrip = await base44.entities.Trip.update(trip.id, { cities: [...(trip.cities || []), ...toAdd] });
                      onUpdate(updatedTrip);
                    } catch {}
                  }
                  setConfirmCities(null);
                }}
                className="flex-1 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
              >
                Confirm
              </button>
              <button onClick={() => setConfirmCities(null)} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity add/edit modal */}
      <ActivityModal
        open={activityModal.open}
        initialActivity={activityModal.activity}
        tripLocations={tripLocations}
        trip={trip}
        dayLabel={activityModal.dayIndex !== null ? (day?.date ? format(parseISO(day.date), "EEE, MMM d") : `Day ${day?.day}`) : null}
        onSave={saveActivity}
        onClose={() => setActivityModal({ open: false, dayIndex: null, actIndex: null, activity: null })}
      />

      {/* Day edit modal */}
      {dayEdit.open && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })}
        >
          <div
            className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full max-w-md shadow-editorial flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="font-heading text-lg text-foreground">{dayEdit.index === null ? "Add day" : "Edit day"}</h2>
              <button onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
                <DateInput
                  value={dayEdit.date}
                  onChange={(e) => setDayEdit((s) => ({ ...s, date: e.target.value }))}
                  className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Day title</label>
                <input
                  value={dayEdit.title}
                  onChange={(e) => setDayEdit((s) => ({ ...s, title: e.target.value }))}
                  placeholder="e.g. Explore old town"
                  className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm outline-none focus:border-ring transition-colors font-heading"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                <ReactQuill
                  value={dayEdit.description}
                  onChange={(v) => setDayEdit((s) => ({ ...s, description: v }))}
                  placeholder="Notes about this day…"
                  className="bg-muted rounded-lg quill-notes"
                  theme="snow"
                  modules={{ clipboard: { matchVisual: false } }}
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-3 border-t border-border">
              <button onClick={saveDayEdit} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-accent-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
                <Check className="w-4 h-4" /> Save
              </button>
              <button onClick={() => setDayEdit({ open: false, index: null, title: "", description: "", date: "" })} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WishListSection({ trip, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(trip.wish_list?.content || "");

  useEffect(() => { setContent(trip.wish_list?.content || ""); }, [trip.wish_list]);

  const save = async () => {
    const updated = await base44.entities.Trip.update(trip.id, { wish_list: { format: "rich_text", content } });
    onUpdate(updated);
    setEditing(false);
  };

  const clear = async () => {
    if (!confirm("Clear wish list?")) return;
    const updated = await base44.entities.Trip.update(trip.id, { wish_list: { format: "rich_text", content: "" } });
    setContent("");
    onUpdate(updated);
  };

  return (
    <div
      className={`bg-card border border-border rounded-2xl p-5 ${!editing ? "cursor-pointer hover:border-ring/50 transition-colors" : ""}`}
      onClick={!editing ? () => setEditing(true) : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-base text-foreground flex items-center gap-2">
          <Star className="w-4 h-4 text-accent" /> Wish List
        </h3>
        {!editing ? (
          <div className="flex items-center gap-1">
            {content && (
              <button onClick={(e) => { e.stopPropagation(); clear(); }} className="p-2 text-muted-foreground/30 hover:text-destructive transition-colors">
                <Trash className="w-4 h-4" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1 bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground text-xs px-2 transition-colors">Cancel</button>
          </div>
        )}
      </div>
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ReactQuill
            value={content}
            onChange={setContent}
            placeholder="Things you want to see, do, eat..."
            className="bg-muted rounded-lg quill-notes"
            theme="snow"
          />
        </div>
      ) : content ? (
        <div className="text-muted-foreground text-sm prose prose-sm max-w-none quill-render" dangerouslySetInnerHTML={{ __html: content }} />
      ) : (
        <p className="text-muted-foreground text-sm text-center py-4">No wish list yet</p>
      )}
    </div>
  );
}
