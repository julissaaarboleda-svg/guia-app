import jsPDF from "jspdf";
import { parseISO } from "date-fns";

const CHARCOAL = "#2E2A27";
const COGNAC = "#A7773F";
const OLIVE = "#7D8A53";
const MUTED = "#8E8A84";
const LINE = "#E4DFD5";

function isImageAttachment(att) {
  const name = (att.name || att.url || "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|svg)$/.test(name) || (att.type || "").startsWith("image/");
}

async function toDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// project.notes might be a single rich-text object (like the trip Wish List's
// {format, content} shape used elsewhere in this app) rather than an array
// of multiple notes. Calling .forEach() on a plain object throws and crashes
// the whole export before it ever reaches doc.save() — this normalizes
// either shape into a list so the export can't fail on this regardless of
// which one the data actually is.
function normalizeNotes(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    return [{ title: "Notes", content: raw }];
  }
  if (raw && typeof raw === "object" && (raw.content || raw.format)) {
    return [{ title: "Notes", content: raw.content || "" }];
  }
  return [];
}

export async function exportProjectPdf(project) {
  const doc = new jsPDF({ unit: "in", format: "letter" });
  const W = 8.5;
  const coverH = 3.1;
  let y;

  const sectionHeader = (label, yPos) => {
    doc.setTextColor(OLIVE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), 0.6, yPos);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.007);
    doc.line(0.6, yPos + 0.05, W - 0.6, yPos + 0.05);
    return yPos + 0.3;
  };

  // ---- Cover ----
  const coverDataUrl = project.cover_image_url ? await toDataUrl(project.cover_image_url) : null;
  if (coverDataUrl) {
    try {
      doc.addImage(coverDataUrl, "JPEG", 0, 0, W, coverH, undefined, "FAST");
    } catch {
      doc.setFillColor(project.accent_color || COGNAC);
      doc.rect(0, 0, W, coverH, "F");
    }
  } else {
    doc.setFillColor(project.accent_color || COGNAC);
    doc.rect(0, 0, W, coverH, "F");
  }

  if (doc.setGState && doc.GState) {
    doc.setGState(new doc.GState({ opacity: 0.68 }));
    doc.setFillColor(CHARCOAL);
    doc.rect(0, coverH * 0.45, W, coverH * 0.55, "F");
    doc.setGState(new doc.GState({ opacity: 1 }));
  } else {
    doc.setFillColor(CHARCOAL);
    doc.rect(0, coverH - 0.95, W, 0.95, "F");
  }

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("G U Í A", 0.6, 0.5);

  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.text(project.title || "Untitled project", 0.6, coverH - 0.55, { maxWidth: W - 1.2 });

  if (project.date_type !== "ongoing" && project.target_date) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor("#E8DFD2");
    const dateStr = parseISO(project.target_date).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    doc.text(dateStr, 0.6, coverH - 0.28);
  } else if (project.date_type === "ongoing") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor("#E8DFD2");
    doc.text("Ongoing", 0.6, coverH - 0.28);
  }

  y = coverH + 0.4;

  if (project.description?.trim()) {
    doc.setTextColor(CHARCOAL);
    doc.setFont("times", "italic");
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(project.description.trim(), W - 1.2);
    doc.text(lines, 0.6, y);
    y += lines.length * 0.2 + 0.25;
  }

  // ---- Tasks ----
  const tasks = project.tasks || [];
  const doneCount = tasks.filter((t) => t.completed).length;
  y = sectionHeader(`Tasks  ·  ${doneCount} of ${tasks.length} complete`, y);
  if (tasks.length === 0) {
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("No tasks yet.", 0.6, y);
    y += 0.3;
  } else {
    tasks.forEach((t) => {
      doc.setDrawColor(MUTED);
      doc.setLineWidth(0.012);
      doc.circle(0.72, y - 0.03, 0.06, "S");
      doc.setTextColor(t.completed ? MUTED : CHARCOAL);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(t.title || "Untitled task", 0.92, y);
      y += 0.24;
    });
  }
  y += 0.15;

  // ---- Resources ----
  const attachments = project.attachments || [];
  const links = Array.isArray(project.links) ? project.links : [];
  y = sectionHeader("Resources", y);

  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter((a) => !isImageAttachment(a));

  if (imageAttachments.length > 0) {
    const thumb = 0.75;
    const gap = 0.12;
    let x = 0.6;
    const rowLabels = [];
    for (let i = 0; i < imageAttachments.length; i++) {
      if (x + thumb > W - 0.6) { x = 0.6; y += thumb + 0.3; }
      const dataUrl = await toDataUrl(imageAttachments[i].url);
      if (dataUrl) {
        try { doc.addImage(dataUrl, "JPEG", x, y, thumb, thumb, undefined, "FAST"); } catch {}
      }
      rowLabels.push({ x, name: imageAttachments[i].name || "photo" });
      x += thumb + gap;
    }
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    rowLabels.forEach((r) => doc.text(r.name, r.x, y + thumb + 0.13, { maxWidth: thumb }));
    y += thumb + 0.3;
  }

  if (fileAttachments.length > 0) {
    doc.setTextColor(CHARCOAL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Files", 0.6, y);
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(fileAttachments.map((a) => a.name).join("   ·   "), 1.15, y, { maxWidth: W - 1.75 });
    y += 0.24;
  }

  if (links.length > 0) {
    doc.setTextColor(CHARCOAL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Links", 0.6, y);
    doc.setTextColor(COGNAC);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    links.forEach((l) => { doc.text(l.url, 1.15, y, { maxWidth: W - 1.75 }); y += 0.2; });
    y += 0.04;
  }

  if (attachments.length === 0 && links.length === 0) {
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("No resources yet.", 0.6, y);
    y += 0.3;
  }
  y += 0.2;

  // ---- Notes ----
  const notes = normalizeNotes(project.notes);
  y = sectionHeader("Notes", y);
  if (notes.length === 0) {
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("No notes yet.", 0.6, y);
    y += 0.3;
  } else {
    notes.forEach((n) => {
      const title = n.title || (typeof n === "string" ? n : "Untitled note");
      const preview = (n.content || "").replace(/<[^>]+>/g, "").slice(0, 90);
      doc.setTextColor(CHARCOAL);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(title, 0.6, y);
      y += 0.17;
      if (preview) {
        doc.setTextColor(MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(preview + (preview.length === 90 ? "…" : ""), 0.6, y, { maxWidth: W - 1.2 });
        y += 0.22;
      }
      y += 0.1;
    });
  }
  y += 0.1;

  // ---- Collaborators ----
  const collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
  y = sectionHeader("Collaborators", y);
  const people = ["You (owner)", ...collaborators];
  people.forEach((p) => {
    doc.setFillColor(COGNAC);
    doc.circle(0.72, y - 0.03, 0.13, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text((p[0] || "?").toUpperCase(), 0.72, y, { align: "center" });
    doc.setTextColor(CHARCOAL);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(p, 0.95, y);
    y += 0.26;
  });

  // ---- Footer ----
  doc.setDrawColor(LINE);
  doc.line(0.6, 10.6, W - 0.6, 10.6);
  doc.setTextColor(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Exported from Guía  ·  Clarity to navigate. Freedom to be you.", 0.6, 10.75);

  const fileName = (project.title || "project").replace(/[^a-z0-9]/gi, "_");
  doc.save(`${fileName}.pdf`);
}
