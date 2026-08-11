import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Target, FileText, Briefcase, Building2, CreditCard, Plane, 
  FolderOpen, Settings, Home, ChevronRight, ChevronLeft,
  ExternalLink, Plus, Check, TrendingUp, MapPin, MessageCircle
} from "lucide-react";
import { motion } from "framer-motion";
import FeedbackModal from "@/components/feedback/FeedbackModal";

const SECTIONS = [
  { 
    id: "dashboard",
    Icon: Home, 
    label: "Home", 
    path: "/",
    desc: "Your daily hub with widgets and inspiration",
    color: "from-stone-900 to-stone-800",
    actions: [
      { icon: Plus, text: "See your daily widgets at a glance" },
      { icon: Check, text: "Customize which sections appear" },
      { icon: TrendingUp, text: "Get inspired with daily quotes" }
    ]
  },
  { 
    id: "goals",
    Icon: Target, 
    label: "Goals & Tasks", 
    path: "/goals",
    desc: "Track your goals and daily tasks",
    color: "from-[#5B7A5B] to-[#4A6B4A]",
    actions: [
      { icon: Plus, text: "Create goals with target dates" },
      { icon: Check, text: "Add tasks with priorities" },
      { icon: TrendingUp, text: "Track progress percentage" }
    ]
  },
  { 
    id: "notes",
    Icon: FileText, 
    label: "Notes", 
    path: "/notes",
    desc: "Rich text notes and checklists",
    color: "from-[#8B7355] to-[#7A6244]",
    actions: [
      { icon: Plus, text: "Write in rich text or checklist format" },
      { icon: Check, text: "Organize by category" },
      { icon: TrendingUp, text: "Pin important notes to top" }
    ]
  },
  { 
    id: "career",
    Icon: Briefcase, 
    label: "Career", 
    path: "/career",
    desc: "Track your professional journey",
    color: "from-[#5B6B7A] to-[#4A5B6A]",
    actions: [
      { icon: Plus, text: "Log jobs, reviews, and milestones" },
      { icon: Check, text: "Rate job satisfaction" },
      { icon: TrendingUp, text: "Track skills and certifications" }
    ]
  },
  { 
    id: "business",
    Icon: Building2, 
    label: "Business", 
    path: "/business",
    desc: "Revenue, expenses, and goals",
    color: "from-[#6B7A8B] to-[#5A6B7A]",
    actions: [
      { icon: Plus, text: "Log revenue and expenses" },
      { icon: Check, text: "Set revenue targets" },
      { icon: TrendingUp, text: "See profit automatically" }
    ]
  },
  { 
    id: "finance",
    Icon: CreditCard, 
    label: "Finance", 
    path: "/finance",
    desc: "Credit scores, savings, and bills",
    color: "from-[#6B7A5B] to-[#5A6B4A]",
    actions: [
      { icon: Plus, text: "Track credit scores over time" },
      { icon: Check, text: "Set savings goals" },
      { icon: TrendingUp, text: "Monitor bills and payment status" }
    ]
  },
  { 
    id: "travel",
    Icon: Plane, 
    label: "Travel", 
    path: "/travel",
    desc: "Trip planning and itineraries",
    color: "from-[#5B7A8B] to-[#4A6B7A]",
    actions: [
      { icon: Plus, text: "Add flight and hotel details" },
      { icon: Check, text: "Create day-by-day itineraries" },
      { icon: MapPin, text: "Build packing lists" }
    ]
  },
  { 
    id: "projects",
    Icon: FolderOpen, 
    label: "Projects", 
    path: "/projects",
    desc: "Manage personal projects and milestones",
    color: "from-[#7A6B8B] to-[#6A5B7A]",
    actions: [
      { icon: Plus, text: "Create projects with a status and target date" },
      { icon: Check, text: "Add tasks that save automatically" },
      { icon: TrendingUp, text: "Track progress with a completion bar" }
    ]
  },
  { 
    id: "settings",
    Icon: Settings, 
    label: "Settings", 
    path: "/settings",
    desc: "Customize your experience",
    color: "from-[#6B6B6B] to-[#5A5A5A]",
    actions: [
      { icon: Plus, text: "Set your display name and avatar" },
      { icon: Check, text: "Enable/disable sections" },
      { icon: TrendingUp, text: "Reorder navigation" }
    ]
  },
];

export default function Help() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);

  const nextSlide = () => setCurrentSlide(s => Math.min(s + 1, SECTIONS.length - 1));
  const prevSlide = () => setCurrentSlide(s => Math.max(s - 1, 0));
  const section = SECTIONS[currentSlide];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto help-guide-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-stone-900 mb-2">Help & Guide</h1>
        <p className="text-stone-500 text-sm">Quick tour of Via&apos;s features</p>
      </div>

      {/* Slide counter */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-stone-500">
          {currentSlide + 1} of {SECTIONS.length}
        </span>
        <button
          onClick={() => setCurrentSlide(0)}
          className="text-xs text-stone-400 hover:text-stone-700"
        >
          Start over
        </button>
      </div>

      {/* Main slide - Full screen gradient */}
      <motion.div
        key={currentSlide}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className={`bg-gradient-to-br ${section.color} rounded-2xl overflow-hidden mb-4 text-white relative`}
      >
        <div className="p-8">
          {/* Icon and title */}
          <div className="flex items-center gap-4 mb-6">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
            >
              <section.Icon className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl font-heading font-bold"
              >
                {section.label}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-white/80 text-sm"
              >
                {section.desc}
              </motion.p>
            </div>
          </div>

          {/* Action items */}
          <div className="space-y-3">
            {section.actions.map((action, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3"
              >
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-white/90 text-sm">{action.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:hover:text-stone-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <div className="flex gap-1.5">
          {SECTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide ? 'bg-stone-800 w-6' : 'bg-stone-300 hover:bg-stone-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          disabled={currentSlide === SECTIONS.length - 1}
          className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:hover:text-stone-600 transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick link */}
      <div className="text-center mt-6">
        <Link
          to={section.path}
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          Go to {section.label} <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Feedback button */}
      <div className="mt-6 text-center">
        <button
          onClick={() => setShowFeedback(true)}
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Send feedback
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="mt-6 text-center text-xs text-stone-400">
        <p>Use ← → arrow keys to navigate</p>
      </div>

      {/* Feedback modal */}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}