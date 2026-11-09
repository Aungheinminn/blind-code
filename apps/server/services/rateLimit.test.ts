import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  test("blocks after the limit until the window passes", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 10_000 }, () => t);
    rl.hit("a");
    expect(rl.retryAfter("a")).toBe(0);
    rl.hit("a");
    expect(rl.retryAfter("a")).toBe(10);
    t = 4_000;
    expect(rl.retryAfter("a")).toBe(6);
    t = 10_000;
    expect(rl.retryAfter("a")).toBe(0);
  });

  test("keys are independent and reset clears one", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000 }, () => 0);
    rl.hit("a");
    rl.hit("b");
    expect(rl.retryAfter("a")).toBeGreaterThan(0);
    rl.reset("a");
    expect(rl.retryAfter("a")).toBe(0);
    expect(rl.retryAfter("b")).toBeGreaterThan(0);
  });
});
