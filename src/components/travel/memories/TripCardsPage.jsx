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

function RouteArt({ points, loading }) {
  const W = 300, H = 210, P = 34;
  if (loading || points.length === 0) {
    return (
      <div style={{ flex: 1, background: "#EAE3D5", borderRadius: "0.5em", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="font-body" style={{ fontSize: "0.7em", color: MUTED }}>{loading ? "Drawing your route…" : "Couldn't place your cities."}</span>
      </div>
    );
  }
  const midLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * k);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.4), spanY = Math.max(maxY - minY, 0.4);
  const scale = Math.min((W - 2 * P) / spanX, (H - 2 * P) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const pts = points.map((p, i) => ({ name: p.name, x: offX + (xs[i] - minX) * scale, y: offY + (ys[i] - minY) * scale }));
  return (
    <div style={{ flex: 1, minHeight: 0, background: "#EAE3D5", borderRadius: "0.5em", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={BROWN} strokeWidth="2" strokeDasharray="5 4" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill={BROWN} />
            <text x={Math.min(Math.max(p.x, 36), W - 36)} y={p.y - 10} fontSize="12" textAnchor="middle" fill={INK} fontFamily="Playfair Display, Georgia, serif">{p.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CardView({ w, kind, data, img, logo }) {
  const year = data.year;
  const kicker = { trip: "THE TRIP", route: "THE ROUTE", cities: "THE CITIES", moments: "THE MOMENTS" }[kind];
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
      {kind === "route" && <RouteArt points={data.points} loading={data.loading} />}
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
      list.push({ kind: "route", chip: "Route", data: { year, lead: `${NUMBER_WORDS[cities.length] || cities.length} cities,`, accent: "one trip.", points, loading: routeLoading,
        note: points.length >= 2 ? `About ${Math.round(points.slice(1).reduce((s, p, i) => s + haversineKm(points[i], p), 0)).toLocaleString()} km from first stop to last.` : cities.join(" → ") } });
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

    if (media.length > 0 || quote) {
      const photos = media.slice(0, 3).map((m) => m.url);
      const note = quote ? `${quote.label ? `${quote.label}: ` : ""}“${quote.text}”` : `${media.length} photo${media.length !== 1 ? "s" : ""}${places.length ? `, ${places.length} place${places.length !== 1 ? "s" : ""} saved` : ""}.`;
      list.push({ kind: "moments", chip: "Moments", data: { year, lead: "What stayed", accent: "with you.", photos, note } });
    }
    return list;
  }, [trip, year, days, cities, cover, points, routeLoading, cityDays, itinerary, media, places.length, quote]);

  const imageUrls = useMemo(() => {
    const urls = new Set();
    if (cover) urls.add(cover);
    media.slice(0, 3).forEach((m) => urls.add(m.url));
    return [...urls];
  }, [cover, media]);

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
    for (let t = 0; t < 40 && routeLoadingRef.current; t += 1) await new Promise((r) => setTimeout(r, 250));
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
