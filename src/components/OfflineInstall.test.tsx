import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OfflineInstall from "./OfflineInstall";

function installEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" })
  });
  return { event, prompt };
}

describe("PWA connectivity and installation controls", () => {
  it("updates the connectivity status when the browser goes offline and online", () => {
    render(<OfflineInstall />);
    expect(screen.getByRole("status")).toHaveTextContent("Online");

    window.dispatchEvent(new Event("offline"));
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    expect(screen.getByText(/Live financial data and saving changes need an internet connection/i)).toBeInTheDocument();

    window.dispatchEvent(new Event("online"));
    expect(screen.getByRole("status")).toHaveTextContent("Online");
  });

  it("shows the install action only after the browser offers an install prompt", () => {
    render(<OfflineInstall />);
    expect(screen.queryByRole("button", { name: /Install app/i })).not.toBeInTheDocument();

    const { event } = installEvent();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("button", { name: /Install app/i })).toBeInTheDocument();
  });

  it("requests installation and reflects an accepted browser choice", async () => {
    render(<OfflineInstall />);
    const { event, prompt } = installEvent("accepted");
    window.dispatchEvent(event);

    fireEvent.click(screen.getByRole("button", { name: /Install app/i }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(await screen.findByText("App installed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Install app/i })).not.toBeInTheDocument();
  });

  it("keeps the app installable after a dismissed prompt", async () => {
    render(<OfflineInstall />);
    const { event } = installEvent("dismissed");
    window.dispatchEvent(event);

    fireEvent.click(screen.getByRole("button", { name: /Install app/i }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /Install app/i })).not.toBeInTheDocument());
    expect(screen.queryByText("App installed")).not.toBeInTheDocument();
  });
});
