// Fixed-window counters held in process memory. Good enough for a single
// server instance; limits reset on restart and aren't shared across replicas.
export type RateLimiter = {
  // Seconds until the key may try again, or 0 when it's under the limit.
  retryAfter: (key: string) => number;
  hit: (key: string) => void;
  reset: (key: string) => void;
};

export const createRateLimiter = (
  opts: { limit: number; windowMs: number },
  now: () => number = Date.now,
): RateLimiter => {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const live = (key: string) => {
    const w = windows.get(key);
    if (w && w.resetAt <= now()) {
      windows.delete(key);
      return undefined;
    }
    return w;
  };

  const sweep = () => {
    const t = now();
    for (const [key, w] of windows) if (w.resetAt <= t) windows.delete(key);
  };

  return {
    retryAfter: (key) => {
      const w = live(key);
      if (!w || w.count < opts.limit) return 0;
      return Math.max(1, Math.ceil((w.resetAt - now()) / 1000));
    },
    hit: (key) => {
      if (windows.size > 10_000) sweep();
      const w = live(key);
      if (w) w.count += 1;
      else windows.set(key, { count: 1, resetAt: now() + opts.windowMs });
    },
    reset: (key) => {
      windows.delete(key);
    },
  };
};

const MINUTE = 60_000;

export const authLimits = {
  signupByIp: createRateLimiter({ limit: 5, windowMs: 60 * MINUTE }),
  loginByIp: createRateLimiter({ limit: 30, windowMs: 15 * MINUTE }),
  loginFailuresByEmail: createRateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
  passwordFailuresByUser: createRateLimiter({ limit: 10, windowMs: 15 * MINUTE }),
};
