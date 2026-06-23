import { del, post } from "./api.js";

export async function uploadMediaAttachment({ dataUrl, kind, mimeType, width, height, durationMs }) {
  const res = await post("/media/uploads", {
    dataUrl,
    kind,
    mimeType,
    width: width || null,
    height: height || null,
    durationMs: durationMs || null,
  });
  return res.media;
}
export async function deleteMediaAttachment(mediaRef) {
  if (!mediaRef) return { ok: true, skipped: true };
  return del(`/media/uploads/${encodeURIComponent(mediaRef)}`);
}