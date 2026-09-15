import { useState } from "react";
import { Edit2, Trash2, MapPin, ExternalLink, ArrowRight, StickyNote, Check, ChevronDown, ChevronUp } from "lucide-react";
import { getActivityType, formatTime } from "./activityTypes";

const DONE_COLOR = "#7D8A53";

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortLocation(str) {
  if (!str) return str;
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[0]}, ${parts[1]}`;
  return str;
}

// Universal Google Maps search link — on a phone with a maps app installed
// (Google Maps, or Apple Maps via iOS's own link handling) this opens
// directly in that app; otherwise it falls back to the browser. Works the
// same regardless of which maps app the person actually has.
function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Whether this activity is already behind us. A day entirely before today
// counts as fully past regardless of individual times; a day after today
// is never past. Only on today itself do individual activity times matter —
// compared against the real clock, not toggled by hand. Hotels are
// intentionally excluded upstream since a stay spans multiple days and
// doesn't reduce to one moment that "passes".
function isPastNow(dayDate, timeStr) {
  if (!dayDate) return false;
  const today = new Date();
  // toISOString() reports UTC, not local time — mismatched against the
  // local getHours()/getMinutes() below, this made "today" resolve to the
  // wrong calendar date depending on time of day and timezone offset,
  // which is why some items weren't striking through correctly.
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if (dayDate < todayStr) return true;
  if (dayDate > todayStr) return false;
  if (!timeStr) return false;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h)) return false;
  const nowMins = today.getHours() * 60 + today.getMinutes();
  return h * 60 + (m || 0) < nowMins;
}

export default function TimelineCard({ activity, onEdit, onDelete, onAddToMemories, isLast, dayDate }) {
  const { Icon, color, key } = getActivityType(activity);
  const typeLabel = { flight: "Flight", hotel: "Stay", restaurant: "Restaurant", activity: "Activity", note: "Note" }[key] || "Activity";
  const savedImage = activity.image_url || activity.photo_url || activity.image || null;

  const depTime = activity.departure?.time ? formatTime(activity.departure.time) : null;
  const arrTime = activity.arrival?.time ? formatTime(activity.arrival.time) : null;
  const depCode = activity.departure?.airportCode;
  const arrCode = activity.arrival?.airportCode;
  const arrDate = activity.arrival?.date ? fmtDate(activity.arrival.date) : null;

  const checkInTime = activity.checkIn?.time ? formatTime(activity.checkIn.time) : null;
  const checkOutTime = activity.checkOut?.time ? formatTime(activity.checkOut.time) : null;
  const checkOutDate = activity.checkOut?.date ? fmtDate(activity.checkOut.date) : null;

  const simpleTime = activity.time ? formatTime(activity.time) : null;

  // Flights: "past" once landed (arrival time), falling back to departure
  // if no arrival time was captured. Hotels never count as past here.
  const past = key === "hotel"
    ? false
    : key === "flight"
      ? isPastNow(dayDate, activity.arrival?.time || activity.departure?.time)
      : isPastNow(dayDate, activity.time);

  // Only restaurant/activity/note cards collapse — flights and hotels stay
  // fully expanded since their info is already compact and essential.
  // Every type is collapsible now — flights and hotels included. Each
  // type defines its own "core" (always visible) vs "extra" (behind the
  // expand toggle): for a flight, route + times are core and
  // airline/flight number is extra; for a hotel, name + check-in/out
  // times are core and location/address/link are extra; for the rest,
  // time + title is core and everything else is extra.
  const collapsible = true;
  const hasExtra = key === "flight"
    ? !!(activity.airline || activity.flightNumber)
    : key === "hotel"
      ? !!(activity.location || activity.address || activity.link)
      : !!(activity.location || activity.address || activity.link || activity.notes);
  const [expanded, setExpanded] = useState(false);
  const showExtra = !collapsible || expanded || !hasExtra;

  return (
    <div className="relative flex gap-2.5">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5"
          style={{ backgroundColor: past ? DONE_COLOR : (savedImage ? undefined : `${color}20`) }}
        >
          {past ? (
            <Check className="w-[13px] h-[13px] text-white" strokeWidth={2.2} />
          ) : savedImage ? (
            <img src={savedImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} style={{ color, lineHeight: 1 }} />
          )}
        </div>
        {!isLast && <div className="w-px flex-1 mt-1.5 border-l border-dotted border-accent/50" />}
      </div>

      <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-1.5"}`}>
        <div className={`bg-card border border-border rounded-xl px-3 py-2.5 transition-opacity ${past ? "opacity-55" : ""}`}>
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span
              className="inline-block font-body text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[1px] rounded flex-shrink-0"
              style={{ color, backgroundColor: `${color}18` }}
            >
              {typeLabel}
            </span>
            {collapsible && hasExtra && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* ---------------- FLIGHT ---------------- */}
          {key === "flight" && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activity.departure?.city && (
                  <span className={`font-body text-[13px] font-semibold text-foreground ${past ? "line-through" : ""}`}>
                    {shortLocation(activity.departure.city)}{depCode && <span className="font-body text-[11px] text-muted-foreground font-normal ml-1">{depCode}</span>}
                  </span>
                )}
                {activity.departure?.city && activity.arrival?.city && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                )}
                {activity.arrival?.city && (
                  <span className={`font-body text-[13px] font-semibold text-foreground ${past ? "line-through" : ""}`}>
                    {shortLocation(activity.arrival.city)}{arrCode && <span className="font-body text-[11px] text-muted-foreground font-normal ml-1">{arrCode}</span>}
                  </span>
                )}
              </div>
              {(depTime || arrTime) && (
                <div className="flex items-center gap-3 font-body text-[11px] text-muted-foreground mt-1">
                  {depTime && <span>Depart <span className="text-accent font-semibold">{depTime}</span></span>}
                  {arrTime && <span>Arrive <span className="text-accent font-semibold">{arrTime}</span>{arrDate && ` · ${arrDate}`}</span>}
                </div>
              )}
              {showExtra && (activity.airline || activity.flightNumber) && (
                <div className="font-body text-[11px] text-muted-foreground/80 mt-1.5 pt-1.5 border-t border-border/60">
                  {[activity.airline, activity.flightNumber].filter(Boolean).join(" · ")}
                </div>
              )}
            </>
          )}

          {/* ---------------- STAY ---------------- */}
          {key === "hotel" && (
            <>
              {activity.name && (
                <p className="font-body text-[13px] font-semibold leading-snug truncate text-foreground">
                  {activity.name}
                </p>
              )}
              {(checkInTime || checkOutTime) && (
                <div className="flex items-center gap-3 font-body text-[11px] text-muted-foreground mt-1">
                  {checkInTime && <span>Check in <span className="text-accent font-semibold">{checkInTime}</span></span>}
                  {checkOutTime && <span>Check out <span className="text-accent font-semibold">{checkOutTime}</span>{checkOutDate && ` · ${checkOutDate}`}</span>}
                </div>
              )}
              {showExtra && activity.location && (
                <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 truncate">{activity.location}</p>
              )}
              {showExtra && activity.address && (
                <a
                  href={mapsUrl(activity.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-body text-[11px] text-muted-foreground/70 hover:text-accent mt-0.5 flex items-center gap-1 transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate underline decoration-dotted">{activity.address}</span>
                </a>
              )}
              {showExtra && activity.link && (
                <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="font-body text-[11px] text-info mt-1 inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{activity.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
            </>
          )}

          {/* ---------------- RESTAURANT / ACTIVITY / NOTE ---------------- */}
          {(key === "restaurant" || key === "activity" || key === "note") && (
            <>
              <div className="flex items-center gap-1.5">
                {simpleTime && <span className={`font-body text-[11px] text-accent font-semibold ${past ? "line-through" : ""}`}>{simpleTime}</span>}
                {activity.activity && <span className={`font-body text-[11px] text-muted-foreground/80 ${past ? "line-through" : ""}`}>{activity.activity}</span>}
              </div>
              {activity.name && (
                activity.link && showExtra ? (
                  <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="font-body text-[13px] font-semibold mt-1 truncate hover:underline inline-flex items-center gap-1 max-w-full text-foreground">
                    <span className={`truncate ${past ? "line-through" : ""}`}>{activity.name}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <p className={`font-body text-[13px] font-semibold leading-snug mt-1 truncate text-foreground ${past ? "line-through" : ""}`}>
                    {activity.name}
                  </p>
                )
              )}
              {showExtra && activity.location && (
                <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 truncate">{activity.location}</p>
              )}
              {showExtra && activity.address && (
                <a
                  href={mapsUrl(activity.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-body text-[11px] text-muted-foreground/70 hover:text-accent mt-0.5 flex items-center gap-1 transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate underline decoration-dotted">{activity.address}</span>
                </a>
              )}
              {showExtra && !activity.name && activity.link && (
                <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="font-body text-[12px] text-info mt-1 inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{activity.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
            </>
          )}

          {/* ---------------- NOTES (full text, every category) ---------------- */}
          {showExtra && activity.notes && (
            <div className="flex items-start gap-1.5 font-body text-[12px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/60 leading-snug">
              <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5 text-muted-foreground/60" />
              <span>{activity.notes}</span>
            </div>
          )}

          {/* ---------------- ACTIONS ---------------- */}
          <div className={`flex items-center justify-end gap-3 mt-2 pt-1.5 ${showExtra && activity.notes ? "" : "border-t border-border/60"}`}>
            <button
              onClick={onEdit}
              className="text-muted-foreground/70 hover:text-foreground transition-colors"
              aria-label="Edit item"
            >
              <Edit2 className="w-[15px] h-[15px]" strokeWidth={1.8} />
            </button>
            <button
              onClick={onDelete}
              className="text-muted-foreground/60 hover:text-destructive transition-colors"
              aria-label="Delete item"
            >
              <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
