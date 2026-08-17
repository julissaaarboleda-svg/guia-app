import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Settings, LogOut, Home, Target, Briefcase, Building2, CreditCard, Plane, FolderOpen, FileText, HelpCircle, MessageCircle, Sparkles } from "lucide-react";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/AuthContext";

const DEFAULT_SECTION_ORDER = ["goals", "notes", "career", "business", "finance", "travel", "projects", "ai"];

const SECTION_META = {
  goals:    { label: "Goals",    Icon: Target, path: "/goals" },
  notes:    { label: "Notes",    Icon: FileText,    path: "/notes" },
  career:   { label: "Career",   Icon: Briefcase,   path: "/career" },
  business: { label: "Business", Icon: Building2,   path: "/business" },
  finance:  { label: "Finance",  Icon: CreditCard,  path: "/finance" },
  travel:   { label: "Journeys", Icon: Plane,       path: "/travel" },
  projects: { label: "Projects", Icon: FolderOpen,  path: "/projects" },
  ai:       { label: "AI",       Icon: Sparkles,    path: "/ai" },
};

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [prefs, setPrefs] = useState(() => {
    try { const raw = localStorage.getItem("guia:nav-prefs"); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [user, setUser] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const u = await base44.auth.me();
        if (!alive) return;
        setUser(u);
        const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
        if (!alive) return;
        if (p.length > 0) {
          let pref = p[0];
          if (!pref.enabled_sections || pref.enabled_sections.length === 0) {
            await base44.entities.UserPreferences.update(pref.id, { enabled_sections: DEFAULT_SECTION_ORDER });
            pref = { ...pref, enabled_sections: DEFAULT_SECTION_ORDER };
          }
          setPrefs(pref);
          try { localStorage.setItem("guia:nav-prefs", JSON.stringify(pref)); } catch {}
        }
      } catch {}
    };
    load();
    return () => { alive = false; };
  }, []);

  const enabledSections = (!prefs || !prefs.enabled_sections || prefs.enabled_sections.length === 0) ? DEFAULT_SECTION_ORDER : prefs.enabled_sections;
  const sectionOrder = (prefs?.section_order && prefs.section_order.length > 0) ? prefs.section_order : DEFAULT_SECTION_ORDER;
  const displayName = prefs?.display_name || user?.full_name || "Life Hub";
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarColor = prefs?.avatar_color || "#1A1A1A";
  const avatarUrl = prefs?.avatar_url || null;

  const NavLink = ({ path, Icon, label }) => {
    const active = location.pathname === path;
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
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-semibold text-white">{initials}</span>}
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
      <div className="hidden md:flex flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Feedback modal */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          <div className="flex flex-col shrink-0 min-h-full min-w-0 pb-36 md:pb-0">
            <Outlet />
          </div>
        </main>
        <BottomNav prefs={prefs} onFeedback={() => setShowFeedback(true)} />
      </div>
    </div>
  );
}