import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate, useAuth } from "./AuthGate";

const offlineMocks = vi.hoisted(() => ({
  clearUserOfflineData: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("../lib/offlineStore", () => offlineMocks);

function SessionActions() {
  const { expireSession } = useAuth();
  return <button onClick={() => void expireSession()}>Expire session</button>;
}

describe("AuthGate offline data access revocation", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    offlineMocks.clearUserOfflineData.mockClear().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 });
      }
      if (url.endsWith("/auth/login")) {
        return new Response(JSON.stringify({
          user: { id: 41, name: "Offline User", email: "offline@example.com" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ message: "Not found." }), { status: 404 });
    }));
  });

  it("clears the signed-in account's encrypted data before returning to sign-in", async () => {
    render(<AuthGate><SessionActions /></AuthGate>);
    await screen.findByRole("heading", { name: "Welcome back." });

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "offline@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in securely" }));

    await screen.findByRole("button", { name: "Expire session" });
    fireEvent.click(screen.getByRole("button", { name: "Expire session" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument());
    expect(offlineMocks.clearUserOfflineData).toHaveBeenCalledWith(41);
  });
});
