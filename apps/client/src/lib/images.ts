export type PromptImage = { mediaType: string; data: string };

export const MAX_PROMPT_IMAGES = 4;
// Claude downsamples anything larger than this on its long edge anyway, so
// sending more pixels only costs upload time and tokens.
const MAX_EDGE = 1568;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export const toDataUrl = (img: PromptImage) => `data:${img.mediaType};base64,${img.data}`;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const prepareImage = async (file: File): Promise<PromptImage> => {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image`);
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name} is larger than 20 MB`);

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't read the image");
    ctx.drawImage(bitmap, 0, 0, width, height);
    // PNG keeps screenshots' text crisp and transparency intact; fall back to
    // JPEG when that would be heavy (usually photos).
    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    let mediaType = "image/png";
    if (!blob || blob.size > 1_500_000) {
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      mediaType = "image/jpeg";
    }
    if (!blob) throw new Error("Couldn't read the image");
    return { mediaType, data: await blobToBase64(blob) };
  } finally {
    bitmap.close();
  }
};
