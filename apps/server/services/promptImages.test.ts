import { describe, expect, test } from "bun:test";
import { MAX_PROMPT_IMAGES, parsePromptImages } from "./promptImages";

const png = { mediaType: "image/png", data: "iVBORw0KGgo=" };

describe("parsePromptImages", () => {
  test("missing images is an empty list", () => {
    expect(parsePromptImages(undefined)).toEqual({ ok: true, images: [] });
  });

  test("keeps only mediaType and data", () => {
    expect(parsePromptImages([{ ...png, name: "x.png" }])).toEqual({ ok: true, images: [png] });
  });

  test("rejects too many images", () => {
    const r = parsePromptImages(Array(MAX_PROMPT_IMAGES + 1).fill(png));
    expect(r.ok).toBe(false);
  });

  test("rejects unsupported types and bad base64", () => {
    expect(parsePromptImages([{ mediaType: "image/svg+xml", data: png.data }]).ok).toBe(false);
    expect(parsePromptImages([{ mediaType: "image/png", data: "not base64!" }]).ok).toBe(false);
    expect(parsePromptImages([{ mediaType: "image/png", data: "data:image/png;base64,AAAA" }]).ok).toBe(false);
  });

  test("rejects oversized images", () => {
    expect(parsePromptImages([{ mediaType: "image/png", data: "A".repeat(4_000_004) }]).ok).toBe(false);
  });
});
