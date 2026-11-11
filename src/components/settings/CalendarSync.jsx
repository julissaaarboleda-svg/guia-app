import { useEffect, useState } from "react";
import { authHeaders, API_BASE } from "@/api/base44Client";

const OPTIONS = [
  ["bills", "Bills and loan payments"],
  ["trips", "Trips"],
  ["tasks", "Tasks with a due date"],
  ["routines", "Routine reminders"],
  ["goals", "Goal target dates"],
];

async function call(action, include) {
  const res = await fetch(`${API_BASE}/calendar`, { method: "POST", headers: await authHeaders(), body: JSON.stringify({ action, include, tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })() }) });
  if (!res.ok) throw new Error("Couldn't load calendar sync.");
  return res.json();
}

// Settings card: a private calendar link (webcal) that Apple or Google Calendar subscribes to.
export default function CalendarSync() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { call("get").then(setData).catch((e) => setErr(e.message)); }, []);

  const host = window.location.host;
  const https = data ? `https://${host}/cal/${data.token}.ics` : "";
  const webcal = data ? `webcal://${host}/cal/${data.token}.ics` : "";
  const google = data ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` : "";

  const toggle = async (k) => {
    const include = { ...data.include, [k]: !data.include[k] };
    setData({ ...data, include });
    try { setData(await call("save", include)); } catch (e) { setErr(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(https); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const reset = async () => {
    setConfirmReset(false);
    try { setData(await call("reset")); } catch (e) { setErr(e.message); }
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-heading text-lg text-foreground mb-1">Calendar sync</h2>
      <p className="text-[13px] text-muted-foreground mb-3">Show your Guía dates in Apple or Google Calendar. It updates on its own; changes are made in Guía.</p>
      {err && <p className="text-[13px] text-[#8F5F65] mb-2">{err}</p>}
      {data && (
        <>
          <div className="divide-y divide-border/60 border border-border/60 rounded-xl mb-3">
            {OPTIONS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => toggle(k)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
                <span className="text-[14px] text-foreground">{label}</span>
                <span className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0" style={{ backgroundColor: data.include[k] ? "#A7773F" : "#E7D9C6" }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ left: data.include[k] ? "18px" : "2px" }} />
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <a href={webcal} className="bg-[#A7773F] text-[#F7F3EC] rounded-full px-4 py-2 text-[13px] font-medium">Add to Apple Calendar</a>
            <a href={google} target="_blank" rel="noopener noreferrer" className="bg-[#2E2A27] text-[#F7F3EC] rounded-full px-4 py-2 text-[13px] font-medium">Add to Google Calendar</a>
            <button type="button" onClick={copy} className="border border-border rounded-full px-4 py-2 text-[13px] text-foreground">{copied ? "Copied" : "Copy link"}</button>
          </div>
          <p className="text-[11.5px] text-muted-foreground break-all mb-1">{https}</p>
          <p className="text-[11.5px] text-muted-foreground">
            Anyone with this link can see these dates.{" "}
            {confirmReset
              ? <><button onClick={reset} className="text-[#8F5F65] underline">Reset now</button> (calendars using the old link stop updating) · <button onClick={() => setConfirmReset(false)} className="underline">Cancel</button></>
              : <button onClick={() => setConfirmReset(true)} className="underline">Reset link</button>}
          </p>
          <p className="text-[11.5px] text-muted-foreground mt-2">Apple Calendar refreshes about every hour. Google can take up to a day.</p>
        </>
      )}
    </section>
  );
}
