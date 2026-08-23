import { Edit2, Trash2, MapPin, ExternalLink, ArrowRight, StickyNote } from "lucide-react";
import { getActivityType, formatTime } from "./activityTypes";

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

export default function TimelineCard({ activity, onEdit, onDelete, onAddToMemories, isLast }) {
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

  return (
    <div className="relative flex gap-2.5">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5"
          style={{ backgroundColor: savedImage ? undefined : `${color}20` }}
        >
          {savedImage ? (
            <img src={savedImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} style={{ color, lineHeight: 1 }} />
          )}
        </div>
        {!isLast && <div className="w-px flex-1 mt-1.5 border-l border-dotted border-accent/50" />}
      </div>

      <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-1.5"}`}>
        <div className="bg-card border border-border rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="inline-block font-body text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[1px] rounded flex-shrink-0"
              style={{ color, backgroundColor: `${color}18` }}
            >
              {typeLabel}
            </span>
          </div>

          {/* ---------------- FLIGHT ---------------- */}
          {key === "flight" && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activity.departure?.city && (
                  <span className="font-body text-[13px] font-semibold text-foreground">
                    {shortLocation(activity.departure.city)}{depCode && <span className="font-body text-[11px] text-muted-foreground font-normal ml-1">{depCode}</span>}
                  </span>
                )}
                {activity.departure?.city && activity.arrival?.city && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                )}
                {activity.arrival?.city && (
                  <span className="font-body text-[13px] font-semibold text-foreground">
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
              {(activity.airline || activity.flightNumber) && (
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
              {activity.location && (
                <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 truncate">{activity.location}</p>
              )}
              {activity.address && (
                <p className="font-body text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{activity.address}</span>
                </p>
              )}
              {activity.link && (
                <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="font-body text-[11px] text-info mt-1 inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{activity.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
            </>
          )}

          {/* ---------------- RESTAURANT / ACTIVITY ---------------- */}
          {(key === "restaurant" || key === "activity" || key === "note") && (
            <>
              <div className="flex items-center gap-1.5">
                {simpleTime && <span className="font-body text-[11px] text-accent font-semibold">{simpleTime}</span>}
                {activity.activity && <span className="font-body text-[11px] text-muted-foreground/80">{activity.activity}</span>}
              </div>
              {activity.name && (
                activity.link ? (
                  <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="font-body text-[13px] font-semibold mt-1 truncate hover:underline inline-flex items-center gap-1 max-w-full text-foreground">
                    <span className="truncate">{activity.name}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <p className="font-body text-[13px] font-semibold leading-snug mt-1 truncate text-foreground">
                    {activity.name}
                  </p>
                )
              )}
              {activity.location && (
                <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 truncate">{activity.location}</p>
              )}
              {activity.address && (
                <p className="font-body text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{activity.address}</span>
                </p>
              )}
              {!activity.name && activity.link && (
                <a href={activity.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="font-body text-[12px] text-info mt-1 inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{activity.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
            </>
          )}

          {/* ---------------- NOTES (full text, every category) ---------------- */}
          {activity.notes && (
            <div className="flex items-start gap-1.5 font-body text-[12px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/60 leading-snug">
              <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5 text-muted-foreground/60" />
              <span>{activity.notes}</span>
            </div>
          )}

          {/* ---------------- ACTIONS ---------------- */}
          <div className={`flex items-center justify-end gap-3 mt-2 pt-1.5 ${activity.notes ? "" : "border-t border-border/60"}`}>
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
