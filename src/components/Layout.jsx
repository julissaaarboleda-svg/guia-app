import { useState, useEffect } from "react";
import AdjustableImage from "@/components/ui/AdjustableImage";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { Settings, LogOut, Home, MessageCircle, BarChart3, Sparkles } from "lucide-react";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import BottomNav from "@/components/BottomNav";
import QuickCapture from "@/components/QuickCapture";
import DailyWelcome from "@/components/DailyWelcome";
import WeeklyPopup from "@/components/WeeklyPopup";
import GuiaHeader from "@/components/GuiaHeader";
import { useAuth } from "@/lib/AuthContext";
import { SECTION_META, DEFAULT_SECTION_ORDER, normalizeSections, normalizeOrder, isSectionActive } from "@/lib/navSections";
import { maybeAutoBackup } from "@/lib/backup";
import { saveCurrentSnapshot } from "@/lib/recap";




export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [prefs, setPrefs] = useState(() => {
    try { const raw = localStorage.getItem("guia:nav-prefs"); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  // Other screens (like the weekly pop-up) can update preferences in place.
  useEffect(() => {
    const on = (e) => setPrefs((p) => {
      const next = { ...(p || {}), ...(e.detail || {}) };
      try { localStorage.setItem("guia:nav-prefs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    window.addEventListener("guia:prefs-patch", on);
    return () => window.removeEventListener("guia:prefs-patch", on);
  }, []);
  const [user, setUser] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Quiet housekeeping a few seconds after the app opens: weekly backup + this month's recap snapshot.
  useEffect(() => {
    const t = setTimeout(() => { maybeAutoBackup(); saveCurrentSnapshot(); }, 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const u = await base44.auth.me();
        if (!alive) return;
        setUser(u);
        const p = await ent.UserPreferences.filter({ user_email: u.email });
        if (!alive) return;
        if (p.length > 0) {
          let pref = p[0];
          if (!pref.enabled_sections || pref.enabled_sections.length === 0) {
            await ent.UserPreferences.update(pref.id, { enabled_sections: DEFAULT_SECTION_ORDER });
            pref = { ...pref, enabled_sections: DEFAULT_SECTION_ORDER };
          }
          setPrefs(pref);
          // Keep the sample-data AI switch in step with the account (e.g. a demo opened on a new phone).
          try { if (pref?.sample_data) localStorage.setItem("guia-sample-mode", "1"); else localStorage.removeItem("guia-sample-mode"); } catch { /* ignore */ }
          try { localStorage.setItem("guia:nav-prefs", JSON.stringify(pref)); } catch {}
        }
      } catch {}
    };
    load();
    return () => { alive = false; };
  }, []);

  const enabledSections = (!prefs || !prefs.enabled_sections || prefs.enabled_sections.length === 0) ? DEFAULT_SECTION_ORDER : normalizeSections(prefs.enabled_sections);
  const sectionOrder = normalizeOrder(prefs?.section_order);
  const displayName = prefs?.display_name || user?.full_name || "Life Hub";
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarColor = prefs?.avatar_color || "#1A1A1A";
  const avatarUrl = prefs?.avatar_url || null;

  const NavLink = ({ path, Icon, label }) => {
    const active = location.pathname === path || Object.values(SECTION_META).some((m) => m.path === path && isSectionActive(m, location.pathname));
    return (
      <Link
        to={path}
       
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? "bg-accent text-accent-foreground font-medium"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        }`}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="w-44 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-4 pb-4 border-b border-sidebar-border" style={{ paddingTop: 'calc(env(safe-area-inset-top, 20px) + 20px)' }}>
        <div className="flex items-center gap-3">
          <Link to="/settings" className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 hover:opacity-90 transition-opacity" style={{ backgroundColor: avatarUrl ? 'transparent' : avatarColor, boxShadow: `0 0 0 3px ${avatarColor}` }}>
            {avatarUrl ? <AdjustableImage src={avatarUrl} pos={prefs?.avatar_pos} /> : <span className="text-sm font-semibold text-white">{initials}</span>}
          </Link>
          <p className="font-heading text-base text-sidebar-foreground tracking-wide font-bold">Guía</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavLink path="/" Icon={Home} label="Home" />
        {sectionOrder.filter(id => enabledSections.includes(id)).map((id) => {
          const meta = SECTION_META[id];
          if (!meta) return null;
          return <NavLink key={id} path={meta.path} Icon={meta.Icon} label={meta.label} />;
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 border-t border-sidebar-border space-y-0.5 pt-2">
        {user?.email && (
          <p className="px-3 pb-1 text-[11px] text-sidebar-foreground/40 truncate" title={user.email}>
            {user.email}
          </p>
        )}
        <Link to="/review" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Weekly review</span>
        </Link>
        <Link to="/recap" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Recap</span>
        </Link>
        <Link
          to="/settings"
         
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </Link>
        <button
          onClick={() => setShowFeedback(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Feedback</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Feedback modal */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <GuiaHeader />

        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          <div className="flex flex-col shrink-0 min-h-full min-w-0 pb-36 lg:pb-0">
            <Outlet />
          </div>
        </main>
        <BottomNav prefs={prefs} onFeedback={() => setShowFeedback(true)} />
        <QuickCapture />
        <DailyWelcome user={user} prefs={prefs} />
        <WeeklyPopup user={user} prefs={prefs} />
      </div>
    </div>
  );
}
