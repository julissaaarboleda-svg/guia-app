import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Check, Save, Camera, ChevronDown, Target, FileText, Briefcase, Building2, CreditCard, Plane, FolderOpen, CheckCircle, Sparkles, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import SectionOrderEditor from "@/components/settings/SectionOrderEditor";

const ALL_SECTIONS = [
  { id: "tasks",    label: "Tasks",    icon: CheckCircle, description: "Daily to-dos and reminders" },
  { id: "goals",    label: "Goals",    icon: Target, description: "Long-term goals and milestones" },
  { id: "career",   label: "Career",   icon: Briefcase, description: "Work, comp & growth" },
  { id: "business", label: "Business", icon: Building2, description: "Revenue, expenses, clients" },
  { id: "finance",  label: "Finance",  icon: CreditCard, description: "Credit, savings, loans, subscriptions, budget" },
  { id: "travel",   label: "Journeys", icon: Plane, description: "Trips and itineraries" },
  { id: "projects", label: "Projects", icon: FolderOpen, description: "Personal projects and phases" },
  { id: "notes",    label: "Notes",    icon: FileText, description: "Free-form writing and logs" },
  { id: "ai",       label: "AI Assistant", icon: Sparkles, description: "Ask about your finances" },
];

const AVATAR_COLORS = [
  { hex: "#1C1C1A", label: "Charcoal" },
  { hex: "#7C6A52", label: "Warm brown" },
  { hex: "#5B7FA6", label: "Blue" },
  { hex: "#6B7A5E", label: "Sage" },
  { hex: "#8B6A72", label: "Mauve" },
  { hex: "#6A6B8B", label: "Slate" },
];

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [word, setWord] = useState("");
  const [intention, setIntention] = useState("");
  const [avatarColor, setAvatarColor] = useState("#1C1C1A");
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [avatarPhoto, setAvatarPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sectionOrder, setSectionOrder] = useState([]);
  const [showOrderEditor, setShowOrderEditor] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !prefs?.id) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAvatarPhoto(file_url);
    await base44.entities.UserPreferences.update(prefs.id, { avatar_url: file_url });
    setUploadingPhoto(false);
  };

  const removePhoto = async () => {
    if (!prefs?.id) return;
    try {
      await base44.entities.UserPreferences.update(prefs.id, { avatar_url: null });
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
      await base44.entities.UserPreferences.update(prefs.id, { avatar_color: hex });
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
      const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
      if (p.length > 0) {
        const pref = p[0];
        setPrefs(pref);
        setName(pref.display_name || u.full_name || "");
        setTagline(pref.tagline || "");
        setWord(pref.monthly_word || "");
        setIntention(pref.monthly_intention || "");
        setAvatarColor(pref.avatar_color || "#1C1C1A");
        setSelected(new Set(pref.enabled_sections || []));
        setAvatarPhoto(pref.avatar_url || null);
        setSectionOrder(pref.section_order || ["goals", "notes", "career", "business", "finance", "travel", "projects", "ai"]);
      }
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

  const save = async () => {
    setSaving(true);
    const data = {
      display_name: name,
      tagline,
      monthly_word: word,
      monthly_intention: intention,
      avatar_color: avatarColor,
      enabled_sections: Array.from(selected),
      section_order: sectionOrder,
    };
    if (prefs?.id) {
      await base44.entities.UserPreferences.update(prefs.id, data);
    }
    toast({ title: "Settings saved! Refreshing..." });
    setTimeout(() => window.location.reload(), 500);
  };

  const initials = (name || "LH").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pb-32 md:pb-8">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-1">Settings</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Customize your Guía experience</p>

      {/* Avatar */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-5">
        <h2 className="font-heading font-semibold text-foreground mb-4">Avatar</h2>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold overflow-hidden"
              style={{ backgroundColor: avatarColor, boxShadow: `0 0 0 3px ${avatarColor}` }}>
              {avatarPhoto ? <img src={avatarPhoto} alt="avatar" className="w-full h-full object-cover" /> : initials}
            </div>
            <button onClick={() => fileRef.current.click()} disabled={uploadingPhoto} className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent hover:bg-foreground text-accent-foreground rounded-full flex items-center justify-center transition-colors disabled:opacity-50">
              <Camera className="w-3 h-3" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => pickColor(c.hex)}
                  aria-label={c.label}
                  className={`w-10 h-10 rounded-full transition-all ${avatarColor === c.hex ? "ring-2 ring-offset-2 ring-ring scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            {avatarPhoto && (
              <button onClick={removePhoto} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors font-body w-fit">
                <X className="w-3 h-3" /> Remove photo
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-5">
        <h2 className="font-heading font-semibold text-foreground mb-4">Your info</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-muted border border-input rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors font-body" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">Role / note (optional)</label>
            <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Designer, Founder, Student"
              className="w-full bg-muted border border-input rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors font-body" />
          </div>
        </div>
      </section>

      {/* Your words */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-5">
        <h2 className="font-heading font-semibold text-foreground mb-1">Your words</h2>
        <p className="text-xs text-muted-foreground font-body mb-4">Update this each month — takes 10 seconds.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">2026 word or phrase</label>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. Consistency"
              className="w-full bg-muted border border-input rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors font-body" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-body mb-1 block">This month's intention</label>
            <input value={intention} onChange={e => setIntention(e.target.value)} placeholder="e.g. Show up every day"
              className="w-full bg-muted border border-input rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors font-body" />
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-5">
        <h2 className="font-heading font-semibold text-foreground mb-1">Active sections</h2>
        <p className="text-xs text-muted-foreground font-body mb-4">Toggle sections on or off.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_SECTIONS.map(s => {
            const on = selected.has(s.id);
            return (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  on ? "bg-accent border-accent text-accent-foreground" : "bg-card border-border text-foreground hover:border-ring"
                }`}
              >
                {(() => { const Icon = s.icon; return Icon ? <Icon className="w-4 h-4 flex-shrink-0" /> : null; })()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                </div>
                {on && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Section order */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading font-semibold text-foreground">Navigation order</h2>
          <button
            onClick={() => setShowOrderEditor(!showOrderEditor)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-body"
          >
            {showOrderEditor ? "Hide" : "Customize"}
            <ChevronDown className={`w-3 h-3 transition-transform ${showOrderEditor ? "rotate-180" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-body mb-4">Drag to reorder your sidebar navigation.</p>
        {showOrderEditor && (
          <SectionOrderEditor
            enabledSections={Array.from(selected)}
            sectionOrder={sectionOrder}
            onReorder={setSectionOrder}
          />
        )}
      </section>

      <button onClick={save} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground py-3 rounded-xl font-body font-medium hover:opacity-90 transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save profile"}
      </button>
    </div>
  );
}