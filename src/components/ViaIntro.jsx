import { useEffect } from "react";

// Onboarding.jsx flagged as due for a redesign (not a faithful port) per earlier
// conversation — this is a minimal pass-through, not real work, until that's revisited.
export default function ViaIntro({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 10);
    return () => clearTimeout(t);
  }, [onDone]);
  return null;
}
