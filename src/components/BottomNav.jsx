import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Target, FileText, Briefcase, Building2, CreditCard, Plane, FolderOpen, Settings, MessageCircle, MoreHorizontal, X, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const SECTION_META = {
  goals:    { label: "Goals",    Icon: Target,     path: "/goals" },
  notes:    { label: "Notes",    Icon: FileText,   path: "/notes" },
  career:   { label: "Career",   Icon: Briefcase,  path: "/career" },
  business: { label: "Business", Icon: Building2,  path: "/business" },
  finance:  { label: "Finance",  Icon: CreditCard, path: "/finance" },
  travel:   { label: "Journeys", Icon: Plane,      path: "/travel" },
  projects: { label: "Projects", Icon: FolderOpen, path: "/projects" },
  ai:       { label: "AI",       Icon: Sparkles,   path: "/ai" },
};

const DEFAULT_SECTION_ORDER = ["goals", "notes", "career", "business", "finance", "travel", "projects", "ai"];

export default function BottomNav({ prefs, onFeedback }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const enabledSections = (!prefs?.enabled_sections || prefs.enabled_sections.length === 0)
    ? DEFAULT_SECTION_ORDER
    : prefs.enabled_sections;
  const sectionOrder = (prefs?.section_order && prefs.section_order.length > 0)
    ? prefs.section_order
    : DEFAULT_SECTION_ORDER;

  const orderedSections = sectionOrder.filter(id => enabledSections.includes(id));
  const visibleSections = orderedSections.slice(0, 4);
  const moreSections = orderedSections.slice(4);

  const isActive = (path) => location.pathname === path;

  const NavButton = ({ path, Icon, label }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 min-w-0 flex-1 transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="font-body text-[10px] leading-tight truncate max-w-full">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Bottom bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border flex items-center justify-around px-1"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 44px) + 4px)",
          height: "calc(env(safe-area-inset-bottom, 44px) + 60px)",
        }}
      >
        <NavButton path="/" Icon={Home} label="Home" />
        {visibleSections.map(id => {
          const meta = SECTION_META[id];
          if (!meta) return null;
          return <NavButton key={id} path={meta.path} Icon={meta.Icon} label={meta.label} />;
        })}
        <button
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 min-w-0 flex-1 transition-colors ${
            showMore ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="font-body text-[10px] leading-tight">More</span>
        </button>
      </div>

      {/* More drawer */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div
            className="bg-card border border-border rounded-t-3xl p-6 shadow-editorial"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 44px) + 20px)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-foreground">More</h2>
              <button onClick={() => setShowMore(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {moreSections.map(id => {
                const meta = SECTION_META[id];
                if (!meta) return null;
                return (
                  <Link
                    key={id}
                    to={meta.path}
                    onClick={() => setShowMore(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive(meta.path)
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <meta.Icon className="w-4 h-4" />
                    <span className="font-body">{meta.label}</span>
                  </Link>
                );
              })}
              <div className="border-t border-border my-2" />
              {user?.email && (
                <p className="px-3 pb-1 text-[11px] text-muted-foreground/60 truncate" title={user.email}>
                  {user.email}
                </p>
              )}
              <Link
                to="/settings"
                onClick={() => setShowMore(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="font-body">Settings</span>
              </Link>
              <button
                onClick={() => { setShowMore(false); onFeedback(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="font-body">Feedback</span>
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-body">Log out</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}