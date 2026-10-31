import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiRequestError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authenticated API error classification", () => {
  it("preserves 401 status so the app can clear private offline data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 })
    ));

    await expect(apiRequest("/accounts")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 401,
      message: "Your session has expired. Please sign in again."
    });
  });

  it("preserves 403 status for revoked or insufficient permissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Forbidden." }), { status: 403 })
    ));

    await expect(apiRequest("/accounts")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403
    });
  });

  it("keeps validation failures distinguishable from authorization failures", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: { amount: ["The amount is invalid."] } }), { status: 422 }))
    );

    await expect(apiRequest("/transactions", { method: "POST", body: JSON.stringify({ amount: -1 }) }))
      .rejects.toMatchObject({ status: 422, message: "The amount is invalid." });
  });

  it("marks network failures without pretending they are authorization failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    let caught: unknown;
    try {
      await apiRequest("/accounts");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({ status: null });
  });
});
