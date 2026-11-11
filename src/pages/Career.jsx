import { useState, useEffect, useMemo } from "react";
import { ent } from "@/lib/freshEntities";
import DateRangePicker from "@/components/DateRangePicker";
import { Trash2, Pencil, Briefcase, Star, Award, BookOpen, BadgeCheck, TrendingUp, FileText, Settings, Plus, Upload, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CalibrationManager from "../components/career/CalibrationManager";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import PageHeader from "@/components/PageHeader";
import CareerImportSheet from "@/components/career/CareerImportSheet";
import TargetRoles from "@/components/career/TargetRoles";
import { fmtMonth, monthsBetween, spanLabel, stripHtml, sameEmployer, parseLocal, TAGS } from "@/lib/careerFormat";
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

export default function Career({ switcher = null }) {
  const [entries, setEntries] = useState([]);
  const [adding, setAdding] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [matching, setMatching] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entryType, setEntryType] = useState("job");
  const [achievementSubtype, setAchievementSubtype] = useState("milestone");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [formerly, setFormerly] = useState("");
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
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = async () => {
    const [e, cal] = await Promise.all([
      ent.CareerEntry.list("-start_date"),
      ent.PerformanceCalibration.list("-created_date"),
    ]);
    setEntries(e);
    setCalibrations(cal);
  };

  useEffect(() => { load(); }, []);

  const loadJobRatings = async (jobId) => {
    const ratings = await ent.JobRating.filter({ job_entry_id: jobId });
    setJobRatings(ratings);
  };

  const resetForm = () => {
    setTitle(""); setCompany(""); setFormerly(""); setStartDate(""); setEndDate(""); setSalary(""); setRating("");
    setRatingScale("10");
    setDescription(""); setSkillsGained(""); setNotes(""); setCurrent(false);
    setAchievementSubtype("milestone");
    setJobRatings([]);
  };

  const add = async () => {
    if (!title.trim()) return;
    const actualType = entryType === "achievement" ? achievementSubtype : entryType;
    const entry = await ent.CareerEntry.create({
      entry_type: actualType,
      title: title.trim(),
      company: company.trim() || undefined,
      formerly: (entryType === "job" && formerly.trim()) || undefined,
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
        ent.JobRating.create({
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
    setFormerly(entry.formerly || "");
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
    await ent.CareerEntry.update(editing, {
      entry_type: actualType,
      title: title.trim(),
      company: company.trim() || undefined,
      formerly: (entryType === "job" && formerly.trim()) || undefined,
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
      const existingRatings = await ent.JobRating.filter({ job_entry_id: editing });
      await Promise.all(existingRatings.map(r => ent.JobRating.delete(r.id)));
      if (jobRatings.length > 0) {
        await Promise.all(jobRatings.map(r => 
          ent.JobRating.create({
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
    await ent.CareerEntry.delete(id);
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

  const TABS = [
    { id: "review", label: "Reviews", add: "Review", type: "review", tag: "review" },
    { id: "achievement", label: "Achievements", add: "Achievement", type: "achievement", tag: "milestone" },
    { id: "education", label: "Education", add: "Education", type: "education", tag: "education" },
    { id: "custom", label: "Other", add: "Custom", type: "custom", tag: "custom" },
  ];
  const tabEntries = (id) => groupedEntries[id] || [];
  const jobs = useMemo(() => [...(groupedEntries.job || [])].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return String(b.start_date || "").localeCompare(String(a.start_date || ""));
  }), [entries]);
  const visibleJobs = showAllRoles ? jobs : jobs.slice(0, 3);

  const stats = useMemo(() => {
    if (!currentJob) return null;
    const out = [];
    const inRole = monthsBetween(currentJob.start_date);
    if (inRole !== null) out.push([spanLabel(inRole), "In role"]);
    const sameCo = jobs.filter(j => currentJob.company && j.company && sameEmployer(j, currentJob) && j.start_date);
    if (sameCo.length) {
      const earliest = sameCo.map(j => j.start_date).sort()[0];
      out.push([spanLabel(monthsBetween(earliest)), `At ${String(currentJob.company).split(/[\s(\/]/)[0]}`]);
    }
    out.push([String(jobs.length), jobs.length === 1 ? "Role" : "Roles"]);
    return out;
  }, [currentJob, jobs]);

  const toggleExpanded = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const renderCard = (e, compact = false) => {
    const isOpen = !compact || expanded.has(e.id);
    const tagKey = e.current ? "current" : (["milestone", "skill", "certification", "review", "education", "custom"].includes(e.entry_type) ? e.entry_type : null);
    const tag = tagKey ? TAGS[tagKey] : null;
    const text = stripHtml(e.description);
    const dates = (e.start_date || e.end_date) ? `${e.start_date ? fmtMonth(e.start_date) : "?"} – ${e.current ? "Present" : (e.end_date ? fmtMonth(e.end_date) : "?")}` : "";
    return (
      <div key={e.id} className="bg-card border border-border rounded-2xl p-3.5 group">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={compact ? () => toggleExpanded(e.id) : undefined}
            className={`flex-1 min-w-0 text-left ${compact ? "cursor-pointer" : "cursor-default"}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className={`text-foreground ${compact ? "font-heading text-[16px]" : "font-medium"}`}>{e.title}</p>
              {tag && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.fg }}>{e.current ? "Current" : tag.label}</span>}
            </div>
            {(e.company || dates) && (
              <p className="text-[12.5px] text-muted-foreground mt-0.5">{[e.company, dates].filter(Boolean).join(" · ")}</p>
            )}
            {isOpen && (
              <>
                {e.salary && <p className="text-sm text-foreground mt-1.5">{showPay ? `$${e.salary.toLocaleString()}` : "••••••"}</p>}
                {e.rating && <p className="text-sm mt-1.5" style={{ color: TAGS.review.fg }}>Rating: {e.rating}/{e.rating_scale || 10}</p>}
                {text && <p className={`text-sm text-foreground mt-2 ${compact ? "" : "line-clamp-3"}`}>{text}</p>}
                {e.skills_gained && e.skills_gained.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {e.skills_gained.map((s, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: TAGS.skill.bg, color: TAGS.skill.fg }}>{s}</span>)}
                  </div>
                )}
                {e.notes && <p className="text-xs text-muted-foreground mt-2">{e.notes}</p>}
              </>
            )}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => startEdit(e)} className="text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(e.id)} className="text-muted-foreground/40 hover:text-rose-400 transition-colors" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="max-w-[1200px] 2xl:max-w-[1400px] mx-auto w-full">
      {!matching && <PageHeader
        below={switcher}
        title="Career"
        subtitle="Where you've been, where you're going."
        actions={
          <button
            onClick={() => setAdding(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#A7773F] text-[#F7F3EC] hover:opacity-90 transition-opacity"
            aria-label="Add entry"
            title="Add entry"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        }
      />}
      <div className="p-4 md:p-6 lg:p-8">
      {matching ? (
        <TargetRoles screen entries={entries} currentJob={currentJob} onBack={() => { setMatching(false); window.scrollTo(0, 0); }}
          onEditCurrent={(j) => { setMatching(false); startEdit(j); }} />
      ) : (<>
      {/* Import */}
      {!adding && !editing && (
        <button onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1.5 mb-4 text-[12px] font-medium text-[#A7773F] border border-[#A7773F] rounded-full px-3.5 py-1.5 hover:bg-secondary/50 transition-colors">
          <Upload className="w-3.5 h-3.5" strokeWidth={1.8} /> Import from PDF
        </button>
      )}

      {/* Current Role Card */}
      {currentJob && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: TAGS.current.fg }}>Current role</span>
              <h2 className="font-heading text-xl text-foreground truncate mt-0.5">{currentJob.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentJob.company}{currentJob.company && currentJob.start_date ? " · " : ""}
                {currentJob.start_date && `since ${fmtMonth(currentJob.start_date)}`}
              </p>
              {stats && (
                <div className="flex gap-2 mt-3">
                  {stats.map(([value, label]) => (
                    <div key={label} className="flex-1 min-w-0 bg-background rounded-xl px-3 py-2">
                      <p className="font-heading text-[15px] text-foreground leading-tight">{value}</p>
                      <p className="text-[10.5px] text-muted-foreground truncate">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {currentJob.salary && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-base font-medium text-foreground tracking-wide">{showPay ? `$${currentJob.salary.toLocaleString()}` : "••••••"}</span>
                  <button onClick={() => setShowPay(v => !v)} className="text-[11px] text-[#A7773F] border border-[#A7773F] rounded-full px-2.5 py-0.5">{showPay ? "Hide pay" : "Show pay"}</button>
                </div>
              )}
            </div>
            <button onClick={() => startEdit(currentJob)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1" aria-label="Edit current role">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!adding && !editing && <TargetRoles entries={entries} currentJob={currentJob} onEditCurrent={startEdit} onOpen={() => { setMatching(true); window.scrollTo(0, 0); }} />}

      {/* Count tabs: only roles live in the timeline, everything else opens from here */}
      {entries.length > 0 && !adding && !editing && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4 md:mx-0 md:px-0">
          {TABS.map((t) => {
            const count = tabEntries(t.id).length;
            const tag = TAGS[t.tag];
            const on = activeTab === t.id;
            return count > 0 ? (
              <button key={t.id} onClick={() => setActiveTab(on ? null : t.id)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={on ? { background: tag.fg, color: "#fff" } : { background: tag.bg, color: tag.fg }}>
                {t.label}
                <span className="text-[10.5px] rounded-full px-1.5" style={{ background: on ? "#ffffff30" : "#ffffffaa" }}>{count}</span>
              </button>
            ) : (
              <button key={t.id} onClick={() => { resetForm(); setEntryType(t.type); setAdding(true); }}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border border-dashed border-[#A7773F]/70 text-[#A7773F]">
                + {t.add}
              </button>
            );
          })}
        </div>
      )}

      {/* Open tab list */}
      {activeTab && !adding && !editing && (
        <div className="mb-6">
          <h2 className="font-heading text-lg text-foreground mb-2">{TABS.find(t => t.id === activeTab).label}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {tabEntries(activeTab).map(e => renderCard(e))}
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {adding || editing ? (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <SelectedIcon className="w-5 h-5 text-foreground" />
            <h2 className="font-heading font-semibold text-foreground">{editing ? "Edit" : "Add"} {ENTRY_TYPES.find(t => t.id === entryType)?.label}</h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map(t => (
              <button key={t.id} type="button" onClick={() => { resetForm(); setEntryType(t.id); }}
                className={`px-3.5 py-1.5 rounded-full font-body text-[12.5px] font-medium transition-colors ${entryType === t.id ? "bg-[#A7773F] text-[#F7F3EC]" : "border border-border text-muted-foreground hover:text-foreground"}`}>
                {t.label.replace("Performance ", "").replace(" / Position", "")}
              </button>
            ))}
          </div>

          {entryType === "achievement" && (
            <div className="flex flex-wrap gap-1.5">
              {ACHIEVEMENT_SUBTYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setAchievementSubtype(t.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${achievementSubtype === t.id ? "bg-[#F0E6D6] text-[#8B6B3E] border border-[#A7773F]/40" : "border border-border text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (required)" autoFocus
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />

          {(entryType === "job" || entryType === "education") && (
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company / Institution"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
          )}
          {entryType === "job" && (
            <>
              <input value={formerly} onChange={e => setFormerly(e.target.value)} placeholder="Formerly known as (optional)"
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
              {(() => {
                if (formerly.trim() || !company.trim() || !startDate) return null;
                const here = { company, formerly };
                const start = parseLocal(startDate);
                const prev = jobs.find(j => j.id !== editing && j.company && j.end_date && !sameEmployer(j, here)
                  && (start - parseLocal(j.end_date)) / 86400000 >= -31 && (start - parseLocal(j.end_date)) / 86400000 <= 62);
                if (!prev) return null;
                return (
                  <div className="flex items-center justify-between gap-3 bg-secondary border border-border rounded-lg px-3 py-2">
                    <p className="text-xs text-foreground">Your role at {prev.company} ended just before this one. Same employer under a new name?</p>
                    <button type="button" onClick={() => setFormerly(prev.company)} className="text-xs text-[#A7773F] whitespace-nowrap">Yes, same</button>
                  </div>
                );
              })()}
            </>
          )}

          {entryType === "job" && (
            <label className="flex items-center gap-2 text-xs text-foreground bg-card border border-border rounded-lg px-3 py-2 cursor-pointer w-fit">
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
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
            </div>
          )}

          {entryType === "job" && (
            <input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Salary (optional)"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
          )}

          {(entryType === "review" || entryType === "job") && (
            <div className="flex gap-2">
              <input type="number" step="0.1" min="1" max={ratingScale} value={rating} onChange={e => setRating(e.target.value)} placeholder={`Rating (1-${ratingScale})`}
                className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
              <Select value={ratingScale} onValueChange={setRatingScale}>
                <SelectTrigger className="w-24 bg-card border-border text-foreground text-sm">
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
                <button onClick={() => setShowCalibrations(true)} className="text-xs text-[#A7773F] hover:opacity-80 flex items-center gap-1">
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
                          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors"
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
            className="bg-card rounded-lg mb-20 quill-career"
            theme="snow"
          />

          {(entryType === "job" || entryType === "achievement") && (
            <input value={skillsGained} onChange={e => setSkillsGained(e.target.value)} placeholder="Skills gained (comma-separated)"
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors" />
          )}

          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-ring transition-colors resize-none" />

          <div className="flex gap-2">
            <button onClick={editing ? saveEdit : add} className="flex-1 bg-[#A7773F] text-[#F7F3EC] py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              {editing ? "Save changes" : "Add entry"}
            </button>
            <button onClick={editing ? cancelEdit : () => setAdding(false)} className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {entries.length === 0 && !adding && !editing && (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
          <p className="font-heading text-base text-foreground mb-1">Start your career story</p>
          <p className="text-xs mb-4">Jobs, reviews, milestones, skills and more.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setAdding(true)} className="bg-[#A7773F] text-[#F7F3EC] rounded-full text-xs px-4 py-2">Add first entry</button>
            <button onClick={() => setShowImport(true)} className="border border-[#A7773F] text-[#A7773F] rounded-full text-xs px-4 py-2">Import from PDF</button>
          </div>
        </div>
      )}

      {/* Roles timeline — the 3 most recent, the rest on request */}
      {jobs.length > 0 && !adding && !editing && (
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-heading text-lg text-foreground">Roles</h2>
            {jobs.some(e => e.salary) && !currentJob && (
              <button onClick={() => setShowPay(v => !v)} className="text-[11px] text-[#A7773F] border border-[#A7773F] rounded-full px-2.5 py-0.5">{showPay ? "Hide pay" : "Show pay"}</button>
            )}
          </div>
          <div className="relative ml-1 pl-5 border-l border-border">
            {visibleJobs.map(e => (
              <div key={e.id} className="relative mb-2.5">
                <span className="absolute -left-[25px] top-5 w-[9px] h-[9px] rounded-full" style={{ background: e.current ? TAGS.current.fg : "#CFC6B8" }} />
                {renderCard(e, true)}
              </div>
            ))}
          </div>
          {jobs.length > 3 && (
            <button onClick={() => setShowAllRoles(v => !v)}
              className="mt-1 ml-1 w-[calc(100%-4px)] flex items-center justify-center gap-1.5 border border-dashed border-border rounded-xl py-2.5 text-[12.5px] font-medium text-[#A7773F]">
              {showAllRoles ? "Show fewer roles" : `Show earlier roles (${jobs.length - 3})`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllRoles ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}

      </>)}

      <CareerImportSheet open={showImport} onClose={() => setShowImport(false)} existing={entries} onDone={load} />
    </div>
    </div>
    </>
  );
}