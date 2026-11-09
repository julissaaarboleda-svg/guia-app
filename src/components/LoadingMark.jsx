// The Guía logo mark as the loading screen: the "G" holds still while the
// "GUIDED PATH · INTENTIONAL LIFE" ring turns slowly around it.
export default function LoadingMark({ size = 150 }) {
  return (
    <div className="flex flex-col items-center" role="status" aria-label="Loading">
      <style>{`
        @keyframes guia-turn { to { transform: rotate(360deg); } }
        @keyframes guia-breathe { 0%,100% { opacity: .85; } 50% { opacity: 1; } }
        .guia-ring { transform-origin: 100px 100px; animation: guia-turn 18s linear infinite; }
        .guia-g { animation: guia-breathe 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .guia-ring, .guia-g { animation: none; } }
      `}</style>
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <path id="guia-circle" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
        </defs>
        <g className="guia-ring">
          <text fontFamily="Inter, sans-serif" fontSize="11.5" letterSpacing="4.6" fill="#B8A88F" fontWeight="500">
            <textPath href="#guia-circle" startOffset="0" textLength="446" lengthAdjust="spacing">GUIDED PATH  ·  INTENTIONAL LIFE  ·  </textPath>
          </text>
        </g>
        <g className="guia-g">
          <text x="100" y="121" textAnchor="middle" fontFamily="'Playfair Display', serif" fontSize="62" fill="#2E2A27">G</text>
          <line x1="104" y1="70" x2="112" y2="60" stroke="#2E2A27" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
