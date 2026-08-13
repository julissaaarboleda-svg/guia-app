import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
} from "lucide-react";
import ProjectCollaborators from "@/components/projects/ProjectCollaborators";
import ProjectResources from "@/components/projects/ProjectResources";
import ProjectTasks from "@/components/projects/ProjectTasks";
import ProjectNotes from "@/components/projects/ProjectNotes";
import { StickyNote } from "lucide-react";

const statusColors = {
  planning: "bg-amber-50 text-amber-700 border-amber-100",
  active: "bg-green-50 text-green-700 border-green-100",
  on_hold: "bg-stone-100 text-stone-500 border-stone-200",
  completed: "bg-blue-50 text-blue-700 border-blue-100",
};

export default function ProjectDetail({ project, onBack, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [accentColor, setAccentColor] = useState(project.accent_color || "#1c1917");
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [coverImage, setCoverImage] = useState(project.cover_image_url || null);
  const [form, setForm] = useState({
    title: project.title,
    description: project.description || "",
    status: project.status || "planning",
    target_date: project.target_date || "",
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
        // Fallback for projects created before created_by_id was correctly
        // set (a real bug, now fixed in entities.js) — treat ownerless legacy
        // projects as owned by whoever's viewing them, rather than permanently
        // locking out editing/collaborator management on old data.
        setIsOwner(!project.created_by_id || u.id === project.created_by_id);
        setCurrentUserEmail(u.email);
      })
      .catch(() => setIsOwner(false));
  }, [project.created_by_id]);

  // Real-time sync for collaborative updates
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
    });
    onUpdate(updated);
    setEditing(false);
  };

  const deleteProject = async () => {
    if (!confirm("Delete this project?")) return;
    await base44.entities.Project.delete(project.id);
    onBack();
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

  const removeTask = async (index) => {
    const updated = tasks.filter((_, i) => i !== index);
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

  const addCollaborator = async (email) => {
    if (collaborators.includes(email)) return;
    const updated = await base44.entities.Project.update(project.id, {
      collaborators: [...collaborators, email],
    });
    onUpdate(updated);
  };

  const removeCollaborator = async (email) => {
    const updated = await base44.entities.Project.update(project.id, {
      collaborators: collaborators.filter((c) => c !== email),
    });
    onUpdate(updated);
  };

  const setAttachments = async (attachments) => {
    const updated = await base44.entities.Project.update(project.id, { attachments });
    onUpdate(updated);
  };

  const setLinks = async (links) => {
    const updated = await base44.entities.Project.update(project.id, { links });
    onUpdate(updated);
  };

  const setNotes = async (notes) => {
    const updated = await base44.entities.Project.update(project.id, { notes });
    onUpdate(updated);
  };

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="rounded-2xl p-5 mb-6 relative overflow-hidden" style={{ background: coverImage ? undefined : accentColor }}>
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
          <div className="relative flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-stone-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-heading font-bold text-white truncate">{project.title}</h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    statusColors[project.status || "planning"]
                  }`}
                >
                  {project.status?.replace("_", " ") || "planning"}
                </span>
              </div>
              {project.target_date && (
                <p className="text-stone-300 text-sm mt-0.5">
                  Due:{" "}
                  {new Date(project.target_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowCollabModal(true)}
                className="w-8 h-8 flex items-center justify-center text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
                title="Add collaborator"
              >
                <UserPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(!editing)}
                className="w-8 h-8 flex items-center justify-center text-stone-700 bg-white rounded-full shadow-sm hover:bg-stone-100 transition-colors"
                title="Edit project (cover & details)"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {isOwner && (
                <button
                  onClick={deleteProject}
                  className="w-8 h-8 flex items-center justify-center text-stone-700 bg-white rounded-full shadow-sm hover:bg-rose-500 hover:text-white transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
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

        {/* Progress */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium font-heading text-stone-500">Overall Progress</h3>
            <span className="text-lg font-bold text-stone-900">{progress}%</span>
          </div>
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 mt-2">
            {tasks.filter((t) => t.completed).length} of {tasks.length} tasks complete
          </p>
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
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
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

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white border border-stone-200 rounded-xl p-1">
          <button
            onClick={() => setTab("tasks")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "tasks"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <ListTodo className="w-4 h-4" /> Tasks
          </button>
          <button
            onClick={() => setTab("resources")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "resources"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Resources
          </button>
          <button
            onClick={() => setTab("notes")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "notes"
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <StickyNote className="w-4 h-4" /> Notes
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
            />
          ) : tab === "resources" ? (
            <ProjectResources
              attachments={project.attachments || []}
              links={project.links || []}
              onAttachmentsChange={setAttachments}
              onLinksChange={setLinks}
            />
          ) : (
            <ProjectNotes notes={project.notes} onSave={setNotes} />
          )}
        </div>
      </div>
    </div>
  );
}