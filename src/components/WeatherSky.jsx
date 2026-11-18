// The top of the Daily welcome: today's weather drawn in the logo's sunrise style.
// Everything sits above the horizon line. Calm loops; still when "Reduce motion" is on.
const L = "#A7773F", INK = "#2E2A27", OLIVE = "#7D8A53", HY = 122;

const Horizon = () => (
  <>
    <line x1="20" y1={HY} x2="300" y2={HY} stroke={INK} strokeOpacity=".45" strokeWidth="1.5" />
    <line x1="90" y1={HY + 6} x2="230" y2={HY + 6} stroke={INK} strokeOpacity=".22" />
  </>
);

function Sun({ cx, cy, r, rays = true, dim = false }) {
  return (
    <g className="ws-rise" opacity={dim ? 0.55 : 1}>
      {rays && (
        <g className="ws-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const rad = (a * Math.PI) / 180, r1 = r + 8, r2 = r + 18;
            return <line key={a} x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1} x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2} stroke={L} strokeWidth="3" strokeLinecap="round" opacity=".7" />;
          })}
        </g>
      )}
      <circle cx={cx} cy={cy} r={r} fill={L} opacity=".92" />
    </g>
  );
}

const Cloud = ({ x, y, s, slow, fill = "#fff" }) => (
  <g className={slow ? "ws-drift2" : "ws-drift"}>
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-34 10 a14 14 0 0 1 6-26 a20 20 0 0 1 38-6 a15 15 0 0 1 22 16 a11 11 0 0 1-2 16z" fill={fill} stroke={INK} strokeOpacity=".35" strokeWidth="1.4" />
    </g>
  </g>
);

const Drops = ({ n = 9, x0 = 118, x1 = 232, y = 70 }) => Array.from({ length: n }, (_, i) => {
  const x = x0 + ((x1 - x0) * i) / (n - 1);
  return <line key={i} className="ws-fall" style={{ animationDelay: `${(i * 0.23) % 1.3}s` }} x1={x} y1={y} x2={x - 3} y2={y + 8} stroke={OLIVE} strokeWidth="2" strokeLinecap="round" />;
});
const Flakes = ({ n = 8, x0 = 118, x1 = 230, y = 68 }) => Array.from({ length: n }, (_, i) => {
  const x = x0 + ((x1 - x0) * i) / (n - 1);
  return <circle key={i} className="ws-flake" style={{ animationDelay: `${(i * 0.5) % 3.2}s` }} cx={x} cy={y} r="2.4" fill="#fff" stroke={INK} strokeOpacity=".4" strokeWidth="1" />;
});

const Moon = () => (
  <>
    <g className="ws-rise"><circle cx="160" cy="60" r="24" fill={L} opacity=".92" /><circle cx="171" cy="52" r="22" fill="#F7F3EC" /></g>
    {[[100, 32], [226, 26], [250, 62], [80, 68], [205, 90], [128, 96]].map(([x, y], i) => (
      <circle key={i} className="ws-twinkle" style={{ animationDelay: `${i * 0.4}s` }} cx={x} cy={y} r="2" fill={L} />
    ))}
  </>
);

// kind: sun | sunCloud | cloud | fog | drizzle | rain | snow | storm; night switches clear skies to the moon.
export default function WeatherSky({ kind = "sun", night = false, part = "morning" }) {
  let scene;
  if (night && (kind === "sun" || kind === "sunCloud")) scene = <Moon />;
  else if (kind === "sunCloud") scene = <><Sun cx={145} cy={58} r={22} /><Cloud x={185} y={72} s={1} /></>;
  else if (kind === "cloud") scene = <><Sun cx={150} cy={56} r={20} rays={false} dim /><Cloud x={150} y={60} s={1.1} fill="#F7F3EC" /><Cloud x={205} y={70} s={0.8} slow /></>;
  else if (kind === "rain" || kind === "drizzle") scene = <><Sun cx={120} cy={44} r={16} rays={false} dim /><Cloud x={150} y={46} s={1.1} fill="#EFE8DC" /><Cloud x={205} y={54} s={0.8} slow fill="#F7F3EC" /><Drops n={kind === "drizzle" ? 5 : 9} /></>;
  else if (kind === "storm") scene = <><rect className="ws-flash" x="0" y="0" width="320" height={HY} fill="#F2E3C4" /><Cloud x={150} y={44} s={1.15} fill="#E6DDCD" /><Cloud x={208} y={52} s={0.85} slow fill="#EFE8DC" /><Drops n={8} x0={122} x1={228} /><path className="ws-flash" d="M168 62 l-9 16 h8 l-6 14" fill="none" stroke={L} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></>;
  else if (kind === "snow") scene = <><Cloud x={160} y={46} s={1.15} /><Flakes /></>;
  else if (kind === "fog") scene = <><Sun cx={160} cy={62} r={22} rays={false} dim />{[54, 70, 86, 102].map((y, i) => <line key={y} className="ws-haze" style={{ animationDelay: `${i * 0.8}s` }} x1={70 + i * 8} y1={y} x2={250 - i * 8} y2={y} stroke={INK} strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />)}</>;
  else scene = part === "afternoon" ? <Sun cx={160} cy={52} r={24} /> : <Sun cx={160} cy={70} r={26} />;

  return (
    <svg viewBox="0 0 320 130" width="100%" height="130" aria-hidden="true">
      <style>{`
        @keyframes wsSpin{to{transform:rotate(360deg)}}
        @keyframes wsDrift{0%,100%{transform:translateX(-10px)}50%{transform:translateX(12px)}}
        @keyframes wsDrift2{0%,100%{transform:translateX(8px)}50%{transform:translateX(-10px)}}
        @keyframes wsFall{0%{transform:translateY(-4px);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateY(26px);opacity:0}}
        @keyframes wsFlake{0%{transform:translate(0,-4px);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translate(6px,28px);opacity:0}}
        @keyframes wsFlash{0%,88%,100%{opacity:0}90%{opacity:.55}93%{opacity:0}95%{opacity:.35}}
        @keyframes wsHaze{0%,100%{opacity:.25;transform:translateX(-6px)}50%{opacity:.7;transform:translateX(6px)}}
        @keyframes wsTwinkle{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wsRise{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
        .ws-spin{animation:wsSpin 24s linear infinite}.ws-drift{animation:wsDrift 9s ease-in-out infinite}.ws-drift2{animation:wsDrift2 11s ease-in-out infinite}
        .ws-fall{animation:wsFall 1.3s linear infinite}.ws-flake{animation:wsFlake 3.2s linear infinite}.ws-flash{animation:wsFlash 5s linear infinite}
        .ws-haze{animation:wsHaze 6s ease-in-out infinite}.ws-twinkle{animation:wsTwinkle 2.4s ease-in-out infinite}.ws-rise{animation:wsRise 1s cubic-bezier(.16,1,.3,1) both}
        @media (prefers-reduced-motion: reduce){.ws-spin,.ws-drift,.ws-drift2,.ws-fall,.ws-flake,.ws-flash,.ws-haze,.ws-twinkle,.ws-rise{animation:none}}
      `}</style>
      {scene}
      <Horizon />
    </svg>
  );
}
