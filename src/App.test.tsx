import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const signedInUser = { id: 7, name: "Test User", email: "test@example.com" };

function mockAuthenticationApi() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/sanctum/csrf-cookie")) {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/auth/me")) {
      return new Response(JSON.stringify({ message: "Unauthenticated." }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/auth/login") && init?.method === "POST") {
      return new Response(JSON.stringify({ user: signedInUser }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/auth/logout")) {
      return new Response(JSON.stringify({ message: "Session revoked." }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: "Not found." }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }));
}

async function renderAuthenticatedApp() {
  mockAuthenticationApi();
  render(<App />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: signedInUser.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in securely" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Your money, in focus." })).toBeInTheDocument());
}

describe("MWECau GUIDER dashboard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires authentication before rendering the finance workspace", async () => {
    mockAuthenticationApi();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument());
    expect(screen.queryByText("Recent transactions")).not.toBeInTheDocument();
  });

  it("renders the finance overview and labels demo data clearly", async () => {
    await renderAuthenticatedApp();
    expect(screen.getByRole("heading", { name: "Your money, in focus." })).toBeInTheDocument();
    expect(screen.getByText(/AUTHENTICATED · DEMO LEDGER/i)).toBeInTheDocument();
    expect(screen.getByText("Recent transactions")).toBeInTheDocument();
  });

  it("adds a valid transaction to the local demo ledger", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test payment" } });
    fireEvent.change(screen.getByLabelText("Amount (TZS)"), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    expect(screen.getByText("Test payment")).toBeInTheDocument();
    expect(screen.getByText("All transactions")).toBeInTheDocument();
  });

  it("filters the transaction list", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Transactions" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search transactions" }), { target: { value: "groceries" } });
    expect(screen.getAllByText("Groceries & essentials").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".transaction-row")).toHaveLength(1);
  });

  it("creates a demo budget with a validated whole-number limit", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button", { name: "Budgets" }));
    fireEvent.click(screen.getByRole("button", { name: /Create budget/i }));
    fireEvent.change(screen.getByLabelText("Budget name"), { target: { value: "Emergency fund" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Housing" } });
    fireEvent.change(screen.getByLabelText("Limit (TZS)"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
    expect(screen.getByText("Emergency fund")).toBeInTheDocument();
    expect(screen.getByText(/changes stay in this page session/i)).toBeInTheDocument();
  });

  it("creates a custom category and allows deactivation without changing system categories", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Mobile data" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    expect(screen.getByText("Mobile data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(screen.getByText(/Custom category · Inactive/)).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("rejects duplicate category names within the same type", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That category already exists");
  });

  it("makes active custom categories available in transaction entry", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Mobile data" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    expect(screen.getByRole("option", { name: "Mobile data" })).toBeInTheDocument();
  });
});
