import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ProjectCollaborators from "@/components/projects/ProjectCollaborators";
import ProjectResources from "@/components/projects/ProjectResources";
import ProjectTasks from "@/components/projects/ProjectTasks";
import ProjectNotes from "@/components/projects/ProjectNotes";
import ProjectBudget from "@/components/projects/ProjectBudget";
import { StickyNote } from "lucide-react";
import { exportProjectPdf } from "@/lib/projectPdfExport";

const statusColors = {
  planning: "bg-amber-50 text-amber-700 border-amber-100",
  active: "bg-green-50 text-green-700 border-green-100",
  on_hold: "bg-stone-100 text-stone-500 border-stone-200",
  completed: "bg-blue-50 text-blue-700 border-blue-100",
};

export default function ProjectDetail({ project, onBack, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [accentColor, setAccentColor] = useState(project.accent_color || "#A7773F");
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [coverImage, setCoverImage] = useState(project.cover_image_url || null);
  const [form, setForm] = useState({
    title: project.title,
    description: project.description || "",
    status: project.status || "planning",
    target_date: project.target_date || "",
    budget_target: project.budget_target || "",
  });
  const [tab, setTab] = useState("tasks");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");

  const tasks = project.tasks || [];
  const collaborators = project.collaborators || [];

  useEffect(() => {
    base44.auth
      .me()
      .then((u) => {
        setIsOwner(!project.created_by_id || u.id === project.created_by_id);
        setCurrentUserEmail(u.email);
      })
      .catch(() => setIsOwner(false));
  }, [project.created_by_id]);

  useEffect(() => {
    const unsub = base44.entities.Project.subscribe((event) => {
      if (event.id === project.id) {
        base44.entities.Project.get(project.id).then(onUpdate).catch(() => {});
      }
    });
    return unsub;
  }, [project.id]);

  const save = async () => {
    const updated = await base44.entities.Project.update(project.id, {
      ...form,
      description: form.description || "",
      target_date: form.target_date || "",
      budget_target: form.budget_target ? Number(form.budget_target) : 0,
    });
    onUpdate(updated);
    setEditing(false);
  };

  const deleteProject = async () => {
    if (!confirm("Delete this project?")) return;
    await base44.entities.Project.delete(project.id);
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

  const addTask = async (taskInput) => {
    const newTasks = [...tasks, { ...taskInput, completed: false }];
    const updated = await base44.entities.Project.update(project.id, { tasks: newTasks });
    onUpdate(updated);
  };

  const toggleTask = async (index) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    const result = await base44.entities.Project.update(project.id, { tasks: updated });
    onUpdate(result);
  };

  const reassignTask = async (index, assignees) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], assignees, assignee: undefined };
    const result = await base44.entities.Project.update(project.id, { tasks: updated });
    onUpdate(result);
  };

  const removeTask = async (index) => {
    const updated = tasks.filter((_, i) => i !== index);
    const result = await base44.entities.Project.update(project.id, { tasks: updated });
    onUpdate(result);
  };

  const updateTask = async (index, patch) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], ...patch };
    const result = await base44.entities.Project.update(project.id, { tasks: updated });
    onUpdate(result);
  };

  const updateAccentColor = async (hex) => {
    setAccentColor(hex);
    setCoverImage(null);
    const updated = await base44.entities.Project.update(project.id, { accent_color: hex, cover_image_url: null });
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
      const updated = await base44.entities.Project.update(project.id, { cover_image_url: file_url });
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
  const addCollaborator = async (email) => {
    const normalized = (email || "").trim().toLowerCase();
    if (!normalized) return;
    if (collaborators.some((c) => c.toLowerCase() === normalized)) return;
    const updated = await base44.entities.Project.update(project.id, {
      collaborators: [...collaborators, normalized],
    });
    onUpdate(updated);
  };

  const removeCollaborator = async (email) => {
    const normalized = (email || "").trim().toLowerCase();
    const updated = await base44.entities.Project.update(project.id, {
      collaborators: collaborators.filter((c) => c.toLowerCase() !== normalized),
    });
    onUpdate(updated);
  };

  const setAttachments = async (attachments) => {
    const updated = await base44.entities.Project.update(project.id, { attachments });
    onUpdate(updated);
  };

  const setNotes = async (notes) => {
    const updated = await base44.entities.Project.update(project.id, { notes });
    onUpdate(updated);
  };

  const expenses = project.expenses || [];
  const budgetTarget = project.budget_target || 0;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const setBudgetTarget = async (target) => {
    const updated = await base44.entities.Project.update(project.id, { budget_target: target });
    onUpdate(updated);
  };

  const addExpense = async (expense) => {
    const updatedExpenses = [...expenses, expense];
    const updated = await base44.entities.Project.update(project.id, { expenses: updatedExpenses });
    onUpdate(updated);
  };

  const removeExpense = async (idx) => {
    const updatedExpenses = expenses.filter((_, i) => i !== idx);
    const updated = await base44.entities.Project.update(project.id, { expenses: updatedExpenses });
    onUpdate(updated);
  };

  const updateExpense = async (idx, patch) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[idx] = { ...updatedExpenses[idx], ...patch };
    const updated = await base44.entities.Project.update(project.id, { expenses: updatedExpenses });
    onUpdate(updated);
  };

  const reassignExpense = async (idx, paidBy) => {
    const updatedExpenses = [...expenses];
    updatedExpenses[idx] = { ...updatedExpenses[idx], paid_by: paidBy };
    const updated = await base44.entities.Project.update(project.id, { expenses: updatedExpenses });
    onUpdate(updated);
  };

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="p-4 md:p-8 max-w-4xl mx-auto" style={{ paddingTop: "1.25rem" }}>
        <div className="rounded-[24px] p-4 mb-5 relative overflow-hidden h-[210px] flex flex-col" style={{ background: coverImage ? undefined : accentColor }}>
          {/* Action row — consolidated into a single menu instead of four
              separate floating icon buttons, matching the pattern used on
              the Trip detail page. */}
          <div className="relative z-10 flex items-center justify-between mb-2">
            <button
              onClick={onBack}
              className="w-7 h-7 flex items-center justify-center text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-7 h-7 flex items-center justify-center text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
                  aria-label="Project actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-lg">
                <DropdownMenuItem onClick={() => setShowCollabModal(true)} className="gap-2 cursor-pointer">
                  <UserPlus className="w-4 h-4" /> Add collaborator
                </DropdownMenuItem>
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
              <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/45" />
            </>
          )}
          {uploadingCover && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          <span
            className={`relative self-start font-body text-[9px] uppercase tracking-[0.14em] px-3 py-1 rounded-full border flex-shrink-0 ${
              statusColors[project.status || "planning"]
            }`}
          >
            {project.status?.replace("_", " ") || "planning"}
          </span>

          <div className="relative mt-auto [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
            <h1 className="text-xl font-heading font-bold text-white truncate">{project.title}</h1>
            {project.target_date && (
              <>
                <div className="h-px bg-white/25 w-full my-1.5" />
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-white/80 flex-shrink-0" strokeWidth={1.8} />
                  <p className="text-white/85 text-xs">
                    Due:{" "}
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

        <ProjectCollaborators
          open={showCollabModal}
          onClose={() => setShowCollabModal(false)}
          collaborators={collaborators}
          onAdd={addCollaborator}
          onRemove={removeCollaborator}
          canManage={isOwner}
          projectId={project.id}
          projectTitle={project.title}
        />

        {/* Progress + Budget — side by side to save vertical space. Explicit
            gap (not just padding) keeps them from ever touching, even on
            narrow phone widths. Numbers kept modest (text-base, not
            text-xl+) so they don't dominate the small card. */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white border border-stone-200 rounded-2xl p-3 min-w-0">
            <p className="text-[10px] font-medium font-heading text-stone-500 mb-1">Progress</p>
            <p className="text-base font-bold text-stone-900 mb-1.5">{progress}%</p>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-green-600 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[9.5px] text-stone-400 truncate">
              {tasks.filter((t) => t.completed).length} of {tasks.length} tasks
            </p>
          </div>

          <button
            onClick={() => setTab("budget")}
            className="text-left bg-white border border-stone-200 rounded-2xl p-3 min-w-0 hover:border-stone-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1 gap-1">
              <p className="text-[10px] font-medium font-heading text-stone-500 truncate">Budget</p>
              <span className="text-[9px] font-medium flex-shrink-0" style={{ color: "#A7773F" }}>Details →</span>
            </div>
            <p className="text-base font-bold text-stone-900 mb-1.5 truncate">
              ${totalSpent.toLocaleString()}
              <span className="text-[10px] text-stone-400 font-normal ml-1">
                {budgetTarget > 0 ? `/ $${budgetTarget.toLocaleString()}` : "spent"}
              </span>
            </p>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#EFE9DF" }}>
              {budgetTarget > 0 && (
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((totalSpent / budgetTarget) * 100))}%`,
                    background: totalSpent > budgetTarget ? "#DC2626" : "#A7773F",
                  }}
                />
              )}
            </div>
          </button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 space-y-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Cover</label>
              <div className="flex items-center gap-2">
                {["#1c1917", "#A7773F", "#7D8A53", "#A77C81", "#8A6530"].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateAccentColor(hex)}
                    className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${!coverImage && accentColor === hex ? "border-stone-800" : "border-white ring-1 ring-stone-200"}`}
                    style={{ background: hex }}
                    aria-label={`Set cover color to ${hex}`}
                  />
                ))}
                <label
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-sm ring-1 ring-stone-200 transition-transform hover:scale-110"
                  style={{ background: "linear-gradient(135deg,#6E9AC4,#B87D4E)" }}
                  title="Upload a photo"
                >
                  <Upload className="w-3.5 h-3.5 text-white" />
                  <input type="file" accept="image/*,image/heic,image/heif,.heic,.heif" className="hidden" onChange={uploadCoverPhoto} />
                </label>
              </div>
              {uploadingCover && <p className="text-xs text-stone-400 mt-1">Uploading...</p>}
              {uploadError && <p className="text-xs text-rose-600 mt-1">{uploadError}</p>}
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Project name</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-stone-400 transition-colors resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-stone-400 transition-colors"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Target date</label>
                <DateInput
                  value={form.target_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-stone-400 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Budget target ($)</label>
                <input
                  type="number"
                  value={form.budget_target}
                  onChange={(e) => setForm((f) => ({ ...f, budget_target: e.target.value }))}
                  placeholder="500"
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-stone-400 transition-colors"
                />
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
                className="px-4 py-2 text-stone-500 text-sm hover:text-stone-800 transition-colors"
              >
                <X className="w-3 h-3 inline mr-1" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs — a bit more breathing room around the labels */}
        <div className="flex gap-1.5 mb-4 bg-white border border-stone-200 rounded-xl p-1.5">
          <button
            onClick={() => setTab("tasks")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "tasks" ? "text-white" : "text-stone-500 hover:text-stone-900"
            }`}
            style={tab === "tasks" ? { backgroundColor: "#A7773F" } : undefined}
          >
            <ListTodo className="w-3 h-3 flex-shrink-0" /> Tasks
          </button>
          <button
            onClick={() => setTab("resources")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "resources" ? "text-white" : "text-stone-500 hover:text-stone-900"
            }`}
            style={tab === "resources" ? { backgroundColor: "#A7773F" } : undefined}
          >
            <Sparkles className="w-3 h-3 flex-shrink-0" /> Resources
          </button>
          <button
            onClick={() => setTab("notes")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "notes" ? "text-white" : "text-stone-500 hover:text-stone-900"
            }`}
            style={tab === "notes" ? { backgroundColor: "#A7773F" } : undefined}
          >
            <StickyNote className="w-3 h-3 flex-shrink-0" /> Notes
          </button>
          <button
            onClick={() => setTab("budget")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-[12px] font-medium transition-colors ${
              tab === "budget" ? "text-white" : "text-stone-500 hover:text-stone-900"
            }`}
            style={tab === "budget" ? { backgroundColor: "#A7773F" } : undefined}
          >
            <DollarSign className="w-3 h-3 flex-shrink-0" /> Budget
          </button>
        </div>

        {/* Tab content */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          {tab === "tasks" ? (
            <ProjectTasks
              tasks={tasks}
              collaborators={collaborators}
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
          ) : (
            <ProjectBudget
              target={budgetTarget}
              expenses={expenses}
              collaborators={collaborators}
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
