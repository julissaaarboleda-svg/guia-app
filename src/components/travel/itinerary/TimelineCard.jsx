import { Edit2, Trash2, MapPin, ExternalLink } from "lucide-react";
import { getActivityType, formatTime } from "./activityTypes";

export default function TimelineCard({ activity, onEdit, onDelete, onAddToMemories, isLast }) {
  const { Icon, color, key } = getActivityType(activity);
  const time = activity.time ? formatTime(activity.time) : null;
  const isFlight = key === "flight";
  const typeLabel = { flight: "Flight", hotel: "Stay", restaurant: "Restaurant", activity: "Activity", note: "Note" }[key] || "Activity";
  // Shows the real photo when this item is linked to a saved place with an
  // image, instead of the generic type icon — falls back gracefully if
  // none of these fields are present.
  const savedImage = activity.image_url || activity.photo_url || activity.image || null;

  return (
    <div className="relative flex gap-2.5">
      {/* Icon + connector line */}
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
        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
      </div>

      {/* Card */}
      <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-1.5"}`}>
        <div className="bg-card border border-border rounded-xl pl-3 pr-2.5 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div onClick={onEdit} role="button" tabIndex={0} className="flex-1 min-w-0 text-left cursor-pointer">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block font-body text-[9px] font-semibold tracking-wide uppercase px-1.5 py-[1px] rounded flex-shrink-0"
                  style={{ color, backgroundColor: `${color}18` }}
                >
                  {typeLabel}
                </span>
                {time && <span className="font-body text-[11px] text-muted-foreground">{time}</span>}
              </div>
              {isFlight ? (
                <>
                  {activity.location && (
                    <p className="font-body text-[13px] font-semibold leading-snug mt-1 truncate" style={{ color }}>
                      {activity.location}
                    </p>
                  )}
                  {activity.name && (
                    <p className="font-body text-[11px] text-muted-foreground mt-0.5 truncate">
                      {activity.name}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {activity.name && (
                    activity.link ? (
                      <a
                        href={activity.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="font-body text-[13px] font-semibold mt-1 truncate hover:underline inline-flex items-center gap-1 max-w-full"
                        style={{ color }}
                      >
                        <span className="truncate">{activity.name}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="font-body text-[13px] font-semibold leading-snug mt-1 truncate" style={{ color }}>
                        {activity.name}
                      </p>
                    )
                  )}
                  {activity.location && (
                    <p className="font-body text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span className="truncate">{activity.location}</span>
                    </p>
                  )}
                </>
              )}
              {activity.address && (
                <p className="font-body text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{activity.address}</span>
                </p>
              )}
              {!activity.name && activity.link && (
                <a
                  href={activity.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-body text-[12px] text-info mt-1 inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[180px]">{activity.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                </a>
              )}
              {activity.notes && (
                <p className="font-body text-[12px] text-muted-foreground mt-1.5 line-clamp-2 leading-snug">
                  {activity.notes}
                </p>
              )}
            </div>
            <div className="flex items-start gap-2.5 flex-shrink-0 pt-0.5">
              <button
                onClick={onEdit}
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
                aria-label="Edit item"
              >
                <Edit2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
              <button
                onClick={onDelete}
                className="text-muted-foreground/60 hover:text-destructive transition-colors"
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
