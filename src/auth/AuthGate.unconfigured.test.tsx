import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

vi.mock("../lib/apiConfig", () => ({
  API_ORIGIN: null,
  isApiConfigured: false,
  API_UNAVAILABLE_MESSAGE: "Sign-in and account creation are temporarily unavailable because the secure finance API is not connected yet."
}));

describe("authentication when the backend has not been deployed", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  });

  it("explains the outage and disables sign-in and registration", async () => {
    render(<AuthGate><div>Private finance dashboard</div></AuthGate>);
    await screen.findByRole("heading", { name: "Welcome back." });
    expect(screen.getByRole("status")).toHaveTextContent("finance API is not connected yet");
    expect(screen.getByRole("button", { name: "Sign in securely" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("button", { name: "Create secure account" })).toBeDisabled();
    expect(screen.queryByText("Private finance dashboard")).not.toBeInTheDocument();
  });
});
