import { Sun, Cloud, CloudRain, CloudSun, CloudSnow, Wind, Droplets, ExternalLink } from "lucide-react";

function WeatherIcon({ condition }) {
  const c = (condition || "").toLowerCase();
  const color = "#555B40";
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (/thunder|rain|shower|drizzle/.test(c)) return <CloudRain className={cls} style={{ color }} />;
  if (/snow/.test(c)) return <CloudSnow className={cls} style={{ color }} />;
  if (/partly|mostly cloudy|overcast/.test(c)) return <CloudSun className={cls} style={{ color }} />;
  if (/cloud/.test(c)) return <Cloud className={cls} style={{ color }} />;
  if (/fog|mist|haze/.test(c)) return <Droplets className={cls} style={{ color }} />;
  if (/wind/.test(c)) return <Wind className={cls} style={{ color }} />;
  return <Sun className={cls} style={{ color }} />;
}

export default function WeatherSummary({ cities, loading, forecastUrl }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-heading text-[14px] font-medium text-foreground">Weather by city</h3>
        {forecastUrl && (
          <a
            href={forecastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-body text-[11px] text-accent hover:underline transition-colors"
          >
            View full forecast <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      {loading ? (
        <div className="flex gap-2">
          {(cities.length ? cities : [0, 1, 2, 3, 4]).map((c, i) => (
            <div key={i} className="flex-1 h-[52px] bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : cities.length === 0 ? (
        <p className="font-body text-[12px] text-muted-foreground py-4 text-center">
          Add destinations to see the weather forecast.
        </p>
      ) : (
        <div className="flex gap-2">
          {cities.map((c, i) => (
            <div key={i} className="flex-1 min-w-0 flex flex-col items-center text-center gap-1 py-1 pb-2">
              <p className="font-heading text-[11px] font-semibold text-foreground leading-tight line-clamp-2 min-h-[28px] flex items-center">{c.city}</p>
              <div className="flex items-center gap-1">
                <WeatherIcon condition={c.condition} />
                {c.high != null && c.low != null ? (
                  <span className="font-body text-[11px] text-foreground whitespace-nowrap">{c.low}–{c.high}°</span>
                ) : (
                  <span className="font-body text-[11px] text-muted-foreground">—</span>
                )}
              </div>
              {c.condition && (
                <p className="font-body text-[10px] text-muted-foreground leading-tight line-clamp-2 min-h-[24px] w-full">{c.condition}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}