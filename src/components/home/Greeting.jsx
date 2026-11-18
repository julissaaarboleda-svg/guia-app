import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Target, Plane, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudLightning, Moon } from "lucide-react";
import { getWeather, describeWx, hourLabel } from "@/lib/welcome";

const WX_ICON = { sun: Sun, sunCloud: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, storm: CloudLightning };
const WET = ["rain", "drizzle", "storm", "snow"];

// Small weather pill at the end of the status line. Hidden until a city is set.
function WeatherPill({ place }) {
  const [wx, setWx] = useState(null);
  useEffect(() => {
    let alive = true;
    if (place) getWeather(place).then((w) => { if (alive) setWx(w); }).catch(() => {});
    else setWx(null);
    return () => { alive = false; };
  }, [place?.lat, place?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!wx || Number.isNaN(wx.temp)) return null;
  const w = describeWx(wx.code);
  const Icon = !wx.isDay && w.icon === "sun" ? Moon : WX_ICON[w.icon] || Sun;
  const rainSoon = wx.rainFrom != null && wx.rainFrom > new Date().getHours();
  const wet = rainSoon || WET.includes(w.icon);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-[1px] rounded-full flex-shrink-0 ${wet ? "bg-[#A77C8118] text-[#8F5F65]" : "bg-[#A7773F14] text-[#8A5F2F]"}`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
      {wx.temp}°{rainSoon ? ` · rain at ${hourLabel(wx.rainFrom)}` : ""}
    </span>
  );
}

// Stays pinned under the header while Home scrolls, and gets more compact once pinned.
export default function Greeting({ dateStr, greeting, firstName, status, place }) {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = el.closest("main") || null;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { root, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px -mb-px" />
      <div
        className={`sticky top-0 z-[25] bg-background -mx-6 px-6 md:-mx-10 md:px-10 lg:-mx-12 lg:px-12 transition-[padding] duration-200 ${stuck ? "py-2 border-b border-border/50" : "py-0 border-b border-transparent"}`}
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className={`font-body text-muted-foreground text-[10px] tracking-[0.22em] uppercase ${stuck ? "mb-0.5" : "mb-2"}`}>{dateStr}</p>
          <h1 className={`font-heading text-foreground font-semibold leading-tight truncate transition-[font-size] duration-200 ${stuck ? "text-[1.1rem]" : "text-[1.5rem] sm:text-[1.75rem]"}`}>
            {greeting}, {firstName}.
          </h1>
          {status || place ? (
            <p className={`font-body text-[13px] text-muted-foreground/90 font-normal leading-snug flex items-center gap-1.5 min-w-0 ${stuck ? "mt-0.5" : "mt-2"}`}>
              {status ? <>
                {status.startsWith("✈") ? <Plane className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} /> : <Target className="w-3.5 h-3.5 flex-shrink-0 text-[#A7773F]" strokeWidth={1.5} />}
                <span className="truncate min-w-0">{status.replace(/^[^\p{L}\p{N}]+/u, "")}</span>
              </> : null}
              <WeatherPill place={place} />
            </p>
          ) : null}
        </motion.div>
      </div>
    </>
  );
}
