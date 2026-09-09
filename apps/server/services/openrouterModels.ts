import type { ModelInfo, ModelTag } from "./modelCatalog";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const TTL_MS = 60 * 60 * 1000;

export type OpenRouterModel = ModelInfo & {
  contextLength: number | null;
  promptPrice: number | null;
};

type Cache = {
  data: OpenRouterModel[];
  fetchedAt: number;
};

let cache: Cache | null = null;
let inflight: Promise<OpenRouterModel[]> | null = null;

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  architecture?: {
    input_modalities?: unknown;
    modality?: unknown;
  };
  pricing?: {
    prompt?: unknown;
  };
};

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);
const asNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const deriveTags = (raw: RawModel, id: string): ModelTag[] => {
  const tags: ModelTag[] = [];
  if (id.endsWith(":free")) tags.push("free");
  const inputs = raw.architecture?.input_modalities;
  const modality = raw.architecture?.modality;
  const hasImage =
    (Array.isArray(inputs) && inputs.includes("image")) ||
    (typeof modality === "string" && modality.includes("image"));
  if (hasImage) tags.push("vision");
  const lower = id.toLowerCase();
  if (
    lower.includes("reasoning") ||
    /\br1\b/.test(lower) ||
    /\bo[13]\b/.test(lower) ||
    lower.includes("thinking")
  ) {
    tags.push("reasoning");
  }
  return tags;
};

const normalize = (raw: RawModel): OpenRouterModel | null => {
  const id = asString(raw.id);
  if (!id) return null;
  const label = asString(raw.name) ?? id;
  const contextLength = asNumber(raw.context_length);
  const promptPrice = asNumber(raw.pricing?.prompt);
  const tags = deriveTags(raw, id);
  return {
    id,
    label,
    tags: tags.length > 0 ? tags : undefined,
    contextLength,
    promptPrice,
  };
};

const fetchFromOpenRouter = async (): Promise<OpenRouterModel[]> => {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`OpenRouter /models responded ${res.status}`);
  }
  const body = (await res.json()) as { data?: RawModel[] };
  const list = Array.isArray(body.data) ? body.data : [];
  const models = list
    .map(normalize)
    .filter((m): m is OpenRouterModel => m !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
  return models;
};

export const getOpenRouterModels = async (
  opts: { forceRefresh?: boolean } = {},
): Promise<{ models: OpenRouterModel[]; fetchedAt: number }> => {
  const now = Date.now();
  if (!opts.forceRefresh && cache && now - cache.fetchedAt < TTL_MS) {
    return { models: cache.data, fetchedAt: cache.fetchedAt };
  }
  if (!opts.forceRefresh && inflight) {
    const models = await inflight;
    return { models, fetchedAt: cache?.fetchedAt ?? Date.now() };
  }
  inflight = fetchFromOpenRouter()
    .then((models) => {
      cache = { data: models, fetchedAt: Date.now() };
      return models;
    })
    .finally(() => {
      inflight = null;
    });
  const models = await inflight;
  return { models, fetchedAt: cache!.fetchedAt };
};
