import { fetchJson } from "./http";

export type CreditsReason =
  | "signup_grant"
  | "agent_run"
  | "manual_grant"
  | "topup"
  | "refund"
  | "adjustment";

export type CreditsTransaction = {
  id: string;
  userId: string;
  delta: number;
  reason: CreditsReason;
  balanceAfter: number;
  meta: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    note?: string;
  } | null;
  createdAt: string;
};

export const getCreditsBalance = () =>
  fetchJson<{ balance: number }>("/credits/balance");

export const listCreditsTransactions = (opts: { limit?: number; offset?: number } = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return fetchJson<{ items: CreditsTransaction[]; limit: number; offset: number }>(
    `/credits/transactions${qs ? `?${qs}` : ""}`,
  );
};

export const purchaseCreditsPack = (packId: string) =>
  fetchJson<{ balance: number; packId: string }>("/credits/topup", {
    method: "POST",
    body: JSON.stringify({ packId }),
  });
