import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const SHADES = [
  "hsl(var(--foreground))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];
const UNALLOCATED_COLOR = "hsl(var(--muted))";

export default function BudgetChart({ buckets, income = 0 }) {
  const grouped = {};
  buckets.forEach(b => {
    const key = b.category?.trim() || b.name || "Other";
    grouped[key] = (grouped[key] || 0) + (b.allocated_amount || 0);
  });

  const data = Object.entries(grouped)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalAllocated = data.reduce((s, d) => s + d.value, 0);
  const unallocated = income > 0 ? Math.max(0, income - totalAllocated) : 0;
  const base = income > 0 ? income : totalAllocated;

  const chartData = income > 0 && unallocated > 0
    ? [...data, { name: "Unallocated", value: unallocated }]
    : data;

  if (chartData.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-0.5">Where your money goes</p>
        <p className="font-heading text-lg text-foreground">
          {fmt(totalAllocated)}
          {income > 0 && <span className="text-muted-foreground text-sm font-body"> of {fmt(income)}</span>}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:w-44 sm:flex-shrink-0">
          <ResponsiveContainer width="100%" height={176}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2} stroke="none">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.name === "Unallocated" ? UNALLOCATED_COLOR : SHADES[i % SHADES.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: "12px", color: "hsl(var(--foreground))" }}
                formatter={(v, n) => [fmt(v), n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-heading text-base text-foreground">{income > 0 ? Math.round((totalAllocated / income) * 100) : 100}%</span>
            <span className="text-[10px] text-muted-foreground">{income > 0 ? "allocated" : "of budget"}</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-1.5">
          {data.map((d, i) => {
            const pct = base > 0 ? Math.round((d.value / base) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SHADES[i % SHADES.length] }} />
                <span className="text-foreground flex-1 truncate">{d.name}</span>
                <span className="text-muted-foreground">{pct}%</span>
                <span className="text-muted-foreground w-14 text-right">{fmt(d.value)}</span>
              </div>
            );
          })}
          {unallocated > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: UNALLOCATED_COLOR }} />
              <span className="text-muted-foreground flex-1">Unallocated</span>
              <span className="text-muted-foreground">{Math.round((unallocated / income) * 100)}%</span>
              <span className="text-muted-foreground w-14 text-right">{fmt(unallocated)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}