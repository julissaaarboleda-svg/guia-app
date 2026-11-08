import { base44 } from "@/api/base44Client";
import { fmtMonth } from "@/lib/careerFormat";

// ---------- text helpers ----------
export function htmlToLines(html) {
  return String(html || "")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–*·]+/, "").trim())
    .filter(Boolean);
}

const isJob = (e) => e.entry_type === "job";
const sortJobs = (a, b) => (a.current !== b.current ? (a.current ? -1 : 1) : String(b.start_date || "").localeCompare(String(a.start_date || "")));
const dates = (e) => `${fmtMonth(e.start_date)}${e.start_date ? " – " : ""}${e.current ? "Present" : fmtMonth(e.end_date)}`;

// A plain-text picture of the person's career, used as the AI's only source of truth.
export function buildProfileText(entries) {
  const jobs = entries.filter(isJob).sort(sortJobs);
  const lines = [];
  jobs.forEach((j) => {
    lines.push(`JOB id=${j.id}: ${j.title}${j.company ? ` at ${j.company}` : ""} (${dates(j)})`);
    htmlToLines(j.description).forEach((l) => lines.push(`  - ${l}`));
    if (j.skills_gained?.length) lines.push(`  skills: ${j.skills_gained.join(", ")}`);
  });
  const rest = entries.filter((e) => !isJob(e));
  rest.forEach((e) => {
    lines.push(`${String(e.entry_type).toUpperCase()}: ${e.title}${e.company ? ` (${e.company})` : ""}${e.description ? ` — ${htmlToLines(e.description).join("; ")}` : ""}`);
    if (e.skills_gained?.length) lines.push(`  skills: ${e.skills_gained.join(", ")}`);
  });
  return lines.join("\n");
}

