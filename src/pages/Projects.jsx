import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { parseISO } from "date-fns";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { Plus, ChevronRight, Briefcase, Trash2, Calendar } from "lucide-react";

const CATEGORIES = [
  { id: "event", label: "Event", emoji: "🎉" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "✨" },
  { id: "financial", label: "Financial", emoji: "💰" },
  { id: "other", label: "Other", emoji: "•••" },
];
const categoryInfo = (id) => CATEGORIES.find((c) => c.id === id);
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";

const statusColors = {
  planning:  "bg-muted text-foreground border-border",
  active:    "bg-muted text-foreground border-border",
  on_hold:   "bg-muted text-muted-foreground border-border",
  completed: "bg-muted text-foreground border-border",
};

const CHIP_COLORS = ["#A7773F", "#7D8A53", "#A77C81", "#6B655D", "#8A6530"];
function colorForPerson(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}
function initialsFor(email, currentEmail) {
  if (email === currentEmail) return "Me".slice(0, 2).toUpperCase();
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  // Without this, `projects` starts as an empty array on every visit, and
  // since there was nothing distinguishing "haven't fetched yet" from
  // "genuinely no projects", the empty state flashed on screen for however
  // long the fetch took, then swapped to the real list once it arrived.
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", status: "planning", target_date: "", category: "" });
  const [currentEmail, setCurrentEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Project.list("-created_date");
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    base44.auth.me().then((u) => setCurrentEmail(u.email)).catch(() => {});
  }, []);

  const addProject = async () => {
    if (!form.title) return;
    const created = await base44.entities.Project.create({
      ...form,
      description: form.description || "",
      target_date: form.target_date || "",
      tasks: [],
    });
    setShowAdd(false);
    setForm({ title: "", description: "", status: "planning", target_date: "", category: "" });
    await load();
    setSelected(created);
  };

  const calculateProgress = (tasks) => {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  };

  if (selected) {
    return (
      <ProjectDetail
        project={selected}
        onBack={() => { setSelected(null); load(); }}
        onUpdate={(updated) => setSelected(updated)}
      />
    );
  }

  const active = projects.filter(p => p.status !== "completed");
  const completed = projects.filter(p => p.status === "completed");

  return (
    <>
      <div className="max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Projects"
        subtitle="Track personal projects and milestones"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
            aria-label="Add project"
            title="Add project"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        }
      />
      <div className="p-4 md:p-8">

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-[110px] rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground/60 bg-card border border-border rounded-2xl">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground mb-1">No projects yet</p>
          <p className="text-sm text-muted-foreground">Add your first project to get started</p>
        </div>
      ) : null}

      {!loading && active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Projects</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3">
            {active.map(project => {
              const progress = calculateProgress(project.tasks);
              return (
                <div key={project.id}
                  className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-ring hover:shadow-sm transition-all group relative"
                >
                  <div className="flex items-center gap-3" onClick={() => setSelected(project)} style={{ cursor: 'pointer' }}>
                    <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: project.accent_color || "#A7773F" }}>
                      {project.cover_image_url ? (
                        <img
                          src={project.cover_image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
                        />
                      ) : null}
                      {project.category && categoryInfo(project.category) ? (
                        <span
                          className="text-xl leading-none"
                          style={{ display: project.cover_image_url ? "none" : "flex" }}
                        >
                          {categoryInfo(project.category).emoji}
                        </span>
                      ) : (
                        <Briefcase
                          className="w-5 h-5 text-white/80"
                          strokeWidth={1.5}
                          style={{ display: project.cover_image_url ? "none" : "flex" }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate text-[15px]">{project.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColors[project.status]}`}>{project.status.replace("_", " ")}</span>
                      </div>
                      {project.description && <p className="text-muted-foreground text-xs line-clamp-1">{project.description}</p>}
                      <div className="flex items-center gap-2.5">
                        {project.category && categoryInfo(project.category) && (
                          <span className="text-muted-foreground text-[11.5px]">{categoryInfo(project.category).label}</span>
                        )}
                        {project.date_type === "ongoing" ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-[11.5px]">
                            <Calendar className="w-3 h-3" strokeWidth={1.8} />
                            Ongoing
                          </span>
                        ) : project.target_date && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-[11.5px]">
                            <Calendar className="w-3 h-3" strokeWidth={1.8} />
                            {parseISO(project.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        <div className="flex -space-x-1.5">
                          <div
                            className="w-5 h-5 rounded-full border-2 border-card flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ background: colorForPerson(currentEmail || "me") }}
                            title="Me"
                          >
                            {initialsFor(currentEmail || "me", currentEmail)}
                          </div>
                          {(project.collaborators || []).filter((c) => c !== currentEmail).map((c) => (
                            <div
                              key={c}
                              className="w-5 h-5 rounded-full border-2 border-card flex items-center justify-center text-white text-[8px] font-bold"
                              style={{ background: colorForPerson(c) }}
                              title={c}
                            >
                              {initialsFor(c, currentEmail)}
                            </div>
                          ))}
                        </div>
                      </div>
                      {project.tasks && project.tasks.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium text-foreground">{progress}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {project.tasks.filter(t => t.completed).length} of {project.tasks.length} tasks complete
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Delete this project?")) return;
                          try {
                            await base44.entities.Project.delete(project.id);
                            await load();
                          } catch (err) {
                            console.error("Failed to delete project:", err);
                            alert("Couldn't delete this project — please try again.");
                          }
                        }}
                        className="text-muted-foreground/60 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Completed Projects</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-2">
            {completed.map(project => (
              <button key={project.id} onClick={() => setSelected(project)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-border transition-all group flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-foreground block truncate">{project.title}</span>
                  {project.target_date && <span className="text-muted-foreground text-xs">{parseISO(project.target_date).getFullYear()}</span>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add project modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center bg-black/30 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl p-6 w-full max-w-md shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>✨</span> Add New Project
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">What are you working on?</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: f.category === c.id ? "" : c.id }))}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        form.category === c.id ? "text-white" : "bg-stone-50 text-muted-foreground border border-border"
                      }`}
                      style={form.category === c.id ? { backgroundColor: "#A7773F" } : undefined}
                    >
                      <span className="text-base leading-none">{c.emoji}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Project name</label>
                <input placeholder="e.g. Home Renovation 🏠" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-stone-50 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors" autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <textarea placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full bg-stone-50 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-stone-50 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors">
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Target date</label>
                <DateInput value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                  className="w-full bg-stone-50 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-ring transition-colors" />
              </div>
              <button onClick={addProject} className="w-full bg-foreground text-background py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
}
