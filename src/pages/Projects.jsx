import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { Plus, ChevronRight, Briefcase, Trash2 } from "lucide-react";
import ActionCircle from "@/components/ActionCircle";
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";

const statusColors = {
  planning:  "bg-muted text-foreground border-border",
  active:    "bg-muted text-foreground border-border",
  on_hold:   "bg-muted text-muted-foreground border-border",
  completed: "bg-muted text-foreground border-border",
};

// Same person-color logic as ProjectTasks.jsx, so the same collaborator gets
// the same color everywhere in the app, not just within one project's task list.
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
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", status: "planning", target_date: "" });
  const [currentEmail, setCurrentEmail] = useState("");

  const load = async () => {
    const data = await base44.entities.Project.list("-created_date");
    setProjects(data);
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
    setForm({ title: "", description: "", status: "planning", target_date: "" });
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
      <PageHeader title="Projects" subtitle="Track personal projects and milestones" />
      <div className="p-4 md:p-8">

      {projects.length === 0 && (
        <div className="text-center py-20 text-muted-foreground/60 bg-card border border-border rounded-2xl">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground mb-1">No projects yet</p>
          <p className="text-sm text-muted-foreground">Add your first project to get started</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Projects</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3">
            {active.map(project => {
              const progress = calculateProgress(project.tasks);
              return (
                <div key={project.id}
                  className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-ring hover:shadow-sm transition-all group relative"
                >
                  <div className="flex items-start gap-4" onClick={() => setSelected(project)} style={{ cursor: 'pointer' }}>
                    <div
                      className="w-16 h-16 rounded-xl flex-shrink-0 bg-cover bg-center flex items-center justify-center"
                      style={{
                        backgroundImage: project.cover_image_url ? `url(${project.cover_image_url})` : undefined,
                        background: project.cover_image_url ? undefined : (project.accent_color || "#A7773F"),
                      }}
                    >
                      {!project.cover_image_url && <Briefcase className="w-6 h-6 text-white/80" strokeWidth={1.5} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColors[project.status]}`}>{project.status.replace("_", " ")}</span>
                      </div>
                      {project.description && <p className="text-muted-foreground text-xs mt-1 line-clamp-1">{project.description}</p>}
                      {project.target_date && (
                        <p className="text-muted-foreground text-xs mt-1">
                          Due: {new Date(project.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                      <div className="flex -space-x-1.5 mt-2">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: colorForPerson(currentEmail || "me") }}
                          title="Me"
                        >
                          {initialsFor(currentEmail || "me", currentEmail)}
                        </div>
                        {(project.collaborators || []).map((c) => (
                          <div
                            key={c}
                            className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-white text-[9px] font-bold"
                            style={{ background: colorForPerson(c) }}
                            title={c}
                          >
                            {initialsFor(c, currentEmail)}
                          </div>
                        ))}
                      </div>
                      {project.tasks && project.tasks.length > 0 && (
                        <div className="mt-3">
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
                        onClick={async (e) => { e.stopPropagation(); if (confirm("Delete this project?")) { await base44.entities.Project.delete(project.id); load(); } }}
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

      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Completed Projects</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-2">
            {completed.map(project => (
              <button key={project.id} onClick={() => setSelected(project)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-border transition-all group flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-foreground block truncate">{project.title}</span>
                  {project.target_date && <span className="text-muted-foreground text-xs">{new Date(project.target_date).getFullYear()}</span>}
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
      <ActionCircle onClick={() => setShowAdd(true)} label="Add project" />
    </>
  );
}