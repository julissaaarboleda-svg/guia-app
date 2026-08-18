import { Edit2, Trash2, MapPin, ExternalLink, Bookmark } from "lucide-react";
import { getActivityType, formatTime } from "./activityTypes";

export default function TimelineCard({ activity, onEdit, onDelete, onAddToMemories, isLast }) {
  const { Icon, color, key } = getActivityType(activity);
  const time = activity.time ? formatTime(activity.time) : null;
  const isFlight = key === "flight";

  // When this item was added from a Saved/Top Picks place, it should carry
  // a real photo — show that instead of the generic type icon, matching the
  // same "real photos, never fake ones" rule used everywhere else in Guía.
  const savedImage = activity.image_url || activity.photo_url || activity.image || null;

  return (
    <div className="relative flex gap-3">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ backgroundColor: savedImage ? undefined : `${color}1A` }}
        >
          {savedImage ? (
            <img src={savedImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-4 h-4" strokeWidth={1.8} style={{ color }} />
          )}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
      </div>

      {/* Card */}
      <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-4"}`}>
        <div className="bg-card border border-border rounded-xl p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div onClick={onEdit} role="button" tabIndex={0} className="flex-1 min-w-0 text-left cursor-pointer">
              {time && (
                <p className="font-body text-[11px] text-muted-foreground mb-0.5">{time}</p>
              )}
              <p className="font-body text-[14px] font-semibold text-foreground leading-tight">
                {activity.activity || "Untitled item"}
              </p>
              {isFlight ? (
                <>
                  {activity.location && (
                    <p className="font-body text-[13px] text-foreground/90 font-medium mt-0.5 truncate">
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
                        className="font-body text-[13px] text-info font-medium mt-0.5 truncate hover:underline inline-flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{activity.name}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="font-body text-[13px] text-foreground/85 font-medium mt-0.5 truncate">
                        {activity.name}
                      </p>
                    )
                  )}
                  {activity.location && (
                    <p className="font-body text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1">
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
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <button
                onClick={onEdit}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit item"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {onAddToMemories && (
                <button
                  onClick={onAddToMemories}
                  className="p-1 text-muted-foreground/70 hover:text-accent transition-colors"
                  aria-label="Save to memories"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onDelete}
                className="p-1 text-muted-foreground/60 hover:text-destructive transition-colors"
                aria-label="Delete item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