// ---------- AI ----------
export async function analyzePosting(entries, posting) {
  const profile = buildProfileText(entries);
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a careful resume coach. Compare a job posting with the candidate's career profile.

RULES
- The PROFILE is the only source of truth. Never invent employers, titles, tools, numbers or achievements. Only reword or reorder facts that are in the profile.
- If a strong bullet would normally include a metric the profile doesn't give, write "[add your number]" in the text and set needs_number to true.
- "before" must be an exact existing bullet from the profile (copy it exactly), or "" when adding something new.
- target is "summary", "skills", or the id of the JOB the bullet belongs to.
- Suggest at most 6 edits, most valuable first. Include one "summary" edit (a 2-sentence professional summary tailored to the posting, using only profile facts).
- For "skills" the after is a comma-separated list of skills the profile supports that the posting asks for.
- missing = important requirements from the posting that the profile doesn't show. can_claim=true if the profile hints the person likely has it (so they could add it), false if it's a real gap.
- score is 0-100: how well the profile matches the posting's requirements (skills, scope, seniority, domain). Be honest, not generous.

PROFILE:
${profile}

JOB POSTING:
${posting.slice(0, 9000)}

Respond as JSON:
{"score":0,"summary":"one or two sentences","have":["matched requirement"],"missing":[{"skill":"","can_claim":false}],"suggestions":[{"id":"s1","target":"","section":"short label","before":"","after":"","needs_number":false,"reason":"why"}]}`,
    response_json_schema: { type: "object" },
  });
  const score = Math.max(0, Math.min(100, Math.round(Number(res.score) || 0)));
  return {
    score,
    summary: res.summary || "",
    have: Array.isArray(res.have) ? res.have : [],
    missing: Array.isArray(res.missing) ? res.missing.map((m) => (typeof m === "string" ? { skill: m, can_claim: false } : m)) : [],
    suggestions: (Array.isArray(res.suggestions) ? res.suggestions : []).slice(0, 6).map((s, i) => ({ ...s, id: s.id || `s${i + 1}` })),
  };
}

export async function writeCoverLetter(entries, role, applied) {
  const profile = buildProfileText(entries);
  const extra = Object.values(applied || {}).filter(Boolean).join("\n");
  const text = await base44.integrations.Core.InvokeLLM({
    prompt: `Write a concise, warm, professional cover letter (about 220-280 words, 3 short paragraphs) for the role "${role.title}"${role.company ? ` at ${role.company}` : ""}.
Use ONLY facts from the PROFILE. Never invent numbers, employers or achievements. Connect the candidate's real experience to what the posting asks for. No placeholders except where a fact is truly missing; start with "Dear Hiring Team," and end with "Sincerely," followed by nothing else.

PROFILE:
${profile}

APPROVED RESUME WORDING (prefer these phrasings):
${extra || "(none)"}

JOB POSTING:
${(role.posting || "").slice(0, 8000)}`,
  });
  return String(text || "").trim();
}

// ---------- resume model ----------
export function buildResume(entries, role) {
  const applied = role?.applied || {};
  const sugg = role?.analysis?.suggestions || [];
  const jobs = entries.filter(isJob).sort(sortJobs).map((j) => {
    let bullets = htmlToLines(j.description);
    sugg.filter((s) => s.target === j.id && applied[s.id] != null).forEach((s) => {
      const after = applied[s.id];
      const idx = bullets.findIndex((b) => b.trim() === String(s.before || "").trim());
      if (idx >= 0) bullets[idx] = after; else bullets = [after, ...bullets];
    });
    return { id: j.id, title: j.title, company: j.company || "", dates: dates(j), bullets, changed: sugg.filter((s) => s.target === j.id && applied[s.id] != null).map((s) => applied[s.id]) };
  });
  const skillSet = [];
  entries.forEach((e) => (e.skills_gained || []).forEach((s) => { if (s && !skillSet.some((x) => x.toLowerCase() === s.toLowerCase())) skillSet.push(s); }));
  sugg.filter((s) => s.target === "skills" && applied[s.id] != null).forEach((s) =>
    String(applied[s.id]).split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!skillSet.some((y) => y.toLowerCase() === x.toLowerCase())) skillSet.push(x); }));
  const summarySug = sugg.find((s) => s.target === "summary");
  return {
    summary: summarySug && applied[summarySug.id] != null ? applied[summarySug.id] : "",
    jobs,
    skills: skillSet,
    education: entries.filter((e) => e.entry_type === "education").map((e) => ({ title: e.title, org: e.company || "", dates: dates(e) })),
    certs: entries.filter((e) => e.entry_type === "certification").map((e) => e.title),
  };
}

// ---------- export: PDF ----------
export async function exportResumePdf(resume, header, filename = "resume") {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, M = 54, CW = W - M * 2;
  let y = M;
  const need = (h) => { if (y + h > 792 - M) { doc.addPage(); y = M; } };
  const text = (str, { size = 10.5, bold = false, color = "#2E2A27", indent = 0, gap = 3, font = "helvetica" } = {}) => {
    doc.setFont(font, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(str, CW - indent);
    lines.forEach((l) => { need(size * 1.3); doc.text(l, M + indent, y); y += size * 1.3; });
    y += gap;
  };
  const section = (label) => {
    y += 6; need(24);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor("#A7773F"); doc.text(label.toUpperCase(), M, y); y += 4;
    doc.setDrawColor("#E4DFD5"); doc.line(M, y, W - M, y); y += 14;
  };
  text(header.name || "Your Name", { size: 20, bold: true, font: "times", gap: 2 });
  const contact = [header.location, header.email, header.phone].filter(Boolean).join("  ·  ");
  if (contact) text(contact, { size: 9.5, color: "#6B655D", gap: 6 });
  if (resume.summary) { section("Summary"); text(resume.summary); }
  if (resume.jobs.length) {
    section("Experience");
    resume.jobs.forEach((j) => {
      text(`${j.title}${j.company ? ` — ${j.company}` : ""}`, { bold: true, gap: 0 });
      text(j.dates, { size: 9.5, color: "#6B655D", gap: 3 });
      j.bullets.forEach((b) => text(`•  ${b}`, { indent: 10, gap: 1 }));
      y += 6;
    });
  }
  if (resume.skills.length) { section("Skills"); text(resume.skills.join("  ·  ")); }
  if (resume.education.length) { section("Education"); resume.education.forEach((e) => text(`${e.title}${e.org ? ` — ${e.org}` : ""}${e.dates ? `  (${e.dates})` : ""}`, { gap: 2 })); }
  if (resume.certs.length) { section("Certifications"); resume.certs.forEach((c) => text(c, { gap: 2 })); }
  doc.save(`${filename}.pdf`);
}

export async function exportLetterPdf(letter, header, filename = "cover-letter") {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const M = 72, CW = 612 - M * 2; let y = M;
  doc.setFont("times", "bold"); doc.setFontSize(16); doc.text(header.name || "", M, y); y += 20;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor("#6B655D");
  const contact = [header.location, header.email, header.phone].filter(Boolean).join("  ·  ");
  if (contact) { doc.text(contact, M, y); y += 28; }
  doc.setTextColor("#2E2A27"); doc.setFontSize(11);
  letter.split(/\n/).forEach((para) => {
    const lines = doc.splitTextToSize(para || " ", CW);
    lines.forEach((l) => { if (y > 792 - M) { doc.addPage(); y = M; } doc.text(l, M, y); y += 15; });
  });
  doc.save(`${filename}.pdf`);
}

// ---------- export: Word ----------
async function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportResumeDocx(resume, header, filename = "resume") {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import("docx");
  const p = (children, opts = {}) => new Paragraph({ children, spacing: { after: 60 }, ...opts });
  const head = (label) => new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), bold: true, color: "A7773F", size: 20 })], spacing: { before: 200, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E4DFD5", space: 2 } } });
  const kids = [
    p([new TextRun({ text: header.name || "Your Name", bold: true, size: 40, font: "Georgia" })]),
    p([new TextRun({ text: [header.location, header.email, header.phone].filter(Boolean).join("  ·  "), color: "6B655D", size: 19 })]),
  ];
  if (resume.summary) { kids.push(head("Summary"), p([new TextRun({ text: resume.summary, size: 21 })])); }
  if (resume.jobs.length) {
    kids.push(head("Experience"));
    resume.jobs.forEach((j) => {
      kids.push(p([new TextRun({ text: `${j.title}${j.company ? ` — ${j.company}` : ""}`, bold: true, size: 21 })], { spacing: { before: 100, after: 0 } }));
      kids.push(p([new TextRun({ text: j.dates, color: "6B655D", size: 19 })]));
      j.bullets.forEach((b) => kids.push(new Paragraph({ children: [new TextRun({ text: b, size: 21 })], bullet: { level: 0 }, spacing: { after: 30 } })));
    });
  }
  if (resume.skills.length) kids.push(head("Skills"), p([new TextRun({ text: resume.skills.join("  ·  "), size: 21 })]));
  if (resume.education.length) { kids.push(head("Education")); resume.education.forEach((e) => kids.push(p([new TextRun({ text: `${e.title}${e.org ? ` — ${e.org}` : ""}${e.dates ? `  (${e.dates})` : ""}`, size: 21 })]))); }
  if (resume.certs.length) { kids.push(head("Certifications")); resume.certs.forEach((c) => kids.push(p([new TextRun({ text: c, size: 21 })]))); }
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }] });
  await saveBlob(await Packer.toBlob(doc), `${filename}.docx`);
}

export async function exportLetterDocx(letter, header, filename = "cover-letter") {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const kids = [
    new Paragraph({ children: [new TextRun({ text: header.name || "", bold: true, size: 32, font: "Georgia" })] }),
    new Paragraph({ children: [new TextRun({ text: [header.location, header.email, header.phone].filter(Boolean).join("  ·  "), color: "6B655D", size: 19 })], spacing: { after: 300 } }),
    ...letter.split(/\n/).map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 22 })], spacing: { after: 160 } })),
  ];
  await saveBlob(await Packer.toBlob(new Document({ sections: [{ children: kids }] })), `${filename}.docx`);
}
