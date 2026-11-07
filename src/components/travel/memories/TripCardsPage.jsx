import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { pickCoverImage, visibleMedia, visiblePlaces, tripDuration } from "@/lib/memoryUtils";
import { geocodeCity } from "./TripRouteMap";

const BROWN = "#A7773F";
const INK = "#2E2A27";
const MUTED = "#7A736A";
const PANEL = "#EFEBE3";
const BAR_COLORS = ["#4A503D", "#7D8A53", "#C98B6B", BROWN, "#8A6B4F", "#D9C7A3"];
const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

const SIZES = {
  story: { label: "Story size", frameW: 300, frameH: 533, cardW: 260 },
  post: { label: "Post size", frameW: 300, frameH: 375, cardW: 232 },
  card: { label: "Card only", frameW: 300, frameH: null, cardW: 300 },
};
const GAP = 12;

const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, "").trim();

function toDataUrl(url) {
  return fetch(url, { mode: "cors" })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("bad image"))))
    .then(
      (b) =>
        new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(b);
        })
    );
}

function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function rangeLabel(trip) {
  if (!trip.start_date) return "";
  const s = parseISO(trip.start_date);
  if (!trip.end_date) return format(s, "MMM d");
  const e = parseISO(trip.end_date);
  return s.getMonth() === e.getMonth() ? `${format(s, "MMM d")} – ${format(e, "d")}` : `${format(s, "MMM d")} – ${format(e, "MMM d")}`;
}

