import { describe, expect, it } from "vitest";
import { resolveApiOrigin } from "./apiConfig";

describe("finance API origin security", () => {
  it("does not silently target localhost when deployed without API configuration", () => {
    expect(resolveApiOrigin(undefined, true)).toBeNull();
    expect(resolveApiOrigin("", true)).toBeNull();
    expect(resolveApiOrigin(" ", true)).toBeNull();
  });

  it("requires HTTPS in a production browser", () => {
    expect(resolveApiOrigin("http://localhost:8000", true)).toBeNull();
    expect(resolveApiOrigin("http://api.example.com", true)).toBeNull();
    expect(resolveApiOrigin("https://api.example.com/", true)).toBe("https://api.example.com");
  });

  it("rejects URL paths, query strings, fragments and embedded credentials", () => {
    expect(resolveApiOrigin("https://api.example.com/api", true)).toBeNull();
    expect(resolveApiOrigin("https://api.example.com/?token=secret", true)).toBeNull();
    expect(resolveApiOrigin("https://api.example.com/#x", true)).toBeNull();
    expect(resolveApiOrigin("https://user:pass@api.example.com/", true)).toBeNull();
    expect(resolveApiOrigin("not-an-origin", true)).toBeNull();
  });

  it("keeps localhost as a development-only fallback", () => {
    expect(resolveApiOrigin(undefined, false)).toBe("http://localhost:8000");
    expect(resolveApiOrigin("http://localhost:9000", false)).toBe("http://localhost:9000");
  });
});
