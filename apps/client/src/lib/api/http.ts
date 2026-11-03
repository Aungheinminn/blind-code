export const SERVER_HTTP = import.meta.env.VITE_SERVER_HTTP ?? "http://localhost:3001";

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${SERVER_HTTP}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as { data?: T; error?: string; code?: string; warning?: string }) : null;
  if (!res.ok) {
    throw new HttpError(
      res.status,
      parsed?.error ?? `${res.status} ${res.statusText}`,
      parsed?.code,
    );
  }
  if (parsed?.warning) console.warn(`[api] ${path}: ${parsed.warning}`);
  return (parsed?.data as T) ?? (null as T);
};