function shortQuote(text) {
  const t = text.replace(/\s+/g, " ");
  if (t.length <= 120) return t;
  const cut = t.slice(0, 117);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 117)}…`;
}

function Headline({ lead, accent }) {
  return (
    <p className="font-heading" style={{ fontSize: "1.9em", lineHeight: 1.05, margin: "0.25em 0 0.5em", fontWeight: 400, color: INK }}>
      {lead} <em style={{ color: BROWN }}>{accent}</em>
    </p>
  );
}

function Pill({ children }) {
  return (
    <div
      className="font-heading"
      style={{
        marginTop: "0.6em", background: PANEL, border: "1px solid #E1DACB", borderRadius: "0.6em",
        padding: "0.55em 0.7em", fontStyle: "italic", fontSize: "0.82em", lineHeight: 1.35, color: INK,
      }}
    >
      {children}
    </div>
  );
}

const TILE = 256;
const worldXY = (lat, lon, z) => {
  const n = TILE * 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
};

function RouteArt({ points, loading, pendingRef }) {
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const map = useMemo(() => {
    if (loading || points.length === 0 || !box.w || !box.h) return null;
    const P = 44;
    let z = 12;
    for (; z > 2; z -= 1) {
      const w = points.map((p) => worldXY(p.lat, p.lon, z));
      const sx = Math.max(...w.map((q) => q.x)) - Math.min(...w.map((q) => q.x));
      const sy = Math.max(...w.map((q) => q.y)) - Math.min(...w.map((q) => q.y));
      if (sx <= box.w - 2 * P && sy <= box.h - 2 * P) break;
    }
    const w = points.map((p) => worldXY(p.lat, p.lon, z));
    const cx = (Math.max(...w.map((q) => q.x)) + Math.min(...w.map((q) => q.x))) / 2;
    const cy = (Math.max(...w.map((q) => q.y)) + Math.min(...w.map((q) => q.y))) / 2;
    const tlx = cx - box.w / 2;
    const tly = cy - box.h / 2;
    const max = 2 ** z;
    const tiles = [];
    for (let ty = Math.floor(tly / TILE); ty <= Math.floor((tly + box.h) / TILE); ty += 1) {
      for (let tx = Math.floor(tlx / TILE); tx <= Math.floor((tlx + box.w) / TILE); tx += 1) {
        if (ty < 0 || ty >= max) continue;
        const wx = ((tx % max) + max) % max;
        tiles.push({ key: `${z}/${tx}/${ty}`, url: `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/${z}/${wx}/${ty}@2x.png`, left: tx * TILE - tlx, top: ty * TILE - tly });
      }
    }
    const pts = points.map((p, i) => ({ name: p.name, x: w[i].x - tlx, y: w[i].y - tly }));
    return { tiles, pts };
  }, [points, loading, box.w, box.h]);

  useEffect(() => {
    if (pendingRef) pendingRef.current = map ? map.tiles.length : 0;
  }, [map, pendingRef]);

  const done = () => { if (pendingRef && pendingRef.current > 0) pendingRef.current -= 1; };

  return (
    <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: "relative", background: "#EAE3D5", borderRadius: "0.5em", overflow: "hidden" }}>
      {!map && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="font-body" style={{ fontSize: "0.7em", color: MUTED }}>{loading ? "Drawing your route…" : "Couldn't place your cities."}</span>
        </div>
      )}
      {map && (
        <>
          {map.tiles.map((t) => (
            <img key={t.key} src={t.url} crossOrigin="anonymous" alt="" onLoad={done} onError={done}
              style={{ position: "absolute", left: t.left, top: t.top, width: TILE, height: TILE, maxWidth: "none" }} />
          ))}
          <div style={{ position: "absolute", inset: 0, background: "rgba(244,234,214,0.28)" }} />
          <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} style={{ position: "absolute", left: 0, top: 0 }}>
            <polyline points={map.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={map.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={BROWN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" />
            {map.pts.map((p, i) => {
              const pw = p.name.length * 6.4 + 16;
              const lx = Math.min(Math.max(p.x - pw / 2, 4), box.w - pw - 4);
              const above = p.y > 40;
              const ly = above ? p.y - 34 : p.y + 12;
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="7" fill={BROWN} stroke="#fff" strokeWidth="2.5" />
                  <text x={p.x} y={p.y + 3.5} fontSize="9" textAnchor="middle" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">{i + 1}</text>
                  <rect x={lx} y={ly} width={pw} height="22" rx="11" fill="#F9F8F6" stroke="#E1DACB" />
                  <text x={lx + pw / 2} y={ly + 15} fontSize="12" textAnchor="middle" fill={INK} fontFamily="Playfair Display, Georgia, serif">{p.name}</text>
                </g>
              );
            })}
          </svg>
          <span className="font-body" style={{ position: "absolute", right: 4, bottom: 3, fontSize: 7, color: "#5F5A52", background: "rgba(255,255,255,0.7)", padding: "1px 4px", borderRadius: 3 }}>© OpenStreetMap, CARTO</span>
        </>
      )}
    </div>
  );
}

function CardView({ w, kind, data, img, logo }) {
  const year = data.year;
  const kicker = { trip: "THE TRIP", places: "THE PLACES", route: "THE ROUTE", cities: "THE CITIES", moments: "THE MOMENTS" }[kind];
  return (
    <div
      style={{
        width: w, height: Math.round(w * 1.355), background: "#F9F8F6", borderRadius: "0.9em", padding: "1.3em",
        fontSize: w / 20, color: INK, display: "flex", flexDirection: "column", boxSizing: "border-box",
        border: "1px solid #E6DFD2",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "2em" }}>
        {logo ? <img src={logo} alt="Guía" style={{ height: "2em", width: "auto" }} /> : <span className="font-heading" style={{ fontSize: "1.1em" }}>Guía</span>}
        <span className="font-body" style={{ fontSize: "0.68em", letterSpacing: "0.18em", color: MUTED }}>{year}</span>
      </div>
      <p className="font-body" style={{ margin: "1.3em 0 0", fontSize: "0.62em", letterSpacing: "0.2em", color: MUTED }}>{kicker}</p>
      <Headline lead={data.lead} accent={data.accent} />

      {kind === "trip" && (
        <div style={{ flex: 1, minHeight: 0, borderRadius: "0.5em", background: img(data.cover) ? `url(${img(data.cover)}) center/cover no-repeat` : "#7D8A53" }} />
      )}
      {kind === "route" && <RouteArt points={data.points} loading={data.loading} pendingRef={data.pendingRef} />}
      {kind === "cities" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.9em" }}>
          {data.rows.map((r, i) => (
            <div key={r.city} style={{ display: "grid", gridTemplateColumns: "34% 1fr auto", alignItems: "center", columnGap: "0.6em" }}>
              <span className="font-heading" style={{ fontSize: "0.85em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.city}</span>
              <div style={{ height: "0.4em", background: "#E6DFD2", borderRadius: "0.2em" }}>
                <div style={{ width: `${Math.round((r.days / data.maxDays) * 100)}%`, height: "100%", background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: "0.2em" }} />
              </div>
              <span className="font-body" style={{ fontSize: "0.68em", color: MUTED, whiteSpace: "nowrap" }}>{r.days} day{r.days !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}
      {kind === "places" && (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gap: "0.25em",
          gridTemplateColumns: data.places.length === 1 ? "1fr" : "1fr 1fr",
          gridTemplateRows: data.places.length > 2 ? "1fr 1fr" : "1fr" }}>
          {data.places.map((p, i) => (
            <div key={i} style={{ position: "relative", overflow: "hidden", borderRadius: "0.4em", background: p.image ? `url(${img(p.image)}) center/cover no-repeat` : "#7D8A53" }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", padding: "0.3em 0.5em" }}>
                <span className="font-body" style={{ fontSize: "0.65em", color: "#fff", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {kind === "moments" && (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gap: "0.25em",
          gridTemplateColumns: data.photos.length >= 2 ? "2fr 1fr" : "1fr",
          gridTemplateRows: data.photos.length >= 3 ? "1fr 1fr" : "1fr" }}>
          {data.photos.map((url, i) => (
            <div key={i} style={{ borderRadius: "0.4em", background: `url(${img(url)}) center/cover no-repeat`, gridRow: i === 0 && data.photos.length >= 3 ? "1 / span 2" : undefined }} />
          ))}
        </div>
      )}
      <Pill>{data.note}</Pill>
    </div>
  );
}

export default function TripCardsPage({ trip, onBack }) {
  const [size, setSize] = useState("story");
  const [active, setActive] = useState(0);
  const [images, setImages] = useState({});
  const [logo, setLogo] = useState(null);
  const [points, setPoints] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const frameRefs = useRef([]);
  const routeLoadingRef = useRef(false);
  const tilesPendingRef = useRef(0);

  const year = trip.start_date ? parseISO(trip.start_date).getFullYear() : new Date().getFullYear();
  const days = tripDuration(trip);
  const itinerary = trip.itinerary || [];
  const media = visibleMedia(trip).filter((m) => m.type === "photo" && m.url);
  const places = visiblePlaces(trip);

  const cityDays = useMemo(() => {
    const order = [];
    const counts = {};
    itinerary.forEach((d) => {
      if (!d.city) return;
      if (!counts[d.city]) { counts[d.city] = 0; order.push(d.city); }
      counts[d.city] += 1;
    });
    return order.map((city) => ({ city, days: counts[city] }));
  }, [itinerary]);

  const cities = useMemo(() => {
    if ((trip.cities || []).length) return trip.cities;
    return cityDays.map((c) => c.city);
  }, [trip.cities, cityDays]);

  const cover = trip.story_cover_url || pickCoverImage(trip);

  const quote = useMemo(() => {
    const notes = (trip.journal_entries || [])
      .map((n) => ({ ...n, text: stripHtml(n.note) }))
      .filter((n) => n.text)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (notes.length === 0) return null;
    const pick = notes.find((n) => n.text.length >= 20 && n.text.length <= 140) || notes[0];
    const dayEntry = itinerary.find((d) => d.date && d.date === pick.date);
    let dayNo = dayEntry?.day;
    if (!dayNo && pick.date && trip.start_date) dayNo = differenceInCalendarDays(parseISO(pick.date), parseISO(trip.start_date)) + 1;
    const label = [dayNo ? `Day ${dayNo}` : null, dayEntry?.city].filter(Boolean).join(", ");
    return { text: shortQuote(pick.text), label };
  }, [trip.journal_entries, itinerary, trip.start_date]);

  const cards = useMemo(() => {
    const list = [];
    const range = rangeLabel(trip);
    const words = (trip.title || "My trip").trim().split(/\s+/);
    const accentWord = `${words.pop()}.`;
    const cityCount = cities.length;
    const daysPart = days ? `${days} day${days !== 1 ? "s" : ""}` : null;
    const cityPart = cityCount > 0 ? `${cityCount} cit${cityCount !== 1 ? "ies" : "y"}` : null;
    const bigNote = [daysPart && cityPart ? `${daysPart} across ${cityPart}` : daysPart || cityPart, range].filter(Boolean).join(", ") || "A trip to remember.";
    list.push({ kind: "trip", chip: "Big picture", data: { year, lead: words.join(" "), accent: accentWord, cover, note: `${bigNote}.` } });

    if (cities.length >= 2) {
      list.push({ kind: "route", chip: "Route", data: { year, lead: `${NUMBER_WORDS[cities.length] || cities.length} cities,`, accent: "one trip.", points, loading: routeLoading, pendingRef: tilesPendingRef,
        note: points.length >= 2 ? `About ${Math.round(points.slice(1).reduce((s, p, i) => s + haversineKm(points[i], p), 0)).toLocaleString()} km between your stops.` : cities.join(" → ") } });
    }

    if (cityDays.length >= 2) {
      const rows = [...cityDays].sort((a, b) => b.days - a.days).slice(0, 5);
      const top = rows[0];
      const dayToCity = {};
      itinerary.forEach((d) => { if (d.date && d.city) dayToCity[d.date] = d.city; });
      const topPhotos = media.filter((m) => dayToCity[m.date] === top.city).length;
      list.push({ kind: "cities", chip: "Cities", data: { year, lead: "Where the", accent: "days went.", rows, maxDays: top.days,
        note: `Most time in ${top.city}${topPhotos ? `, with ${topPhotos} photo${topPhotos !== 1 ? "s" : ""}` : ""}.` } });
    }

    if (places.length > 0) {
      const ranked = [...places].sort((a, b) => Number(!!b.favorited) - Number(!!a.favorited)).slice(0, 4);
            list.push({ kind: "places", chip: "Places", data: { year, lead: "Places you", accent: "kept.", places: ranked,
        note: `${ranked[0].name}${ranked.length > 1 ? ` and ${places.length - 1} more saved` : ", saved from your trip"}.` } });
    }

    if (media.length > 0 || quote) {
      const photos = media.slice(0, 3).map((m) => m.url);
      const note = quote ? `${quote.label ? `${quote.label}: ` : ""}“${quote.text}”` : `${media.length} photo${media.length !== 1 ? "s" : ""}${places.length ? `, ${places.length} place${places.length !== 1 ? "s" : ""} saved` : ""}.`;
      list.push({ kind: "moments", chip: "Moments", data: { year, lead: "What stayed", accent: "with you.", photos, note } });
    }
    return list;
  }, [trip, year, days, cities, cover, points, routeLoading, cityDays, itinerary, media, places, quote]);

  const imageUrls = useMemo(() => {
    const urls = new Set();
    if (cover) urls.add(cover);
    media.slice(0, 3).forEach((m) => urls.add(m.url));
    places.slice(0, 8).forEach((p) => { if (p.image) urls.add(p.image); });
    return [...urls];
  }, [cover, media, places]);

  useEffect(() => {
    let alive = true;
    imageUrls.forEach((u) => {
      if (images[u]) return;
      toDataUrl(u).then((d) => { if (alive) setImages((prev) => ({ ...prev, [u]: d })); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [imageUrls.join("|")]);

  useEffect(() => {
    let alive = true;
    fetch("/guia-logo.svg")
      .then((r) => r.text())
      .then((svg) => {
        const cropped = svg.replace('width="1344" height="896"', 'width="1012" height="716" viewBox="172 72 1012 716"');
        if (alive) setLogo(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cropped)}`);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const cityKey = cities.join("|");
  useEffect(() => {
    if (cities.length < 2) return undefined;
    let alive = true;
    routeLoadingRef.current = true;
    setRouteLoading(true);
    (async () => {
      const found = [];
      for (const name of cities) {
        try {
          const p = await geocodeCity(name, trip.country);
          if (p) found.push({ name, lat: p.lat, lon: p.lon });
        } catch { /* skip city */ }
        await new Promise((r) => setTimeout(r, 250));
        if (!alive) return;
      }
      setPoints(found);
      routeLoadingRef.current = false;
      setRouteLoading(false);
    })();
    return () => { alive = false; };
  }, [cityKey, trip.country]);

  const img = useCallback((u) => (u ? images[u] || u : null), [images]);

  const spec = SIZES[size];
  const itemW = spec.frameW;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (itemW + GAP));
    setActive(Math.max(0, Math.min(cards.length - 1, i)));
  };

  const goTo = (i) => {
    setActive(i);
    scrollRef.current?.scrollTo({ left: i * (itemW + GAP), behavior: "smooth" });
  };

  const slug = (trip.title || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const render = async (i) => {
    for (let t = 0; t < 48 && (routeLoadingRef.current || tilesPendingRef.current > 0); t += 1) await new Promise((r) => setTimeout(r, 250));
    const { default: html2canvas } = await import("html2canvas");
    const el = frameRefs.current[i];
    const canvas = await html2canvas(el, { scale: 1080 / el.offsetWidth, useCORS: true, backgroundColor: null, logging: false });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return new File([blob], `${slug}-${cards[i].kind}-${size}.png`, { type: "image/png" });
  };

  const download = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const run = async (label, fn) => {
    if (busy) return;
    setBusy(true);
    setStatus(label);
    try {
      await fn();
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Trip card export failed:", err);
        setStatus("Couldn't create the image. Try again.");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
  };

  const saveOne = () => run("Saving…", async () => { download(await render(active)); setStatus("Saved"); });
  const saveAll = () => run("Saving…", async () => {
    const files = [];
    for (let i = 0; i < cards.length; i += 1) files.push(await render(i));
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title: trip.title });
    } else {
      for (const f of files) { download(f); await new Promise((r) => setTimeout(r, 400)); }
    }
    setStatus(`Saved ${files.length}`);
  });
  const shareOne = () => run("Preparing…", async () => {
    const file = await render(active);
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: trip.title });
      setStatus("");
    } else {
      download(file);
      setStatus("Sharing isn't available here, so the image was saved instead.");
    }
  });

  const chipCls = (on) =>
    `px-3.5 py-1.5 rounded-full text-xs font-body border transition-colors ${on ? "text-white border-transparent" : "bg-transparent text-muted-foreground border-border"}`;

  return (
    <div className="p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="text-center">
        <h2 className="font-heading text-lg text-foreground">Trip card preview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Swipe to pick a card. What you see is what gets saved.</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory -mx-4 py-1"
        style={{ gap: GAP, paddingLeft: `calc(50% - ${itemW / 2}px)`, paddingRight: `calc(50% - ${itemW / 2}px)`, scrollbarWidth: "none" }}
      >
        {cards.map((c, i) => (
          <div key={`${c.kind}-${size}`} className="snap-center flex-shrink-0" style={{ width: itemW }}>
            <div
              ref={(el) => { frameRefs.current[i] = el; }}
              style={{
                width: itemW, height: spec.frameH || undefined, background: spec.frameH ? PANEL : "transparent",
                borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              }}
            >
              <CardView w={spec.cardW} kind={c.kind} data={c.data} img={img} logo={logo} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {cards.map((c, i) => (
          <button key={c.kind} onClick={() => goTo(i)} className={chipCls(active === i)} style={active === i ? { background: BROWN } : undefined}>
            {c.chip}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {Object.entries(SIZES).map(([key, s]) => (
          <button key={key} onClick={() => setSize(key)} className={chipCls(size === key)} style={size === key ? { background: BROWN } : undefined}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-center text-muted-foreground">Story size fits Stories. Post size fits Instagram posts and carousels (4:5). Neither needs resizing.</p>

      <div className="flex gap-2">
        <button onClick={saveOne} disabled={busy} className="flex-[1.3] py-2.5 rounded-full text-sm font-body text-white disabled:opacity-60" style={{ background: BROWN }}>Save this card</button>
        <button onClick={saveAll} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-body border disabled:opacity-60" style={{ borderColor: BROWN, color: BROWN }}>Save all {cards.length}</button>
        <button onClick={shareOne} disabled={busy} className="flex-1 py-2.5 rounded-full text-sm font-body border disabled:opacity-60" style={{ borderColor: BROWN, color: BROWN }}>Share…</button>
      </div>
      <p className="text-[11px] text-center text-muted-foreground min-h-[1em]">{status || "Drawn on your device from your own trip. Nothing is uploaded."}</p>
    </div>
  );
}
