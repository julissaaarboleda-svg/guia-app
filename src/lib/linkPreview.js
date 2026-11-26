import { base44 } from "@/api/base44Client";

// Build a saved-link attachment with a preview (title, maker, cover image).
// The cover is copied into Guía's own storage, since social image links expire.
export async function linkAttachment(url) {
  const base = { type: "link", url, name: url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60), preview_checked: true };
  try {
    const p = await base44.integrations.Core.LinkPreview({ url });
    let thumb_url = null;
    if (p.image?.data) {
      const bytes = Uint8Array.from(atob(p.image.data), (c) => c.charCodeAt(0));
      const ext = (p.image.mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([bytes], `link-cover.${ext}`, { type: p.image.mimeType }) });
      thumb_url = file_url;
    }
    return { ...base, title: p.title || "", author: p.author || "", site: p.site || "", kind: p.kind || "web", is_video: !!p.isVideo, thumb_url };
  } catch {
    return base;
  }
}
