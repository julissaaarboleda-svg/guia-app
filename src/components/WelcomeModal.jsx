import { motion } from "framer-motion";
import { X, Target, FileText, Briefcase, Building2, CreditCard, Plane, FolderOpen } from "lucide-react";

const SECTIONS = [
  { icon: Target, label: "Goals", desc: "Set long-term goals and track daily tasks" },
  { icon: FileText, label: "Notes", desc: "Capture thoughts and ideas" },
  { icon: Briefcase, label: "Career", desc: "Track jobs, reviews, and growth" },
  { icon: Building2, label: "Business", desc: "Monitor revenue and expenses" },
  { icon: CreditCard, label: "Finance", desc: "Manage bills, credit, and savings" },
  { icon: Plane, label: "Travel", desc: "Plan trips and itineraries" },
  { icon: FolderOpen, label: "Projects", desc: "Organize personal projects" },
];

export default function WelcomeModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-stone-900 mb-2">Welcome to Guía</h1>
            <p className="text-stone-500">Your personal life operating system</p>
          </div>

          {/* Purpose */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 mb-6">
            <h2 className="font-semibold text-stone-800 mb-2">What is Guía?</h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Guía helps you organize every area of your life in one place. Track your goals, manage your career, 
              run your business, plan trips, and reflect on your progress — all from a single, beautiful dashboard.
            </p>
          </div>

          {/* Features grid */}
          <h2 className="font-semibold text-stone-800 mb-4">What you can do</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {SECTIONS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 bg-white border border-stone-200 rounded-xl">
                <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">{label}</p>
                  <p className="text-xs text-stone-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Getting started */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-xl p-5 text-white">
            <h2 className="font-semibold mb-3">Getting started</h2>
            <ol className="space-y-2 text-sm text-stone-200">
              <li className="flex items-start gap-2">
                <span className="text-stone-400">1.</span>
                <span>Customize your profile in Settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-stone-400">2.</span>
                <span>Enable the sections you care about</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-stone-400">3.</span>
                <span>Start adding your first goals, notes, or trips</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-stone-400">4.</span>
                <span>Check your Dashboard daily for inspiration</span>
              </li>
            </ol>
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className="w-full mt-6 bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors"
          >
            Let's get started
          </button>
        </div>
      </motion.div>
    </div>
  );
}