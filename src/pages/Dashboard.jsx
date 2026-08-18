import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import WelcomeModal from "@/components/WelcomeModal";
import EditorialHero from "@/components/home/EditorialHero";
import Greeting from "@/components/home/Greeting";
import TodaysFocus from "@/components/home/TodaysFocus";
import UpNext from "@/components/home/UpNext";
import LifeProgress from "@/components/home/LifeProgress";
import TodaysInsight from "@/components/home/TodaysInsight";
import RecentActivity from "@/components/home/RecentActivity";
import Reveal from "@/components/home/Reveal";
import { buildFocusItems, buildUpNext, buildProgress, buildActivity, buildDigest, buildDailyStatus } from "@/lib/homeData";
import { getHomeAi } from "@/lib/homeAi";

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1200&q=80",
];

const QUOTES = [
  { text: "Tension is who you think you should be. Relaxation is who you are.", author: "Lao Tzu" },
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "Little by little, one travels far.", author: "Tolkien" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "What we think, we become.", author: "Buddha" },
  { text: "Slow is smooth, and smooth is fast.", author: "Navy SEAL proverb" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "Consistency compounds.", author: "James Clear" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "Clarity comes from engagement, not thought.", author: "Marie Forleo" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

export default function Dashboard() {
  const [prefs, setPrefs] = useState(null);
  const [user, setUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [bizEntries, setBizEntries] = useState([]);
  const [finItems, setFinItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [businessGoals, setBusinessGoals] = useState([]);
  const [careerEntries, setCareerEntries] = useState([]);
  const [ai, setAi] = useState({ summary: null, insight: null });
  const [loaded, setLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [heroMode, setHeroMode] = useState(() => localStorage.getItem("guia-hero-mode") || "photo_quote");
  const [userHeroImages, setUserHeroImages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("guia-hero-images") || "[]"); } catch { return []; }
  });

  const dayOfYear = useMemo(() => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000), []);
  const dailyQuote = QUOTES[dayOfYear % QUOTES.length];
  const dailyImage = userHeroImages[0] || HERO_IMAGES[dayOfYear % HERO_IMAGES.length];

  useEffect(() => {
    const checkWelcome = async () => {
      const u = await base44.auth.me();
      const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
      if (p.length > 0 && !p[0].welcome_shown) {
        setShowWelcome(true);
        await base44.entities.UserPreferences.update(p[0].id, { welcome_shown: true });
      }
    };
    checkWelcome();
  }, []);

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me();
      setUser(u);
      const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
      if (p.length > 0) {
        setPrefs(p[0]);
        // Hero photo/mode are account settings, not just browser state — sync
        // from the real saved data once it loads, so they survive logging
        // out and back in (or switching devices), instead of only ever
        // living in this browser's localStorage.
        if (p[0].hero_mode) setHeroMode(p[0].hero_mode);
        if (Array.isArray(p[0].hero_images) && p[0].hero_images.length > 0) setUserHeroImages(p[0].hero_images);
      }
      const [g, n, tr, biz, fin, tsk, proj, bg, career] = await Promise.all([
        base44.entities.Goal.list("-created_date", 20),
        base44.entities.Note.list("-updated_date", 5),
        base44.entities.Trip.list("-start_date", 8),
        base44.entities.BusinessEntry.list("-date", 30),
        base44.entities.FinanceItem.list("-created_date", 30),
        base44.entities.Task.list("-due_date", 40),
        base44.entities.Project.list("-updated_date", 20),
        base44.entities.BusinessGoal.list("-created_date", 10),
        base44.entities.CareerEntry.list("-updated_date", 10),
      ]);
      setGoals(g); setNotes(n); setTrips(tr); setBizEntries(biz);
      setFinItems(fin); setTasks(tsk); setProjects(proj);
      setBusinessGoals(bg); setCareerEntries(career);
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const digest = buildDigest({ goals, projects, trips, finItems, tasks, businessGoals });
    getHomeAi(digest).then(setAi);
  }, [loaded, goals, projects, trips, finItems, tasks, businessGoals]);

  const focus = useMemo(
    () => buildFocusItems({ tasks, goals, projects, finItems, trips, businessGoals, careerEntries }),
    [tasks, goals, projects, finItems, trips, businessGoals, careerEntries]
  );
  const upNext = useMemo(() => buildUpNext({ trips, projects, bizEntries }), [trips, projects, bizEntries]);
  const progress = useMemo(() => buildProgress({ goals, businessGoals, trips, projects }), [goals, businessGoals, trips, projects]);
  const activity = useMemo(
    () => buildActivity({ notes, finItems, goals, trips, bizEntries, projects, careerEntries }),
    [notes, finItems, goals, trips, bizEntries, projects, careerEntries]
  );

  const dailyStatus = useMemo(() => buildDailyStatus({ tasks, trips, finItems, goals }), [tasks, trips, finItems, goals]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = prefs?.display_name?.split(" ")[0] || user?.full_name?.split(" ")[0] || "there";

  const persistMode = async (m) => {
    setHeroMode(m);
    localStorage.setItem("guia-hero-mode", m);
    if (prefs?.id) await base44.entities.UserPreferences.update(prefs.id, { hero_mode: m });
  };

  const onHeroUpload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const next = [...userHeroImages, file_url];
    setUserHeroImages(next);
    localStorage.setItem("guia-hero-images", JSON.stringify(next));
    if (prefs?.id) await base44.entities.UserPreferences.update(prefs.id, { hero_images: next });
  };

  const completeFocus = async (item) => {
    if (item.kind === "task") {
      setTasks((prev) => prev.filter((t) => t.id !== item.refId));
      await base44.entities.Task.update(item.refId, { completed: true });
    } else if (item.kind === "goal") {
      const g = goals.find((x) => x.id === item.refId);
      if (!g) return;
      const subs = [...(g.sub_tasks || [])];
      subs[item.subIndex] = { ...subs[item.subIndex], completed: true };
      setGoals((prev) => prev.map((x) => (x.id === item.refId ? { ...x, sub_tasks: subs } : x)));
      await base44.entities.Goal.update(item.refId, { sub_tasks: subs });
    } else if (item.kind === "project") {
      const p = projects.find((x) => x.id === item.refId);
      if (!p) return;
      const tks = [...(p.tasks || [])];
      tks[item.subIndex] = { ...tks[item.subIndex], completed: true };
      setProjects((prev) => prev.map((x) => (x.id === item.refId ? { ...x, tasks: tks } : x)));
      await base44.entities.Project.update(item.refId, { tasks: tks });
    } else if (item.kind === "bill") {
      setFinItems((prev) => prev.map((f) => (f.id === item.refId ? { ...f, paid: true } : f)));
      await base44.entities.FinanceItem.update(item.refId, { paid: true });
    } else if (item.kind === "pack") {
      const t = trips.find((x) => x.id === item.refId);
      if (!t) return;
      const pk = [...(t.packing_items || [])];
      pk[item.subIndex] = { ...pk[item.subIndex], packed: true };
      setTrips((prev) => prev.map((x) => (x.id === item.refId ? { ...x, packing_items: pk } : x)));
      await base44.entities.Trip.update(item.refId, { packing_items: pk });
    }
  };

  return (
    <div className="px-6 md:px-10 lg:px-14 pb-5 md:pb-7 max-w-[900px] mx-auto w-full space-y-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
      <EditorialHero
        image={dailyImage}
        quote={dailyQuote}
        mode={heroMode}
        setMode={persistMode}
        onUpload={onHeroUpload}
      />

      <Greeting dateStr={dateStr} greeting={greeting} firstName={firstName} status={dailyStatus} />

      <Reveal delay={0.05}>
        <TodaysInsight insight={ai.insight} />
      </Reveal>

      <Reveal delay={0.06}>
        {loaded ? (
          <TodaysFocus items={focus.items} total={focus.total} onComplete={completeFocus} />
        ) : (
          <section>
            <div className="flex items-end justify-between mb-2.5">
              <h2 className="font-heading text-lg text-foreground font-semibold">Today’s Focus</h2>
            </div>
            <div className="rounded-2xl bg-card overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex items-center gap-3 px-3.5 py-2 ${i !== 0 ? "border-t border-border/40" : ""}`}>
                  <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-muted/70 animate-pulse" />
                    <div className="h-2 w-1/3 rounded bg-muted/50 animate-pulse" />
                  </div>
                  <div className="h-3 w-10 rounded-full bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        )}
      </Reveal>

      {progress.length > 0 && (
        <Reveal delay={0.08}>
          <LifeProgress circles={progress} />
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <UpNext items={upNext} />
      </Reveal>

      <Reveal delay={0.12}>
        <RecentActivity items={activity} />
      </Reveal>

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}