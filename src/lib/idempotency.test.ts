import { describe, expect, it } from "vitest";
import { createIdempotencyKey } from "./idempotency";

describe("createIdempotencyKey", () => {
  it("returns a 128-bit hexadecimal key", () => {
    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates distinct keys for independent transaction attempts", () => {
    const keys = new Set(Array.from({length: 100}, () => createIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});
