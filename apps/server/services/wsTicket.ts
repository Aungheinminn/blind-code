const TTL_MS = 60_000;

type Entry = { userId: string; expiresAt: number };

const tickets = new Map<string, Entry>();

const sweep = () => {
  const now = Date.now();
  for (const [t, e] of tickets) if (e.expiresAt <= now) tickets.delete(t);
};

const randomTicket = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const mintTicket = (userId: string): { ticket: string; expiresAt: number } => {
  sweep();
  const ticket = randomTicket();
  const expiresAt = Date.now() + TTL_MS;
  tickets.set(ticket, { userId, expiresAt });
  return { ticket, expiresAt };
};

export const consumeTicket = (ticket: string): string | null => {
  sweep();
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.userId;
};
