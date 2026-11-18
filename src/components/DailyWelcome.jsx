import { useEffect, useRef, useState } from "react";
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudLightning, Moon, Target, Flame, Receipt, Plane, Wind, Volume2 } from "lucide-react";
import { ent } from "@/lib/freshEntities";
import { dayKey } from "@/lib/routines";
import { SEEN_KEY, CHIMES_KEY, partOfDay, getWeather, describeWx, dayLines, thoughtFor, weatherTip, weatherPhrase } from "@/lib/welcome";
import WeatherSky from "@/components/WeatherSky";

const WX_ICON = { sun: Sun, sunCloud: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: Snowflake, storm: CloudLightning };
const LINE_ICON = { target: Target, flame: Flame, bill: Receipt, trip: Plane };
const TONE = { cognac: ["#A7773F14", "#A7773F"], mauve: ["#A77C8118", "#8F5F65"], olive: ["#7D8A5318", "#566033"] };
const safe = async (p) => { try { return (await p) || []; } catch { return []; } };

// Breathing: in 4, hold 4, out 6, five rounds.
const PHASES = [["Breathe in", 4, 1, 528], ["Hold", 4, 1, 0], ["Breathe out", 6, 0, 396]];
// Ripple rings in the brand colors: base radius 14, each ring spreads further on the breath in.
const RINGS = [["#A7773F", 0.75], ["#7D8A53", 0.6], ["#A77C81", 0.45], ["#A7773F", 0.3]];
const ROUNDS = 5;

function Sky({ part }) {
  if (part === "evening") {
    return (
      <svg viewBox="0 0 320 90" width="100%" height="90" aria-hidden="true">
        <g className="dw-rise">
          <circle cx="160" cy="48" r="26" fill="#A7773F" opacity="0.9" />
          <circle cx="172" cy="40" r="24" fill="#F7F3EC" />
          {[[96, 30], [226, 24], [250, 56], [72, 60], [200, 70]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#A7773F" opacity="0.6" />)}
        </g>
        <line x1="20" y1="89" x2="300" y2="89" stroke="#D9CFBF" />
      </svg>
    );
  }
  const high = part === "afternoon";
  const cy = high ? 52 : 90, r = high ? 26 : 36;
  const rays = high
    ? [[160, 14, 160, 4], [128, 26, 120, 18], [192, 26, 200, 18], [118, 52, 106, 52], [202, 52, 214, 52], [128, 78, 120, 86], [192, 78, 200, 86]]
    : [[160, 44, 160, 30], [126, 57, 116, 47], [194, 57, 204, 47], [106, 82, 92, 78], [214, 82, 228, 78]];
  return (
    <svg viewBox="0 0 320 90" width="100%" height="90" aria-hidden="true">
      <g className="dw-rise">
        <circle cx="160" cy={cy} r={r} fill="#A7773F" opacity="0.9" />
        <g stroke="#A7773F" strokeWidth="2.5" strokeLinecap="round" opacity="0.7">
          {rays.map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} />)}
        </g>
      </g>
      <line x1="20" y1="89" x2="300" y2="89" stroke="#D9CFBF" />
    </svg>
  );
}

