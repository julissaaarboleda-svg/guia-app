import { useState } from "react";
import ViaIntro from "../components/ViaIntro";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

const ALL_SECTIONS = [
  { id: "tasks",    label: "Tasks",    emoji: "✅", description: "Daily to-dos, reminders, priorities" },
  { id: "goals",    label: "Goals",    emoji: "🎯", description: "Track long-term goals and milestones" },
  { id: "career",   label: "Career",   emoji: "💼", description: "Work, comp & growth" },
  { id: "business", label: "Business", emoji: "🏢", description: "Revenue, expenses, clients" },
  { id: "finance",  label: "Finance",  emoji: "💳", description: "Credit scores & bills" },
  { id: "travel",   label: "Journeys", emoji: "✈️", description: "Trips & itineraries" },
  { id: "projects", label: "Projects", emoji: "🗂️", description: "Tasks & timelines" },
  { id: "notes",    label: "Notes",    emoji: "📝", description: "Ideas & lists" },
];

export default function Onboarding() {
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [wordOfYear, setWordOfYear] = useState("");
  const [selected, setSelected] = useState(new Set(["tasks", "goals"]));
  const [saving, setSaving] = useState(false);

  const toggleSection = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [error, setError] = useState(null);

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const user = await base44.auth.me();
      const existing = await ent.UserPreferences.filter({ user_email: user.email });
      const data = {
        user_email: user.email,
        display_name: name || user.full_name || "Friend",
        monthly_word: wordOfYear || "",
        onboarding_complete: true,
        enabled_sections: Array.from(selected),
      };
      if (existing.length > 0) {
        await ent.UserPreferences.update(existing[0].id, data);
      } else {
        await ent.UserPreferences.create(data);
      }
      window.location.href = "/";
    } catch (err) {
      console.error("Onboarding finish() failed:", err);
      setError(err.message || "Something went wrong saving your profile.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ backgroundColor: "hsl(var(--background))" }}>
      <AnimatePresence>
        {showIntro && <ViaIntro onDone={() => setShowIntro(false)} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="w-full max-w-sm"
        >
          <div className="bg-white rounded-3xl shadow-lg px-8 pt-8 pb-10">
            {/* Step dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? 28 : 10,
                    height: 10,
                    backgroundColor: i === step ? "#A7773F" : "#CAC4BA",
                  }}
                />
              ))}
            </div>

            {/* Brand */}
            <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground mb-6 uppercase">Guía</p>

            {/* STEP 0 */}
            {step === 0 && (
              <div>
                <h1 className="font-heading text-4xl font-bold text-foreground mb-2">Welcome to Guía.</h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">Your Path. Your Pace.</p>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="What's your name?"
                  className="w-full border border-border rounded-full px-5 py-3.5 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-[#A7773F]/60 transition-colors mb-4"
                  onKeyDown={e => e.key === "Enter" && setStep(1)}
                  autoFocus
                />
                <button
                  onClick={() => setStep(1)}
                  className="w-full py-3.5 rounded-full text-[#F7F3EC] text-sm font-heading transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#A7773F" }}
                >
                  Continue
                </button>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div>
                <h1 className="font-heading text-3xl font-bold text-foreground mb-1">What do you want to track?</h1>
                <p className="text-muted-foreground text-sm mb-5">Choose your sections. You can change this anytime.</p>
                <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 mb-5">
                  {ALL_SECTIONS.map(s => {
                    const on = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSection(s.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all"
                        style={{
                          backgroundColor: on ? "#F0EDE8" : "#FAFAF9",
                          borderColor: on ? "#4F473E" : "#E7E5E4",
                          color: on ? "#A7773F" : "#4F473E",
                        }}
                      >
                        <span className="text-base">{s.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{s.label}</p>
                          <p className="text-xs truncate opacity-60">{s.description}</p>
                        </div>
                        {on && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#4F473E" }} />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(0)} className="px-5 py-3 rounded-full text-sm text-muted-foreground hover:text-foreground border border-border transition-colors">
                    Back
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={selected.size === 0}
                    className="flex-1 py-3 rounded-full text-[#F7F3EC] text-sm font-heading transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "#A7773F" }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div>
                <h1 className="font-heading text-3xl font-bold text-foreground mb-1">You're all set.</h1>
                <p className="text-muted-foreground text-sm mb-6">One last thing — your word of the year helps personalize your dashboard.</p>
                <input
                  value={wordOfYear}
                  onChange={e => setWordOfYear(e.target.value)}
                  placeholder="e.g. Consistency, Growth, Focus"
                  className="w-full border border-border rounded-full px-5 py-3.5 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-[#A7773F]/60 transition-colors mb-4"
                />
                {error && (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 mb-4">
                    {error}
                  </p>
                )}
                <button
                  onClick={finish}
                  disabled={saving}
                  className="w-full py-3.5 rounded-full text-[#F7F3EC] text-sm font-heading transition-opacity hover:opacity-90 disabled:opacity-50 mb-2"
                  style={{ backgroundColor: "#A7773F" }}
                >
                  {saving ? "Setting up..." : "Open Guía"}
                </button>
                <button onClick={() => setStep(1)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}