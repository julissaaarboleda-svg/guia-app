import { useEffect } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import Career from "@/pages/Career";
import Business from "@/pages/Business";

const KEY = "guia:work-tab";

// "Work" groups Career and Business under one menu item. /career and /business still work.
export default function Work() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const tab = pathname.startsWith("/business") ? "business" : pathname.startsWith("/career") ? "career" : null;

  useEffect(() => { if (tab) { try { localStorage.setItem(KEY, tab); } catch { /* optional */ } } }, [tab]);

  if (!tab) {
    let last = "career";
    try { last = localStorage.getItem(KEY) === "business" ? "business" : "career"; } catch { /* optional */ }
    return <Navigate to={`/${last}${search}`} replace />;
  }

  const switcher = (
    <div className="inline-flex bg-secondary rounded-full p-[3px]" role="tablist" aria-label="Work">
      {[["career", "Career"], ["business", "Business"]].map(([k, l]) => (
        <button key={k} role="tab" aria-selected={tab === k} onClick={() => k !== tab && navigate(`/${k}`)}
          className={`px-5 py-1.5 rounded-full text-[13px] transition-colors ${tab === k ? "bg-card text-foreground font-medium shadow-sm" : "text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
  return tab === "business" ? <Business switcher={switcher} /> : <Career switcher={switcher} />;
}
