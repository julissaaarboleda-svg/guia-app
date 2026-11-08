import { useEffect, useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, ShieldCheck, RotateCcw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  downloadBackup, readBackupFile, restoreBackup, summarize, countOf, listAutoBackups, fetchAutoBackup,
  CSV_EXPORTS, downloadCsv,
} from "@/lib/backup";

const card = "bg-card border border-border rounded-2xl p-4 mb-3";
const btnSolid = "bg-[#A7773F] text-[#F7F3EC] rounded-full text-[13px] px-4 py-2 disabled:opacity-50";
const btnLine = "border border-[#A7773F] text-[#A7773F] rounded-full text-[13px] px-4 py-2 disabled:opacity-50";
const dayLabel = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Backup() {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null); // { ok, text }
  const [pending, setPending] = useState(null); // { name, data, exported_at }
  const [mode, setMode] = useState("merge");
  const [autos, setAutos] = useState([]);
  const fileRef = useRef(null);
  const lastDownload = (() => { try { return localStorage.getItem("guia:last-download"); } catch { return null; } })();

  const loadAutos = () => listAutoBackups().then(setAutos).catch(() => setAutos([]));
  useEffect(() => { loadAutos(); }, []);

  const run = async (key, fn) => {
    setBusy(key); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: e.message || "Something went wrong." }); }
    setBusy("");
  };

  const onDownload = () => run("dl", async () => {
    const b = await downloadBackup();
    setMsg({ ok: true, text: `Saved a backup of ${b.count} items to your device.` });
  });

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    run("read", async () => {
      const b = await readBackupFile(f);
      setPending({ name: f.name, data: b.data, exported_at: b.exported_at });
    });
  };

  const onPickAuto = (a) => run(`auto-${a.key}`, async () => {
    const b = await fetchAutoBackup(a.key);
    setPending({ name: `${a.kind === "before-restore" ? "Before last restore" : "Automatic backup"} · ${dayLabel(a.date)}`, data: b.data, exported_at: b.exported_at });
  });

  const onRestore = () => run("restore", async () => {
    const r = await restoreBackup(pending.data, mode);
    setPending(null);
    setMsg({ ok: true, text: `Restored ${r.restored} items${r.removed ? ` and removed ${r.removed} that weren't in the backup` : ""}. Reload the app to see everything.` });
    loadAutos();
  });

  const onCsv = (def) => run(`csv-${def.id}`, async () => {
    const n = await downloadCsv(def);
    setMsg({ ok: true, text: `Exported ${n} ${def.label.toLowerCase()} rows.` });
  });

  const weekly = autos.filter((a) => a.kind === "weekly");
  const before = autos.filter((a) => a.kind === "before-restore");

  return (
    <div className="pb-28">
      <PageHeader title="Backup" subtitle="Your data, always safe." />
      <div className="px-4 md:px-8 pt-5 max-w-2xl">
        {msg && (
          <div className={`rounded-xl px-4 py-3 mb-3 text-[13px] ${msg.ok ? "bg-[#E4E9D5] text-[#566033]" : "bg-[#F4E6E7] text-[#8F5F65]"}`}>{msg.text}</div>
        )}

        <div className={card}>
          <div className="flex items-center gap-2 mb-1.5"><Download className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h2 className="font-heading text-base text-foreground">Download a full backup</h2></div>
          <p className="text-[13px] text-muted-foreground leading-snug mb-3">One file with everything: goals, notes, projects, journeys, finance, career and settings. Keep it somewhere safe, like iCloud or Google Drive.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button className={btnSolid} disabled={!!busy} onClick={onDownload}>{busy === "dl" ? "Preparing…" : "Download backup"}</button>
            <span className="text-[12px] text-muted-foreground">{lastDownload ? `Last downloaded ${dayLabel(lastDownload)}` : "Not downloaded yet"}</span>
          </div>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-1.5"><Upload className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h2 className="font-heading text-base text-foreground">Restore from a backup</h2></div>
          <p className="text-[13px] text-muted-foreground leading-snug mb-3">Choose a backup file from your device. You'll see what's inside before anything changes.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPick} />
          <button className={btnLine} disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === "read" ? "Reading…" : "Choose backup file"}</button>

          {pending && (
            <div className="mt-4 rounded-xl border border-border bg-background p-3.5">
              <p className="text-[13px] text-foreground font-medium truncate">{pending.name}</p>
              <p className="text-[12px] text-muted-foreground mb-2">{pending.exported_at ? `Saved ${dayLabel(pending.exported_at)} · ` : ""}{countOf(pending.data)} items</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {summarize(pending.data).map((s) => (
                  <span key={s.key} className="text-[11px] px-2 py-0.5 rounded-full bg-[#ECE7DD] text-[#6B655D]">{s.n} {s.label}</span>
                ))}
              </div>
              <div className="space-y-2 mb-3">
                {[["merge", "Add to what's here", "Keeps everything you have now and brings back anything missing. Items with the same ID take the backup's version."],
                  ["replace", "Replace everything", "Makes your data match the backup exactly. Anything added since the backup is removed."]].map(([id, t, d]) => (
                  <label key={id} className={`flex gap-2.5 items-start rounded-lg border px-3 py-2 cursor-pointer ${mode === id ? "border-[#A7773F] bg-[#F3E8D6]/40" : "border-border"}`}>
                    <input type="radio" name="mode" checked={mode === id} onChange={() => setMode(id)} className="mt-1 accent-[#A7773F]" />
                    <span><span className="block text-[13px] text-foreground">{t}</span><span className="block text-[12px] text-muted-foreground leading-snug">{d}</span></span>
                  </label>
                ))}
              </div>
              <p className="text-[11.5px] text-muted-foreground mb-3">A copy of your current data is saved first, so this can be undone.</p>
              <div className="flex gap-2">
                <button className={btnSolid} disabled={!!busy} onClick={onRestore}>{busy === "restore" ? "Restoring…" : mode === "replace" ? "Replace my data" : "Restore"}</button>
                <button className="text-[13px] text-muted-foreground px-3" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-1.5"><ShieldCheck className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h2 className="font-heading text-base text-foreground">Automatic backups</h2></div>
          <p className="text-[13px] text-muted-foreground leading-snug mb-3">Guía saves a copy of your data about once a week in the background and keeps the last four. If something ever goes wrong, restore from here.</p>
          {weekly.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">The first one will be saved the next time you open the app.</p>
          ) : (
            <div className="divide-y divide-border">
              {weekly.map((a) => (
                <div key={a.key} className="flex items-center justify-between py-2">
                  <span className="text-[13px] text-foreground">{dayLabel(a.date)}</span>
                  <button className="text-[12.5px] text-[#A7773F]" disabled={!!busy} onClick={() => onPickAuto(a)}>{busy === `auto-${a.key}` ? "Loading…" : "Review & restore"}</button>
                </div>
              ))}
            </div>
          )}
          {before.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="lab text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1">Undo a restore</p>
              {before.slice(0, 2).map((a) => (
                <div key={a.key} className="flex items-center justify-between py-1.5">
                  <span className="text-[13px] text-foreground flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />Before restore · {dayLabel(a.date)}</span>
                  <button className="text-[12.5px] text-[#A7773F]" disabled={!!busy} onClick={() => onPickAuto(a)}>Review</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 mb-1.5"><FileSpreadsheet className="w-4 h-4 text-[#A7773F]" strokeWidth={1.5} /><h2 className="font-heading text-base text-foreground">Export to a spreadsheet</h2></div>
          <p className="text-[13px] text-muted-foreground leading-snug mb-2">CSV files open in Excel, Numbers and Google Sheets.</p>
          <div className="divide-y divide-border">
            {CSV_EXPORTS.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5">
                <div><p className="text-[14px] text-foreground">{d.label}</p><p className="text-[12px] text-muted-foreground">{d.hint}</p></div>
                <button className="text-[12.5px] text-[#A7773F]" disabled={!!busy} onClick={() => onCsv(d)}>{busy === `csv-${d.id}` ? "…" : "Export"}</button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground leading-snug px-1">Photos and files you've uploaded are saved as links inside the backup, so they come back as long as the originals are still stored.</p>
      </div>
    </div>
  );
}