export default function DailyWelcome({ user, prefs }) {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mode, setMode] = useState("welcome"); // welcome | breathe
  const [wx, setWx] = useState(null);
  const [lines, setLines] = useState(null);
  const [chimes, setChimes] = useState(() => { try { return localStorage.getItem(CHIMES_KEY) === "1"; } catch { return false; } });
  const [cue, setCue] = useState({ text: "Breathe in", count: 4, round: 1, scale: 0, dur: 0 });
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const chimesRef = useRef(chimes);
  chimesRef.current = chimes;

  const part = partOfDay();
  const [freshPlace, setFreshPlace] = useState(null);
  const place = freshPlace || prefs?.weather_place;

  // Decide whether to show today.
  useEffect(() => {
    if (!user) return;
    const open = (force) => {
      const today = dayKey(new Date());
      let seen = null;
      try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
      if (!force && (seen === today || prefs?.welcome_off)) return;
      try { localStorage.setItem(SEEN_KEY, today); } catch { /* ignore */ }
      // Settings may have just changed the city; read the latest saved copy.
      try { const raw = JSON.parse(localStorage.getItem("guia:nav-prefs") || "null"); if (raw?.weather_place) setFreshPlace(raw.weather_place); } catch { /* ignore */ }
      setMode("welcome"); setLeaving(false); setShow(true);
    };
    open(false);
    const onForce = () => open(true);
    window.addEventListener("guia:welcome-show", onForce);
    return () => window.removeEventListener("guia:welcome-show", onForce);
  }, [user, prefs?.welcome_off]);

  // Load the day once it's showing.
  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      const [tasks, routines, finItems, trips] = await Promise.all([safe(ent.Task.list()), safe(ent.Routine.list()), safe(ent.FinanceItem.list()), safe(ent.Trip.list())]);
      if (alive) setLines(dayLines({ tasks, routines, finItems, trips }));
    })();
    if (place) getWeather(place).then((w) => { if (alive) setWx(w); }).catch(() => {});
    return () => { alive = false; };
  }, [show, place]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const chime = (f) => {
    const ctx = ctxRef.current;
    if (!chimesRef.current || !ctx || !f) return;
    try {
      const t = ctx.currentTime;
      [f, f * 1.5].forEach((fr, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = fr;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(i ? 0.03 : 0.08, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 2.3);
      });
    } catch { /* sound is optional */ }
  };
  const wakeAudio = () => {
    try {
      if (!ctxRef.current) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctxRef.current = new AC(); }
      ctxRef.current?.resume?.();
    } catch { /* ignore */ }
  };

  const toggleChimes = () => {
    const next = !chimes;
    setChimes(next); chimesRef.current = next;
    try { localStorage.setItem(CHIMES_KEY, next ? "1" : "0"); } catch { /* ignore */ }
    if (next) { wakeAudio(); setTimeout(() => chime(660), 30); }
  };

  const close = () => {
    clearTimeout(timerRef.current);
    setLeaving(true);
    setTimeout(() => setShow(false), 500);
  };

  const breathe = () => {
    if (chimesRef.current) wakeAudio();
    setMode("breathe");
    let round = 1, ph = 0, left = PHASES[0][1];
    const step = () => {
      const [text, dur, scale, f] = PHASES[ph];
      if (left === dur) { setCue({ text, count: left, round, scale, dur }); chime(f); }
      else setCue((c) => ({ ...c, count: left }));
      left -= 1;
      if (left < 1) {
        ph += 1;
        if (ph >= PHASES.length) {
          ph = 0; round += 1;
          if (round > ROUNDS) {
            timerRef.current = setTimeout(() => { setCue({ text: "Well done", count: "", round: 0, scale: 0.35, dur: 1.5 }); chime(660); timerRef.current = setTimeout(close, 1800); }, 1000);
            return;
          }
        }
        left = PHASES[ph][1];
      }
      timerRef.current = setTimeout(step, 1000);
    };
    setCue({ text: "Get comfortable", count: "", round: 1, scale: 0, dur: 0 });
    timerRef.current = setTimeout(step, 1200);
  };

  if (!show) return null;

  const first = (prefs?.display_name || user?.full_name || "").trim().split(/\s+/)[0];
  const greet = part === "morning" ? "Good morning" : part === "afternoon" ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const w = wx ? describeWx(wx.code) : null;
  const WxIcon = w ? (!wx.isDay && w.icon === "sun" ? Moon : WX_ICON[w.icon] || Cloud) : null;

  return (
    <div className={`fixed inset-0 z-[100] bg-[#F7F3EC] text-[#2E2A27] overflow-y-auto transition-all duration-500 ${leaving ? "opacity-0 -translate-y-6" : "opacity-100"}`}
      role="dialog" aria-label="Daily welcome">
      <style>{`
        @keyframes dwRise{from{transform:translateY(36px);opacity:0}to{transform:none;opacity:1}}
        @keyframes dwUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
        .dw-rise{animation:dwRise 1.2s cubic-bezier(.16,1,.3,1) both}
        .dw-a1{animation:dwUp .6s ease both .2s}.dw-a2{animation:dwUp .6s ease both .45s}.dw-a3{animation:dwUp .6s ease both .7s}.dw-a4{animation:dwUp .6s ease both .95s}
        @keyframes dwHold{0%,100%{filter:none}50%{filter:brightness(1.15)}}
        .dw-hold{animation:dwHold 1.4s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.dw-rise,.dw-a1,.dw-a2,.dw-a3,.dw-a4{animation:none}}
      `}</style>
      <div className="max-w-md mx-auto px-5 min-h-full flex flex-col" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        {mode === "welcome" ? (
          <>
            {wx && w ? <WeatherSky kind={w.icon} night={part === "evening" || !wx.isDay} part={part} /> : <Sky part={part} />}
            <p className="dw-a1 text-center text-[11px] tracking-[0.2em] text-[#7A716A] mt-2">{dateStr}</p>
            <h1 className="dw-a1 font-heading text-center text-[30px] leading-[1.15] mt-1">{greet}{first ? "," : ""}<br />{first}</h1>
            {wx && w ? (
              <div className="dw-a1 text-center mt-1.5 mb-4">
                <p className="text-[14px] text-[#2E2A27] flex items-center justify-center gap-1.5">
                  <WxIcon className="w-[17px] h-[17px] text-[#A7773F]" strokeWidth={1.75} />
                  {weatherPhrase(wx, w, part === "evening" || !wx.isDay)} · {part === "evening" ? `low ${wx.lo}°` : `high ${wx.hi}°`}
                </p>
                {weatherTip(wx, w.icon) && <p className="text-[12.5px] text-[#7A716A] mt-1">{weatherTip(wx, w.icon)}</p>}
              </div>
            ) : (
              <p className="dw-a1 text-center text-[13px] italic text-[#7A716A] mt-1 mb-4">Clarity to navigate. Freedom to be you.</p>
            )}

            {lines && lines.length > 0 && (
              <div className="dw-a3 bg-white border border-[#E8E0D2] rounded-2xl px-4 py-2.5 mb-2.5">
                <p className="text-[12px] text-[#A7773F] mb-0.5">Your day</p>
                {lines.map((l, i) => {
                  const Icon = LINE_ICON[l.icon] || Target;
                  const [bg, fg] = TONE[l.tone] || TONE.cognac;
                  return (
                    <div key={i} className={`flex items-center gap-2.5 py-1.5 text-[13px] ${i ? "border-t border-[#EFE8DC]" : ""}`}>
                      <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: bg, color: fg }}><Icon className="w-4 h-4" strokeWidth={1.75} /></span>
                      <span className="flex-1 min-w-0">{l.parts.map((p, j) => (typeof p === "string" ? <span key={j}>{p}</span> : <span key={j} className="font-medium">{p.b}</span>))}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="dw-a3 bg-white border border-[#7D8A53]/40 rounded-2xl px-4 py-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-[34px] h-[34px] rounded-full bg-[#7D8A53]/10 text-[#566033] flex items-center justify-center flex-shrink-0"><Wind className="w-[18px] h-[18px]" strokeWidth={1.75} /></span>
                <div className="flex-1 min-w-0"><p className="text-[14px]">Take a breath</p><p className="text-[12px] text-[#7A716A]">1 minute · calm start</p></div>
                <button type="button" onClick={breathe} className="text-[13px] rounded-full px-3.5 py-1.5 border border-[#7D8A53] text-[#566033]">Begin</button>
              </div>
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-[#EFE8DC]">
                <Volume2 className="w-4 h-4 text-[#7A716A]" strokeWidth={1.5} />
                <span className="flex-1 text-[12.5px] text-[#7A716A]">Soft chimes{chimes && <span className="block text-[11px]">Turn your ringer on to hear them</span>}</span>
                <button type="button" role="switch" aria-checked={chimes} aria-label="Soft chimes" onClick={toggleChimes}
                  className={`relative w-[38px] h-[22px] rounded-full transition-colors ${chimes ? "bg-[#A7773F]" : "bg-[#D9CFBF]"}`}>
                  <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all" style={{ left: chimes ? 18 : 2 }} />
                </button>
              </div>
            </div>

            <div className="dw-a4 text-center px-2 pt-2 pb-4">
              <p className="text-[10.5px] tracking-[0.14em] text-[#7A716A] mb-1">A THOUGHT FOR TODAY</p>
              <p className="font-heading italic text-[15px] leading-relaxed">{thoughtFor()}</p>
            </div>

            <div className="mt-auto">
              <button type="button" onClick={close} className="dw-a4 w-full h-12 rounded-2xl bg-[#2E2A27] text-[#F7F3EC] text-[15px]">Start my day</button>
              {!place && <p className="text-center text-[11.5px] text-[#7A716A] mt-2">Add your city in Settings to see the weather here.</p>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] tracking-[0.2em] text-[#7A716A] mb-4">TAKE A BREATH</p>
            <div className="relative w-[230px] h-[230px]" aria-hidden="true">
              {RINGS.map(([color, op], i) => {
                const full = 28 + i * 13; // radius at the top of the breath
                const r = 14 + cue.scale * (14 + i * 13);
                return (
                  <span key={i} className={`absolute rounded-full ${cue.text === "Hold" ? "dw-hold" : ""}`}
                    style={{
                      width: full * 3.4, height: full * 3.4, left: "50%", top: "50%", marginLeft: -full * 1.7, marginTop: -full * 1.7,
                      border: `${(1.5 * full) / r}px solid ${color}`,
                      transform: `scale(${r / full})`, opacity: op * (0.3 + cue.scale * 0.7),
                      transition: `transform ${cue.dur}s ease-in-out, opacity ${cue.dur}s ease-in-out, border-width ${cue.dur}s ease-in-out`,
                    }} />
                );
              })}
              <span className="absolute rounded-full bg-[#A7773F]"
                style={{ width: 50, height: 50, left: "50%", top: "50%", marginLeft: -25, marginTop: -25, transform: `scale(${(10 + cue.scale * 5) / 15})`, transition: `transform ${cue.dur}s ease-in-out` }} />
            </div>
            <p className="font-heading text-[26px] mt-6 mb-1" aria-live="polite">{cue.text}</p>
            <p className="text-[14px] text-[#7A716A] h-5">{cue.count}</p>
            <p className="text-[12px] text-[#7A716A] h-5 mb-8">{cue.round ? `Round ${cue.round} of ${ROUNDS}` : ""}</p>
            <button type="button" onClick={close} className="text-[13px] rounded-full px-5 py-2 border border-[#D9CFBF]">Skip</button>
          </div>
        )}
      </div>
    </div>
  );
}
