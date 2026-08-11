import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getModule } from "@/lib/homeModules";
import { relativeTime } from "@/lib/homeData";

const MODULE_PATH = {
  travel: "/travel", finance: "/finance", goals: "/goals",
  business: "/business", projects: "/projects", notes: "/notes",
  career: "/career", tasks: "/goals",
};

const GLYPH = {
  travel: "✈", finance: "💰", goals: "🎯", business: "💼",
  notes: "📝", projects: "◎", career: "💻", tasks: "✓",
};

export default function RecentActivity({ items }) {
  const shown = items.slice(0, 6);
  const hasMore = items.length > 6;

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-heading text-lg text-foreground font-semibold">Recent Updates</h2>
        {hasMore && (
          <Link to="/notes" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="py-6 text-center">
          <p className="font-body text-[13px] text-muted-foreground">You haven’t made any updates this week.</p>
          <p className="font-body text-[11px] text-muted-foreground/70 mt-2 max-w-[280px] mx-auto leading-relaxed">
            Complete a task, add a note, update a budget, or plan a trip to start building your timeline.
          </p>
        </div>
      ) : (
        <div>
          {shown.map((it, i) => {
            const mod = getModule(it.module);
            return (
              <Link
                key={it.id}
                to={MODULE_PATH[it.module] || "/"}
                className={`flex items-center gap-2.5 py-2 ${i !== 0 ? "border-t border-border/30" : ""} hover:bg-secondary/40 -mx-1 px-1 rounded-lg transition-colors`}
              >
                <span
                  className="text-[15px] leading-none flex-shrink-0 w-5 text-center"
                  style={{ color: mod.color }}
                >
                  {GLYPH[it.module] || "·"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] text-foreground truncate leading-tight">{it.name}</p>
                  <p className="font-body text-[10px] text-muted-foreground mt-0.5 truncate">
                    {it.action} • {relativeTime(it.ts)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}