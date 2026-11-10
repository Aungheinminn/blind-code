export type PromptImage = { mediaType: string; data: string };

export const MAX_PROMPT_IMAGES = 4;
// Base64 characters, not bytes. The client downscales before sending so real
// images are far smaller; the caps keep one run message under Bun's 16 MB
// websocket frame limit.
const MAX_IMAGE_CHARS = 4_000_000;
const MAX_TOTAL_CHARS = 12_000_000;
const MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const parsePromptImages = (
  raw: unknown,
): { ok: true; images: PromptImage[] } | { ok: false; error: string } => {
  if (raw === undefined || raw === null) return { ok: true, images: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "images must be an array" };
  if (raw.length > MAX_PROMPT_IMAGES) {
    return { ok: false, error: `at most ${MAX_PROMPT_IMAGES} images per prompt` };
  }
  const images: PromptImage[] = [];
  let total = 0;
  for (const item of raw) {
    const { mediaType, data } = (item ?? {}) as Record<string, unknown>;
    if (typeof mediaType !== "string" || !MEDIA_TYPES.has(mediaType)) {
      return { ok: false, error: "images must be PNG, JPEG, WebP or GIF" };
    }
    if (typeof data !== "string" || data.length % 4 !== 0 || !BASE64.test(data)) {
      return { ok: false, error: "image data must be base64" };
    }
    if (data.length > MAX_IMAGE_CHARS) return { ok: false, error: "image is too large" };
    total += data.length;
    if (total > MAX_TOTAL_CHARS) return { ok: false, error: "images are too large in total" };
    images.push({ mediaType, data });
  }
  return { ok: true, images };
};
