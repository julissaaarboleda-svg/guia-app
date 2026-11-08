import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ent } from "@/lib/freshEntities";
import { parseISO } from "date-fns";
import DateInput from "@/components/DateInput";
import {
  ArrowLeft,
  Edit2,
  Check,
  X,
  Trash2,
  Calendar,
  ListTodo,
  Sparkles,
  UserPlus,
  Upload,
  FileDown,
  DollarSign,
  MoreVertical,
  Move,
} from "lucide-react";
import AdjustableImage from "@/components/ui/AdjustableImage";
import ImageAdjuster from "@/components/ui/ImageAdjuster";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ProjectCollaborators from "@/components/projects/ProjectCollaborators";
import ProjectResources from "@/components/projects/ProjectResources";
import ProjectTasks from "@/components/projects/ProjectTasks";
import ProjectNotes from "@/components/projects/ProjectNotes";
import ProjectBudget from "@/components/projects/ProjectBudget";
import ProjectContributions from "@/components/projects/ProjectContributions";
import { StickyNote, HandHeart } from "lucide-react";
import { initialsFor as initialsOf, nameFor, sameEmail } from "@/lib/collab";
import { PROJECT_CATEGORIES, PROJECT_STATUS_CHIP } from "@/lib/projectCategories";
import { exportProjectPdf } from "@/lib/projectPdfExport";

const DEFAULT_VISIBLE_TABS = { tasks: true, resources: true, notes: true, support: false, budget: true };
const CATEGORIES = PROJECT_CATEGORIES;
const TAB_LABELS = { tasks: "Tasks", resources: "Resources", notes: "Notes", support: "Support", budget: "Budget" };

const statusColors = PROJECT_STATUS_CHIP;

