import { CheckCircle, Plane, Wallet, Target } from "lucide-react";

export default function QuickGlance({ taskCount, tripDays, savings, goalCount }) {
  const pills = [
    { Icon: CheckCircle, label: "Tasks", value: taskCount != null ? `${taskCount}` : "0", color: "#6B7A5E", show: taskCount != null && taskCount > 0 },
    { Icon: Plane, label: tripDays === 1 ? "Day" : "Days", value: tripDays != null ? `${tripDays}` : null, color: "#3E5C76", show: tripDays != null },
    { Icon: Wallet, label: "Saved", value: savings != null ? `$${Number(savings).toLocaleString()}` : null, color: "#5B7A4F", show: savings != null && savings > 0 },
    { Icon: Target, label: goalCount === 1 ? "Active Goal" : "Active Goals", value: goalCount != null ? `${goalCount}` : null, color: "#7C6A52", show: goalCount != null && goalCount > 0 },
  ].filter((p) => p.show);

  if (!pills.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
      {pills.map((p, i) => {
        const Icon = p.Icon;
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-card pl-2.5 pr-3.5 py-1.5 flex-shrink-0"
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${p.color}14`, color: p.color }}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="font-heading text-sm text-foreground leading-none">{p.value}</span>
            <span className="font-body text-[11px] text-muted-foreground leading-none">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}