// Non-destructive photo framing. A position is { x, y, z }: the focal point (0–100%)
// and zoom (1–3). The original file is never changed, so every place that shows the
// photo (cards, banners, lists) can frame it the same way at its own shape.
export const DEFAULT_POS = { x: 50, y: 50, z: 1 };

export function normPos(p) {
  if (!p || typeof p !== "object") return DEFAULT_POS;
  const n = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
  return { x: n(p.x, 50, 0, 100), y: n(p.y, 50, 0, 100), z: n(p.z, 1, 1, 3) };
}

export function posStyle(p) {
  const { x, y, z } = normPos(p);
  const s = { objectPosition: `${x}% ${y}%` };
  if (z !== 1) { s.transform = `scale(${z})`; s.transformOrigin = `${x}% ${y}%`; }
  return s;
}