export default function ProjectDetail({ project, onBack, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [accentColor, setAccentColor] = useState(project.accent_color || "#A7773F");
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [coverImage, setCoverImage] = useState(project.cover_image_url || null);
  const [coverPos, setCoverPos] = useState(project.cover_image_pos || null);
  const [adjustingCover, setAdjustingCover] = useState(false);
  useEffect(() => {
    setCoverImage(project.cover_image_url || null);
    setCoverPos(project.cover_image_pos || null);
  }, [project.cover_image_url, project.cover_image_pos]);
  const [form, setForm] = useState({
    title: project.title,
    description: project.description || "",
    status: project.status || "planning",
    target_date: project.target_date || "",
    date_type: project.date_type || "due",
    budget_target: project.budget_target || "",
    category: project.category || "",
    visible_tabs: project.visible_tabs || DEFAULT_VISIBLE_TABS,
  });
  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem(`guia-project-tab-${project.id}`) || "tasks";
    } catch {
      return "tasks";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem(`guia-project-tab-${project.id}`, t);
    } catch {}
  };
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  const tasks = project.tasks || [];
  const collaborators = project.collaborators || [];
  const names = project.collaborator_names || {};
  const visibleTabs = project.visible_tabs || DEFAULT_VISIBLE_TABS;

  useEffect(() => {
    if (visibleTabs[tab]) return;
    const firstVisible = Object.keys(visibleTabs).find((k) => visibleTabs[k]);
    if (firstVisible) setTab(firstVisible);
  }, [visibleTabs[tab]]);

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => {
        setIsOwner(!project.created_by_id || u.id === project.created_by_id);
        setCurrentUserEmail(u.email);
        // Self-register my own display name on the project the first time I open
        // it, so everyone else sees "Ruth" instead of the start of my email.
        const key = (u.email || "").toLowerCase();
        ent.UserPreferences.filter({ user_email: u.email })
          .then((prefs) => (prefs[0] && prefs[0].display_name) || "")
          .catch(() => "")
          .then((saved) => {
            const mine = saved || (u.full_name && u.full_name !== u.email ? u.full_name : "");
            if (key && mine && (latestRef.current.collaborator_names || {})[key] !== mine) {
              mutate((p) => ({ collaborator_names: { ...(p.collaborator_names || {}), [key]: mine } }));
            }
          });
      })
      .catch(() => setIsOwner(false));
  }, [project.created_by_id]);

  useEffect(() => {
    const unsub = ent.Project.subscribe((event) => {
      if (event.id === project.id) {
        ent.Project.get(project.id).then(onUpdate).catch(() => {});
      }
    });
    return unsub;
  }, [project.id]);

  const save = async () => {
    const updated = await ent.Project.update(project.id, {
      ...form,
      description: form.description || "",
      target_date: form.date_type === "ongoing" ? "" : form.target_date || "",
      budget_target: form.budget_target ? Number(form.budget_target) : 0,
    });
    onUpdate(updated);
    setEditing(false);
  };

  // All list edits (tasks, budget, support, notes...) go through mutate():
  // it computes the change from the LATEST project (not the render that was
  // on screen when the tap happened), shows it immediately, and saves changes
  // one at a time in order. Before this, two quick taps (e.g. ticking two
  // tasks) each started from the same stale list, so the second save wiped
  // out the first.
  const latestRef = useRef(project);
  useEffect(() => { latestRef.current = project; }, [project]);
  const queueRef = useRef(Promise.resolve());
  const mutate = (compute) => {
    const patch = compute(latestRef.current);
    if (!patch) return Promise.resolve();
    latestRef.current = { ...latestRef.current, ...patch };
    onUpdate(latestRef.current);
    queueRef.current = queueRef.current
      .then(() => ent.Project.update(project.id, patch))
      .catch(async (err) => {
        console.error("Project save failed:", err);
        alert("Couldn't save that change. Reloading the latest version.");
        try {
          const fresh = await ent.Project.get(project.id);
          latestRef.current = fresh;
          onUpdate(fresh);
        } catch { /* offline: leave as is */ }
      });
    return queueRef.current;
  };

  const deleteProject = async () => {
    if (!confirm("Delete this project?")) return;
    await ent.Project.delete(project.id);
    onBack();
  };

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportProjectPdf(project);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Something went wrong creating the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const addTask = (taskInput) =>
    mutate((p) => ({ tasks: [...(p.tasks || []), { ...taskInput, completed: false }] }));

  const toggleTask = (index) =>
    mutate((p) => {
      const t = [...(p.tasks || [])];
      if (!t[index]) return null;
      t[index] = { ...t[index], completed: !t[index].completed };
      return { tasks: t };
    });

  const reassignTask = (index, assignees) =>
    mutate((p) => {
      const t = [...(p.tasks || [])];
      if (!t[index]) return null;
      t[index] = { ...t[index], assignees, assignee: undefined };
      return { tasks: t };
    });

  const removeTask = (index) =>
    mutate((p) => ({ tasks: (p.tasks || []).filter((_, i) => i !== index) }));

  const updateTask = (index, patch) =>
    mutate((p) => {
      const t = [...(p.tasks || [])];
      if (!t[index]) return null;
      t[index] = { ...t[index], ...patch };
      return { tasks: t };
    });

  const updateAccentColor = async (hex) => {
    setAccentColor(hex);
    setCoverImage(null);
    const updated = await ent.Project.update(project.id, { accent_color: hex, cover_image_url: null, cover_image_pos: null });
    onUpdate(updated);
  };

  const uploadCoverPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setUploadError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCoverImage(file_url);
      setCoverPos(null);
      const updated = await ent.Project.update(project.id, { cover_image_url: file_url, cover_image_pos: null });
      onUpdate(updated);
    } catch (err) {
      console.error("Cover photo upload failed:", err);
      setUploadError(err.message || "Upload failed — please try again.");
    } finally {
      setUploadingCover(false);
    }
  };

  // Emails are now normalized to lowercase before storing or comparing —
  // this is what let "ruth@..." and "Ruth@..." get added as two separate
  // collaborators. The dedup check was case-sensitive, so a differently
  // capitalized retry looked like a brand new person.
  const addCollaborator = (email, name) => {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return Promise.resolve();
    const cleanName = (name || "").trim();
    return mutate((p) => {
      const list = p.collaborators || [];
      if (list.some((c) => c.toLowerCase() === normalized)) return null;
      const patch = { collaborators: [...list, normalized] };
      if (cleanName) patch.collaborator_names = { ...(p.collaborator_names || {}), [normalized]: cleanName };
      return patch;
    });
  };

  const removeCollaborator = (email) => {
    const normalized = (email || "").trim().toLowerCase();
    return mutate((p) => {
      const rest = { ...(p.collaborator_names || {}) };
      delete rest[normalized];
      return { collaborators: (p.collaborators || []).filter((c) => c.toLowerCase() !== normalized), collaborator_names: rest };
    });
  };

  const setAttachments = (attachments) => mutate(() => ({ attachments }));

  const setNotes = (notes) => mutate(() => ({ notes }));

  const expenses = project.expenses || [];
  const budgetTarget = project.budget_target || 0;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const setBudgetTarget = (target) => mutate(() => ({ budget_target: target }));

  const addExpense = (expense) => mutate((p) => ({ expenses: [...(p.expenses || []), expense] }));

  const removeExpense = (idx) => mutate((p) => ({ expenses: (p.expenses || []).filter((_, i) => i !== idx) }));

  const updateExpense = (idx, patch) =>
    mutate((p) => {
      const e = [...(p.expenses || [])];
      if (!e[idx]) return null;
      e[idx] = { ...e[idx], ...patch };
      return { expenses: e };
    });

  const reassignExpense = (idx, paidBy) => updateExpense(idx, { paid_by: paidBy });

  const contributions = project.contributions || [];

  const addContribution = (contribution) =>
    mutate((p) => ({ contributions: [...(p.contributions || []), contribution] }));

  const updateContribution = (idx, patch) =>
    mutate((p) => {
      const c = [...(p.contributions || [])];
      if (!c[idx]) return null;
      c[idx] = { ...c[idx], ...patch };
      return { contributions: c };
    });

  const removeContribution = (idx) =>
    mutate((p) => ({ contributions: (p.contributions || []).filter((_, i) => i !== idx) }));

  // Countdown / date-passed state for the hero and banner.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const daysLeft =
    project.date_type !== "ongoing" && project.target_date
      ? Math.round((parseISO(project.target_date) - todayStart) / 86400000)
      : null;
  const datePassed = daysLeft !== null && daysLeft < 0 && project.status !== "completed";
  const openTaskCount = tasks.filter((t) => !t.completed).length;
  const others = collaborators.filter((c) => !sameEmail(c, currentUserEmail));
  const AVATAR_COLORS = ["#A7773F", "#7D8A53", "#A77C81", "#6B655D", "#8A6530"];
  const avatarColor = (e) => {
    let h = 0;
    for (let i = 0; i < e.length; i++) h = e.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  };

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);

  return (
    <div className="min-h-screen bg-card">
      <div className="p-4 md:p-8 max-w-4xl mx-auto" style={{ paddingTop: "1.25rem" }}>
        <div className="rounded-[24px] p-4 mb-5 relative overflow-hidden h-[210px] flex flex-col" style={{ background: coverImage ? undefined : accentColor }}>
          {/* Action row — consolidated into a single menu instead of four
              separate floating icon buttons, matching the pattern used on
              the Trip detail page. */}
          <div className="relative z-10 flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="w-7 h-7 flex items-center justify-center text-foreground bg-white rounded-full shadow-sm hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-7 h-7 flex items-center justify-center text-foreground bg-white rounded-full shadow-sm hover:bg-secondary transition-colors"
                  aria-label="Project actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-lg">
                <DropdownMenuItem onClick={() => setShowCollabModal(true)} className="gap-2 cursor-pointer">
                  <UserPlus className="w-4 h-4" /> Add collaborator
                </DropdownMenuItem>
                {coverImage && (
                  <DropdownMenuItem onClick={() => setAdjustingCover(true)} className="gap-2 cursor-pointer">
                    <Move className="w-4 h-4" /> Adjust cover photo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setEditing(!editing)} className="gap-2 cursor-pointer">
                  <Edit2 className="w-4 h-4" /> Edit project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf} disabled={exporting} className="gap-2 cursor-pointer">
                  <FileDown className="w-4 h-4" /> {exporting ? "Exporting…" : "Export as PDF"}
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem onClick={deleteProject} className="gap-2 cursor-pointer text-rose-600 focus:text-rose-600">
                    <Trash2 className="w-4 h-4" /> Delete project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {coverImage && (
            <>
              <AdjustableImage src={coverImage} pos={coverPos} className="absolute inset-0" />
              <div className="absolute inset-0 bg-black/45" />
            </>
          )}
          {uploadingCover && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          <div className="relative flex items-center gap-1.5">
            <span
              className={`self-start font-body text-[9px] uppercase tracking-[0.14em] px-3 py-1 rounded-full border flex-shrink-0 ${
                statusColors[project.status || "planning"]
              }`}
            >
              {project.status?.replace("_", " ") || "planning"}
            </span>
            {project.category && CATEGORIES.find((c) => c.id === project.category) && (
              <span className="self-start font-body text-[9px] px-2.5 py-1 rounded-full bg-white/90 text-foreground flex-shrink-0 flex items-center gap-1">
                {(() => { const CI = CATEGORIES.find((c) => c.id === project.category).Icon; return <CI className="w-3 h-3" strokeWidth={1.6} />; })()} {CATEGORIES.find((c) => c.id === project.category).label}
              </span>
            )}
            {daysLeft !== null && project.status !== "completed" && (
              <span className="self-start ml-auto font-body text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/90 flex-shrink-0" style={{ color: daysLeft < 0 ? "#BE123C" : "#A7773F" }}>
                {daysLeft === 0 ? "Today" : daysLeft === 1 ? "1 day to go" : daysLeft > 1 ? `${daysLeft} days to go` : "Date passed"}
              </span>
            )}
          </div>

          <div className="relative mt-auto [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
            <h1 className="text-xl font-heading font-bold text-white truncate">{project.title}</h1>
            {project.date_type === "ongoing" ? (
              <>
                <div className="h-px bg-white/25 w-full my-1.5" />
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-white/80 flex-shrink-0" strokeWidth={1.8} />
                  <p className="text-white/85 text-xs">Ongoing</p>
                </div>
              </>
            ) : project.target_date && (
              <>
                <div className="h-px bg-white/25 w-full my-1.5" />
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-white/80 flex-shrink-0" strokeWidth={1.8} />
                  <p className="text-white/85 text-xs">
                    {project.date_type === "date" ? "" : "Due: "}
                    {parseISO(project.target_date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <button
            onClick={() => setShowCollabModal(true)}
            className="flex items-center gap-2 mb-4 -mt-1 text-left"
            aria-label="View collaborators"
          >
            <span className="flex -space-x-1.5">
              {others.slice(0, 4).map((c) => (
                <span
                  key={c}
                  title={nameFor(c, names)}
                  className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: avatarColor(c) }}
                >
                  {initialsOf(c, names, currentUserEmail)}
                </span>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              With {others.slice(0, 2).map((c) => nameFor(c, names).split(" ")[0]).join(", ")}
              {others.length > 2 ? ` +${others.length - 2}` : ""}
            </span>
          </button>
        )}

        {datePassed && (
          <div className="flex items-center justify-between gap-3 mb-3 rounded-xl border border-[#E6D3B0] bg-[#F3E8D6] px-3 py-2">
            <p className="text-xs text-[#8A5F27]">
              Date passed{tasks.filter((t) => !t.completed).length > 0 ? ` · ${tasks.filter((t) => !t.completed).length} task${tasks.filter((t) => !t.completed).length === 1 ? "" : "s"} still open` : ""}
            </p>
            <button
              onClick={() => {
                const n = tasks.filter((t) => !t.completed).length;
                if (n > 0 && !confirm(`${n} task${n === 1 ? " is" : "s are"} still open. Mark this project completed anyway?`)) return;
                mutate(() => ({ status: "completed" }));
              }}
              className="flex-shrink-0 text-xs font-medium"
              style={{ color: "#A7773F" }}
            >
              Mark completed
            </button>
          </div>
        )}

        <ProjectCollaborators
          open={showCollabModal}
          onClose={() => setShowCollabModal(false)}
          collaborators={collaborators}
          names={names}
          onAdd={addCollaborator}
          onRemove={removeCollaborator}
          canManage={isOwner}
          projectId={project.id}
          projectTitle={project.title}
        />

        {/* Progress + Budget — only shown when their matching tab is
            actually enabled for this project. Showing "0 of 0 tasks" on a
            project with Tasks turned off entirely was exactly the kind of
            clutter the section-visibility toggle was meant to remove. */}
        {(visibleTabs.tasks || visibleTabs.budget) && (
          <div className="bg-white border border-border rounded-2xl px-4 py-3 mb-4">
            {visibleTabs.tasks && (
              <div className={visibleTabs.budget ? "mb-3" : ""}>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{tasks.filter((t) => t.completed).length} of {tasks.length} tasks</span>
                  <span className="text-sm font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: "#A7773F" }} />
                </div>
              </div>
            )}
            {visibleTabs.budget && (
              <button onClick={() => setTab("budget")} className="w-full text-left flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate">
                  Budget · ${totalSpent.toLocaleString()} spent{budgetTarget > 0 ? ` of $${budgetTarget.toLocaleString()}` : ""}
                </span>
                <span className="flex-shrink-0 font-semibold" style={{ color: budgetTarget > 0 && totalSpent > budgetTarget ? "#BE123C" : "#2E2A27" }}>
                  {budgetTarget > 0
                    ? totalSpent > budgetTarget ? `$${(totalSpent - budgetTarget).toLocaleString()} over` : `$${(budgetTarget - totalSpent).toLocaleString()} left`
                    : "Details →"}
                </span>
              </button>
            )}
          </div>
        )}

        <ImageAdjuster open={adjustingCover} src={coverImage} pos={coverPos} aspect={16 / 7} title="Adjust cover photo" onClose={() => setAdjustingCover(false)}
          onSave={async (p) => { setCoverPos(p); try { onUpdate(await ent.Project.update(project.id, { cover_image_pos: p })); } catch (e) { console.error(e); } }} />

        {/* Edit form */}
        {editing && (
          <div className="bg-white border border-border rounded-2xl p-5 mb-6 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cover</label>
              <div className="flex items-center gap-2">
                {["#1c1917", "#A7773F", "#7D8A53", "#A77C81", "#8A6530"].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateAccentColor(hex)}
                    className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${!coverImage && accentColor === hex ? "border-foreground" : "border-white ring-1 ring-border"}`}
                    style={{ background: hex }}
                    aria-label={`Set cover color to ${hex}`}
                  />
                ))}
                <label
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-sm ring-1 ring-border transition-transform hover:scale-110"
                  style={{ background: "linear-gradient(135deg,#6E9AC4,#B87D4E)" }}
                  title="Upload a photo"
                >
                  <Upload className="w-3.5 h-3.5 text-white" />
                  <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={uploadCoverPhoto} />
                </label>
              </div>
              {uploadingCover && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
              {uploadError && <p className="text-xs text-rose-600 mt-1">{uploadError}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Project name</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date type</label>
                <select
                  value={form.date_type}
                  onChange={(e) => setForm((f) => ({ ...f, date_type: e.target.value }))}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors"
                >
                  <option value="due">Due date</option>
                  <option value="date">Event date</option>
                  <option value="ongoing">Ongoing — no date</option>
                </select>
              </div>
              {form.date_type !== "ongoing" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {form.date_type === "date" ? "Date" : "Target date"}
                  </label>
                  <DateInput
                    value={form.target_date}
                    onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Budget target ($)</label>
                <input
                  type="number"
                  value={form.budget_target}
                  onChange={(e) => setForm((f) => ({ ...f, budget_target: e.target.value }))}
                  placeholder="500"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-[#A7773F]/60 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: f.category === c.id ? "" : c.id }))}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        form.category === c.id ? "text-white" : "bg-card text-muted-foreground border border-border"
                      }`}
                      style={form.category === c.id ? { backgroundColor: "#A7773F" } : undefined}
                    >
                      <c.Icon className="w-4 h-4" strokeWidth={1.5} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Sections shown</label>
                <div className="space-y-1.5">
                  {Object.keys(DEFAULT_VISIBLE_TABS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, visible_tabs: { ...f.visible_tabs, [key]: !f.visible_tabs[key] } }))}
                      className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{TAB_LABELS[key]}</span>
                      <span
                        className="w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0"
                        style={{ backgroundColor: form.visible_tabs[key] ? "#A7773F" : "#E7E2D8" }}
                      >
                        <span
                          className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
                          style={{ left: form.visible_tabs[key] ? "18px" : "2px" }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: "#A7773F" }}
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3 inline mr-1" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs — a bit more breathing room around the labels */}
        <div className="flex gap-1.5 mb-4 bg-white border border-border rounded-xl p-1.5">
          {visibleTabs.tasks && (
            <button
              onClick={() => setTab("tasks")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
                tab === "tasks" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "tasks" ? { backgroundColor: "#A7773F" } : undefined}
            >
              <ListTodo className="w-3 h-3 flex-shrink-0" /> Tasks{openTaskCount > 0 ? ` · ${openTaskCount}` : ""}
            </button>
          )}
          {visibleTabs.resources && (
            <button
              onClick={() => setTab("resources")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
                tab === "resources" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "resources" ? { backgroundColor: "#A7773F" } : undefined}
            >
              <Sparkles className="w-3 h-3 flex-shrink-0" /> Resources
            </button>
          )}
          {visibleTabs.notes && (
            <button
              onClick={() => setTab("notes")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
                tab === "notes" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "notes" ? { backgroundColor: "#A7773F" } : undefined}
            >
              <StickyNote className="w-3 h-3 flex-shrink-0" /> Notes
            </button>
          )}
          {visibleTabs.support && (
            <button
              onClick={() => setTab("support")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
                tab === "support" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "support" ? { backgroundColor: "#A7773F" } : undefined}
            >
              <HandHeart className="w-3 h-3 flex-shrink-0" /> Support
            </button>
          )}
          {visibleTabs.budget && (
            <button
              onClick={() => setTab("budget")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
                tab === "budget" ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === "budget" ? { backgroundColor: "#A7773F" } : undefined}
            >
              <DollarSign className="w-3 h-3 flex-shrink-0" /> Budget
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="bg-white border border-border rounded-2xl p-5">
          {tab === "tasks" ? (
            <ProjectTasks
              tasks={tasks}
              collaborators={collaborators}
              names={names}
              currentEmail={currentUserEmail}
              onAdd={addTask}
              onToggle={toggleTask}
              onRemove={removeTask}
              onReassign={reassignTask}
              onAddToBudget={addExpense}
              onUpdateTask={updateTask}
            />
          ) : tab === "resources" ? (
            <ProjectResources
              attachments={project.attachments || []}
              onAttachmentsChange={setAttachments}
            />
          ) : tab === "notes" ? (
            <ProjectNotes notes={project.notes} onSave={setNotes} />
          ) : tab === "support" ? (
            <ProjectContributions
              contributions={contributions}
              onAdd={addContribution}
              onUpdate={updateContribution}
              onRemove={removeContribution}
            />
          ) : (
            <ProjectBudget
              target={budgetTarget}
              expenses={expenses}
              collaborators={collaborators}
              names={names}
              currentEmail={currentUserEmail}
              onAddExpense={addExpense}
              onRemoveExpense={removeExpense}
              onReassignExpense={reassignExpense}
              onUpdateExpense={updateExpense}
            />
          )}
        </div>
      </div>
    </div>
  );
}
