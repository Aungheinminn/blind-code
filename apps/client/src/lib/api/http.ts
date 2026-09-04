export const SERVER_HTTP = import.meta.env.VITE_SERVER_HTTP ?? "http://localhost:3001";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
  const parsed = text ? (JSON.parse(text) as { data?: T; error?: string; warning?: string }) : null;
  if (!res.ok) {
    throw new HttpError(res.status, parsed?.error ?? `${res.status} ${res.statusText}`);
  }
  if (parsed?.warning) console.warn(`[api] ${path}: ${parsed.warning}`);
  return (parsed?.data as T) ?? (null as T);
};
