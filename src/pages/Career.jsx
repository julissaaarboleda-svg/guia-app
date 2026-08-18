import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import DateRangePicker from "@/components/DateRangePicker";
import { Trash2, Pencil, Briefcase, Star, Award, BookOpen, BadgeCheck, TrendingUp, FileText, Settings, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CalibrationManager from "../components/career/CalibrationManager";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PageHeader from "@/components/PageHeader";
import DateInput from "@/components/DateInput";

const ENTRY_TYPES = [
  { id: "job", label: "Job / Position", icon: Briefcase, color: "text-foreground", description: "Track current and past roles" },
  { id: "review", label: "Performance Review", icon: Star, color: "text-amber-600", description: "Reviews, ratings, feedback" },
  { id: "achievement", label: "Achievement", icon: Award, color: "text-rose-600", description: "Milestones, skills, and certifications" },
  { id: "education", label: "Education", icon: BookOpen, color: "text-purple-600", description: "Degrees and training" },
  { id: "custom", label: "Custom", icon: FileText, color: "text-muted-foreground", description: "Anything else" },
];

const ACHIEVEMENT_SUBTYPES = [
  { id: "milestone", label: "Milestone", icon: Award, description: "Promotions, awards, project completions" },
  { id: "skill", label: "Skill", icon: TrendingUp, description: "New capabilities learned or improved" },
  { id: "certification", label: "Certification", icon: BadgeCheck, description: "Courses, credentials, certificates" },
];

export default function Career() {
  const [entries, setEntries] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entryType, setEntryType] = useState("job");
  const [achievementSubtype, setAchievementSubtype] = useState("milestone");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salary, setSalary] = useState("");
  const [rating, setRating] = useState("");
  const [ratingScale, setRatingScale] = useState("10");
  const [description, setDescription] = useState("");
  const [skillsGained, setSkillsGained] = useState("");
  const [notes, setNotes] = useState("");
  const [current, setCurrent] = useState(false);
  const [showCalibrations, setShowCalibrations] = useState(false);
  const [calibrations, setCalibrations] = useState([]);
  const [jobRatings, setJobRatings] = useState([]);

  const load = async () => {
    const [e, cal] = await Promise.all([
      base44.entities.CareerEntry.list("-start_date"),
      base44.entities.PerformanceCalibration.list("-created_date"),
    ]);
    setEntries(e);
    setCalibrations(cal);
  };

  useEffect(() => { load(); }, []);

  const loadJobRatings = async (jobId) => {
    const ratings = await base44.entities.JobRating.filter({ job_entry_id: jobId });
    setJobRatings(ratings);
  };

  const resetForm = () => {
    setTitle(""); setCompany(""); setStartDate(""); setEndDate(""); setSalary(""); setRating("");
    setRatingScale("10");
    setDescription(""); setSkillsGained(""); setNotes(""); setCurrent(false);
    setAchievementSubtype("milestone");
    setJobRatings([]);
  };

  const add = async () => {
    if (!title.trim()) return;
    const actualType = entryType === "achievement" ? achievementSubtype : entryType;
    const entry = await base44.entities.CareerEntry.create({
      entry_type: actualType,
      title: title.trim(),
      company: company.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      salary: salary ? parseFloat(salary) : undefined,
      rating: rating ? parseFloat(rating) : undefined,
      rating_scale: rating && ratingScale ? parseInt(ratingScale) : undefined,
      description: description.trim() || undefined,
      skills_gained: skillsGained.split(",").map(s => s.trim()).filter(s => s),
      notes: notes.trim() || undefined,
      current,
    });
    if (actualType === "job" && jobRatings.length > 0) {
      await Promise.all(jobRatings.map(r => 
        base44.entities.JobRating.create({
          job_entry_id: entry.id,
          calibration_name: r.calibration_name,
          rating: r.rating,
          scale_max: r.scale_max,
          notes: r.notes || undefined,
        })
      ));
    }
    resetForm(); setAdding(false); load();
  };

  const startEdit = async (entry) => {
    setEditing(entry.id);
    setEntryType(["milestone", "skill", "certification"].includes(entry.entry_type) ? "achievement" : entry.entry_type);
    setAchievementSubtype(["milestone", "skill", "certification"].includes(entry.entry_type) ? entry.entry_type : "milestone");
    setTitle(entry.title);
    setCompany(entry.company || "");
    setStartDate(entry.start_date || "");
    setEndDate(entry.end_date || "");
    setSalary(entry.salary?.toString() || "");
    setRating(entry.rating?.toString() || "");
    setRatingScale(entry.rating_scale?.toString() || "10");
    setDescription(entry.description || "");
    setSkillsGained(entry.skills_gained?.join(", ") || "");
    setNotes(entry.notes || "");
    setCurrent(entry.current || false);
    if (entry.entry_type === "job") {
      loadJobRatings(entry.id);
    }
  };

  const saveEdit = async () => {
    const actualType = entryType === "achievement" ? achievementSubtype : entryType;
    await base44.entities.CareerEntry.update(editing, {
      entry_type: actualType,
      title: title.trim(),
      company: company.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      salary: salary ? parseFloat(salary) : undefined,
      rating: rating ? parseFloat(rating) : undefined,
      rating_scale: rating && ratingScale ? parseInt(ratingScale) : undefined,
      description: description.trim() || undefined,
      skills_gained: skillsGained.split(",").map(s => s.trim()).filter(s => s),
      notes: notes.trim() || undefined,
      current,
    });
    if (actualType === "job") {
      const existingRatings = await base44.entities.JobRating.filter({ job_entry_id: editing });
      await Promise.all(existingRatings.map(r => base44.entities.JobRating.delete(r.id)));
      if (jobRatings.length > 0) {
        await Promise.all(jobRatings.map(r => 
          base44.entities.JobRating.create({
            job_entry_id: editing,
            calibration_name: r.calibration_name,
            rating: r.rating,
            scale_max: r.scale_max,
            notes: r.notes || undefined,
          })
        ));
      }
    }
    resetForm(); setEditing(null); load();
  };

  const cancelEdit = () => { resetForm(); setEditing(null); };

  const remove = async (id) => {
    await base44.entities.CareerEntry.delete(id);
    load();
  };

  const groupedEntries = ENTRY_TYPES.reduce((acc, type) => {
    if (type.id === "achievement") {
      acc[type.id] = entries.filter(e => ["milestone", "skill", "certification"].includes(e.entry_type));
    } else {
      acc[type.id] = entries.filter(e => e.entry_type === type.id);
    }
    return acc;
  }, {});

  const currentJob = entries.find(e => e.entry_type === "job" && e.current);
  const SelectedIcon = ENTRY_TYPES.find(t => t.id === entryType)?.icon || FileText;

  return (
    <>
      <div className="max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Career"
        subtitle={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        actions={
          <button
            onClick={() => setAdding(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
            aria-label="Add entry"
            title="Add entry"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        }
      />
      <div className="p-4 md:p-6 lg:p-8">
      {/* Current Role Card */}
      {currentJob && (
        <div className="bg-gradient-to-br from-foreground to-foreground text-background rounded-2xl p-4 md:p-5 mb-4 md:mb-6 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Current Role</span>
              </div>
              <h2 className="text-xl font-bold text-white truncate">{currentJob.title}</h2>
              {currentJob.company && <p className="text-muted-foreground/60 text-sm mt-1">{currentJob.company}</p>}
              <div className="flex flex-wrap gap-4 mt-3">
                {currentJob.salary && (
                  <div>
                    <p className="text-xs text-muted-foreground">Current Pay</p>
                    <p className="text-lg font-semibold text-green-400">${currentJob.salary.toLocaleString()}</p>
                  </div>
                )}
                {currentJob.start_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Started</p>
                    <p className="text-sm font-medium text-white">
                      {new Date(currentJob.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
                {currentJob.skills_gained && currentJob.skills_gained.length > 0 && (
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-xs text-muted-foreground mb-1">Key Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {currentJob.skills_gained.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-xs bg-stone-700 text-muted-foreground/40 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                      {currentJob.skills_gained.length > 3 && (
                        <span className="text-xs text-muted-foreground px-1">+{currentJob.skills_gained.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => startEdit(currentJob)} className="text-muted-foreground hover:text-white transition-colors flex-shrink-0">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}


      {/* Add/Edit form */}
      {adding ? (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <SelectedIcon className="w-5 h-5 text-foreground" />
            <h2 className="font-heading font-semibold text-stone-900">Add {ENTRY_TYPES.find(t => t.id === entryType)?.label}</h2>
          </div>

          <Select value={entryType} onValueChange={(v) => { resetForm(); setEntryType(v); }}>
            <SelectTrigger className="w-full text-sm bg-stone-50 border-border text-stone-900">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_TYPES.map(t => (
                <SelectItem key={t.id} value={t.id} className="flex items-center gap-2">
                  <span className="flex items-center gap-2"><t.icon className="w-4 h-4" /> {t.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {entryType === "achievement" && (
            <Select value={achievementSubtype} onValueChange={setAchievementSubtype}>
              <SelectTrigger className="w-full text-sm bg-stone-50 border-border text-stone-900">
                <SelectValue placeholder="Achievement type" />
              </SelectTrigger>
              <SelectContent>
                {ACHIEVEMENT_SUBTYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2"><t.icon className="w-4 h-4" /> {t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (required)" autoFocus
            className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />

          {(entryType === "job" || entryType === "education") && (
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company / Institution"
              className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />
          )}

          {entryType === "job" && (
            <label className="flex items-center gap-2 text-xs text-foreground bg-stone-50 border border-border rounded-lg px-3 py-2 cursor-pointer w-fit">
              <input type="checkbox" checked={current} onChange={e => setCurrent(e.target.checked)} /> Current role
            </label>
          )}
          {(!current || entryType !== "job") ? (
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => { setStartDate(s); setEndDate(e); }}
              placeholder="Select date range"
            />
          ) : (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start date</label>
              <DateInput value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />
            </div>
          )}

          {entryType === "job" && (
            <input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Salary (optional)"
              className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />
          )}

          {(entryType === "review" || entryType === "job") && (
            <div className="flex gap-2">
              <input type="number" step="0.1" min="1" max={ratingScale} value={rating} onChange={e => setRating(e.target.value)} placeholder={`Rating (1-${ratingScale})`}
                className="flex-1 bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />
              <Select value={ratingScale} onValueChange={setRatingScale}>
                <SelectTrigger className="w-24 bg-stone-50 border-border text-stone-900 text-sm">
                  <SelectValue placeholder="Scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">1-5</SelectItem>
                  <SelectItem value="10">1-10</SelectItem>
                  <SelectItem value="100">1-100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {entryType === "job" && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Performance Calibrations</h3>
                <button onClick={() => setShowCalibrations(true)} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Manage
                </button>
              </div>
              <CalibrationManager
                isOpen={showCalibrations}
                onClose={() => setShowCalibrations(false)}
                calibrations={calibrations}
                onRefresh={load}
              />
              {calibrations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No calibrations set. Click Manage to add custom ratings.</p>
              ) : (
                <div className="space-y-2">
                  {calibrations.map((cal, idx) => {
                    const existingRating = jobRatings.find(r => r.calibration_name === cal.name);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <label className="text-xs text-foreground w-24">{cal.name}</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max={cal.scale_max}
                          value={existingRating?.rating?.toString() || ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== null) {
                              setJobRatings(prev => {
                                const updated = prev.filter(r => r.calibration_name !== cal.name);
                                return [...updated, { calibration_name: cal.name, rating: val, scale_max: cal.scale_max, notes: "" }];
                              });
                            } else {
                              setJobRatings(prev => prev.filter(r => r.calibration_name !== cal.name));
                            }
                          }}
                          placeholder={`1-${cal.scale_max}`}
                          className="flex-1 bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors"
                        />
                        <span className="text-xs text-muted-foreground w-12">/ {cal.scale_max}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <ReactQuill
            value={description}
            onChange={setDescription}
            placeholder="Description (optional)"
            className="bg-stone-50 rounded-lg mb-20 quill-career"
            theme="snow"
          />

          {(entryType === "job" || entryType === "achievement") && (
            <input value={skillsGained} onChange={e => setSkillsGained(e.target.value)} placeholder="Skills gained (comma-separated)"
              className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors" />
          )}

          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            className="w-full bg-stone-50 border border-border rounded-lg px-3 py-2 text-stone-900 text-sm outline-none focus:border-ring transition-colors resize-none" />

          <div className="flex gap-2">
            <button onClick={editing ? saveEdit : add} className="flex-1 bg-foreground text-background py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              {editing ? "Save changes" : "Add entry"}
            </button>
            <button onClick={editing ? cancelEdit : () => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Entries grouped by type */}
      {entries.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-medium text-foreground mb-1">No career entries yet</p>
          <p className="text-xs">Track jobs, reviews, milestones, skills, and more</p>
        </div>
      )}

      <div className="space-y-6">
        {ENTRY_TYPES.map(type => {
          const typeEntries = groupedEntries[type.id];
          if (!typeEntries || typeEntries.length === 0) return null;
          const Icon = type.icon;

          return (
            <div key={type.id}>
              <h2 className="font-heading text-sm text-muted-foreground font-medium mb-3 flex items-center gap-2">
                <Icon className="w-4 h-4" /> {type.label} ({typeEntries.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {typeEntries.map(e => (
                  <div key={e.id} className="bg-card border border-border rounded-xl p-4 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-stone-900 truncate">{e.title}</p>
                          {e.current && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>}
                        </div>
                        {e.company && <p className="text-sm text-muted-foreground">{e.company}</p>}
                        {(e.start_date || e.end_date) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {e.start_date ? new Date(e.start_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "?"}
                            {" - "}
                            {e.current ? "Present" : (e.end_date ? new Date(e.end_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "?")}
                          </p>
                        )}
                        {e.salary && <p className="text-sm text-foreground mt-1">${e.salary.toLocaleString()}</p>}
                        {e.rating && <p className="text-sm text-amber-600 mt-1">Rating: {e.rating}/{e.rating_scale || 10}</p>}
                        {e.description && <p className="text-sm text-foreground mt-2 line-clamp-2">{e.description}</p>}
                        {e.skills_gained && e.skills_gained.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {e.skills_gained.map((s, i) => <span key={i} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full">{s}</span>)}
                          </div>
                        )}
                        {e.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{e.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                        <button onClick={() => startEdit(e)} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(e.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
    </>
  );
}