import { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import AdjustableImage from "@/components/ui/AdjustableImage";
import ImageAdjuster from "@/components/ui/ImageAdjuster";
import { ShieldCheck, Move, Camera, ChevronDown, Target, FileText, Briefcase, CreditCard, Plane, FolderOpen, CheckCircle, X, LogOut, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SectionOrderEditor from "@/components/settings/SectionOrderEditor";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import PlanUsage from "@/components/settings/PlanUsage";
import CalendarSync from "@/components/settings/CalendarSync";
import { Link } from "react-router-dom";
import { DEFAULT_SECTION_ORDER, normalizeSections, normalizeOrder } from "@/lib/navSections";

const ALL_SECTIONS = [
  { id: "tasks",    label: "Tasks",    icon: CheckCircle, description: "Daily to-dos and reminders" },
  { id: "goals",    label: "Goals",    icon: Target, description: "Long-term goals and milestones" },
  { id: "work",     label: "Work",     icon: Briefcase, description: "Career and business, together" },
  { id: "finance",  label: "Finance",  icon: CreditCard, description: "Credit, savings, loans, subscriptions, budget" },
  { id: "travel",   label: "Journeys", icon: Plane, description: "Trips and itineraries" },
  { id: "projects", label: "Projects", icon: FolderOpen, description: "Personal projects and phases" },
  { id: "notes",    label: "Notes",    icon: FileText, description: "Free-form writing and logs" },
];

// Brand palette: Charcoal, Clay, Olive, Dusty Mauve, Warm Grey
const AVATAR_COLORS = [
  { hex: "#1F1F1F", label: "Charcoal" },
  { hex: "#A7773F", label: "Clay" },
  { hex: "#5A6F45", label: "Olive" },
  { hex: "#A77C81", label: "Dusty mauve" },
  { hex: "#6B655D", label: "Warm grey" },
];
const DEFAULT_ORDER = DEFAULT_SECTION_ORDER;
const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-[#A7773F] transition-colors font-body";

function Switch({ on }) {
  return (
    <span className="relative w-10 h-6 rounded-full flex-shrink-0 transition-colors" style={{ backgroundColor: on ? "#A7773F" : "#E7D9C6" }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all" style={{ left: on ? "18px" : "2px" }} />
    </span>
  );
}

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [word, setWord] = useState("");
  const [intention, setIntention] = useState("");
  const [avatarColor, setAvatarColor] = useState("#1F1F1F");
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarPhoto, setAvatarPhoto] = useState(null);
  const [adjustingAvatar, setAdjustingAvatar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_ORDER);
  const [showOrderEditor, setShowOrderEditor] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [initial, setInitial] = useState(null);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const snapshot = (n, t, w, i, sel, ord) => JSON.stringify([n, t, w, i, [...sel].sort(), ord]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !prefs?.id) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAvatarPhoto(file_url);
      await ent.UserPreferences.update(prefs.id, { avatar_url: file_url, avatar_pos: null });
      setPrefs(prev => ({ ...prev, avatar_url: file_url, avatar_pos: null }));
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't upload that photo — try again", variant: "destructive" });
    }
    setUploadingPhoto(false);
  };

  const removePhoto = async () => {
    if (!prefs?.id) return;
    try {
      await ent.UserPreferences.update(prefs.id, { avatar_url: null });
      setAvatarPhoto(null);
      setPrefs(prev => ({ ...prev, avatar_url: null }));
      toast({ title: "Photo removed — using your color" });
    } catch (err) {
      toast({ title: "Couldn't remove photo — try again", variant: "destructive" });
    }
  };

  const pickColor = async (hex) => {
    setAvatarColor(hex);
    if (!prefs?.id) {
      toast({ title: "Still loading your profile — try again in a moment", variant: "destructive" });
      return;
    }
    try {
      await ent.UserPreferences.update(prefs.id, { avatar_color: hex });
      setPrefs(prev => ({ ...prev, avatar_color: hex }));
      toast({ title: "Avatar color updated" });
    } catch (err) {
      console.error("Avatar color save failed", err);
      toast({ title: "Couldn't save color — please try again", variant: "destructive" });
    }
  };

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setEmail(u.email || "");
      setUserId(u.id || "");
      const p = await ent.UserPreferences.filter({ user_email: u.email });
      const pref = p[0] || null;
      const n = pref?.display_name || (u.full_name && u.full_name !== u.email ? u.full_name : "") || "";
      const t = pref?.tagline || "";
      const w = pref?.monthly_word || "";
      const i = pref?.monthly_intention || "";
      const sel = new Set(normalizeSections(pref?.enabled_sections || []));
      const ord = normalizeOrder(pref?.section_order);
      setPrefs(pref);
      setName(n); setTagline(t); setWord(w); setIntention(i);
      setAvatarColor(pref?.avatar_color || "#1F1F1F");
      setSelected(sel);
      setAvatarPhoto(pref?.avatar_url || null);
      setSectionOrder(ord);
      setInitial(snapshot(n, t, w, i, sel, ord));
    };
    load();
  }, []);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dirty = useMemo(
    () => initial !== null && snapshot(name, tagline, word, intention, selected, sectionOrder) !== initial,
    [initial, name, tagline, word, intention, selected, sectionOrder]
  );

  // Keep the name people see on shared projects in step with this one.
  const syncNameToProjects = async (newName) => {
    const key = (email || "").toLowerCase();
    if (!key || !newName) return;
    try {
      const projects = await ent.Project.list("-created_date");
      await Promise.all(
        projects
          .filter((pr) => pr.created_by_id === userId || (pr.collaborators || []).some((c) => String(c).toLowerCase() === key))
          .filter((pr) => (pr.collaborator_names || {})[key] !== newName)
          .map((pr) => ent.Project.update(pr.id, { collaborator_names: { ...(pr.collaborator_names || {}), [key]: newName } }))
      );
    } catch (err) {
      console.error("Name sync skipped:", err);
    }
  };

  const save = async () => {
    setSaving(true);
    const data = {
      display_name: name.trim(),
      tagline,
      monthly_word: word,
      monthly_intention: intention,
      avatar_color: avatarColor,
      enabled_sections: Array.from(selected),
      section_order: sectionOrder,
    };
    try {
      const navChanged = initial !== null && JSON.stringify([[...selected].sort(), sectionOrder]) !== JSON.stringify([JSON.parse(initial)[4], JSON.parse(initial)[5]]);
      if (prefs?.id) {
        await ent.UserPreferences.update(prefs.id, data);
      } else {
        const created = await ent.UserPreferences.create({ user_email: email, ...data });
        setPrefs(created);
      }
      await syncNameToProjects(name.trim());
      setInitial(snapshot(name, tagline, word, intention, selected, sectionOrder));
      if (navChanged) {
        // The menu is built at load time, so changing sections needs a refresh.
        toast({ title: "Saved — refreshing your menu…" });
        setTimeout(() => window.location.reload(), 600);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      console.error(err);
      toast({ title: "Couldn't save — please try again", variant: "destructive" });
    }
    setSaving(false);
  };

  const initials = (name || email || "G").trim().slice(0, 2).toUpperCase();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pb-40 md:pb-28">
      <h1 className="font-heading text-[30px] leading-tight text-foreground font-bold mb-0.5">Settings</h1>
      <p className="font-heading italic text-[15px] text-muted-foreground mb-8">Make Guía yours.</p>

      {/* Account */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-5">
        <h2 className="font-heading text-lg text-foreground mb-4">Account</h2>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-semibold overflow-hidden"
              style={{ backgroundColor: avatarColor }}>
              {avatarPhoto ? <AdjustableImage src={avatarPhoto} pos={prefs?.avatar_pos} alt="avatar" /> : initials}
            </div>
            <button onClick={() => fileRef.current.click()} disabled={uploadingPhoto} aria-label="Change photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#A7773F] text-white rounded-full flex items-center justify-center disabled:opacity-50">
              <Camera className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={handlePhoto} />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-[17px] text-foreground truncate">{name || "Your name"}</p>
            <p className="text-[13px] text-muted-foreground break-all">{email || "…"}</p>
            <span className="inline-block mt-1.5 text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#E4E9D5", color: "#566033" }}>Signed in</span>
          </div>
        </div>

        {!avatarPhoto ? (
          <div className="flex items-center gap-2.5 mt-4">
            <span className="text-xs text-muted-foreground mr-1">Color</span>
            {AVATAR_COLORS.map(c => (
              <button key={c.hex} onClick={() => pickColor(c.hex)} aria-label={c.label}
                className={`w-7 h-7 rounded-full transition-all ${avatarColor === c.hex ? "ring-2 ring-offset-2 ring-[#A7773F]" : "hover:scale-105"}`}
                style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        ) : (
          <>
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => setAdjustingAvatar(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#A7773F] font-body w-fit">
              <Move className="w-3 h-3" strokeWidth={1.5} /> Adjust photo
            </button>
            <button onClick={removePhoto} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-body w-fit">
              <X className="w-3 h-3" strokeWidth={1.5} /> Remove photo
            </button>
          </div>
          <ImageAdjuster open={adjustingAvatar} src={avatarPhoto} pos={prefs?.avatar_pos} aspect={1} round title="Adjust profile photo" onClose={() => setAdjustingAvatar(false)}
            onSave={async (p) => { setPrefs(prev => ({ ...prev, avatar_pos: p })); try { await ent.UserPreferences.update(prefs.id, { avatar_pos: p }); } catch (e) { console.error(e); } }} />
          </>
        )}

        <div className="space-y-3 mt-5">
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">Name <span className="opacity-70">· shown to people you share projects with</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">Role / note (optional)</label>
            <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Designer, Founder, Student" className={FIELD} />
          </div>
        </div>

        <button onClick={() => base44.auth.logout()}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border" style={{ color: "#8F6368", borderColor: "#A77C81" }}>
          <LogOut className="w-4 h-4" strokeWidth={1.5} /> Sign out
        </button>
      </section>

      {/* Your words */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-5">
        <h2 className="font-heading text-lg text-foreground mb-1">Your words</h2>
        <p className="text-xs text-muted-foreground font-body mb-4">Update this each month — takes 10 seconds.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">{new Date().getFullYear()} word or phrase</label>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. Consistency" className={FIELD} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">This month's intention</label>
            <input value={intention} onChange={e => setIntention(e.target.value)} placeholder="e.g. Show up every day" className={FIELD} />
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-5">
        <h2 className="font-heading text-lg text-foreground mb-1">Sections</h2>
        <p className="text-xs text-muted-foreground font-body mb-2">Turn off what you don't use.</p>
        <div>
          {ALL_SECTIONS.map((sec, i) => {
            const on = selected.has(sec.id);
            const Icon = sec.icon;
            return (
              <button key={sec.id} onClick={() => toggle(sec.id)} role="switch" aria-checked={on}
                className={`w-full flex items-center gap-3 py-3 text-left ${i ? "border-t border-border/60" : ""}`}>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: on ? "#A7773F" : "#9B948A" }} strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground">{sec.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{sec.description}</p>
                </div>
                <Switch on={on} />
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/60 mt-1 pt-3">
          <button onClick={() => setShowOrderEditor(!showOrderEditor)} className="w-full flex items-center justify-between text-left">
            <span className="text-sm font-body text-foreground">Menu order <span className="text-xs text-muted-foreground">(desktop sidebar)</span></span>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#A7773F" }}>
              {showOrderEditor ? "Hide" : "Customize"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOrderEditor ? "rotate-180" : ""}`} strokeWidth={1.5} />
            </span>
          </button>
          {showOrderEditor && (
            <div className="mt-3">
              <SectionOrderEditor enabledSections={Array.from(selected)} sectionOrder={sectionOrder} onReorder={setSectionOrder} />
            </div>
          )}
        </div>
      </section>

      <div className="mb-6"><PlanUsage /></div>
      <div className="mb-6"><CalendarSync /></div>

      {/* About */}
      <section className="bg-card border border-border rounded-2xl p-5 mb-6">
        <h2 className="font-heading text-lg text-foreground mb-1">About</h2>
        <Link to="/backup" className="w-full flex items-center justify-between py-3 text-left border-b border-border/60">
          <span className="flex items-center gap-3 text-sm font-body text-foreground"><ShieldCheck className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} /> Backup & export</span>
          <span className="text-muted-foreground">›</span>
        </Link>
        <button onClick={() => setShowFeedback(true)} className="w-full flex items-center justify-between py-3 text-left">
          <span className="flex items-center gap-3 text-sm font-body text-foreground"><MessageSquare className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.5} /> Send feedback</span>
          <span className="text-muted-foreground">›</span>
        </button>
        <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-3">Guía · Clarity to navigate. Freedom to be you.</p>
      </section>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {/* Pinned save bar — only appears once something has changed */}
      {(dirty || saved) && (
        <div className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-8 md:w-72 z-40">
          <button onClick={save} disabled={saving || saved}
            className="w-full py-3 rounded-2xl font-body text-sm font-medium text-[#F7F3EC] shadow-lg disabled:opacity-90"
            style={{ backgroundColor: saved ? "#5A6F45" : "#A7773F", boxShadow: "0 8px 22px rgba(167,119,63,0.33)" }}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
