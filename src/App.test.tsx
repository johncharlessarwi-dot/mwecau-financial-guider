import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("MWECau GUIDER dashboard", () => {
  it("renders the finance overview and labels demo data clearly", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Your money, in focus." })).toBeInTheDocument();
    expect(screen.getAllByText(/DEMO DATA/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Recent transactions")).toBeInTheDocument();
  });

  it("adds a valid transaction to the local demo ledger", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test payment" } });
    fireEvent.change(screen.getByLabelText("Amount (TZS)"), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    expect(screen.getByText("Test payment")).toBeInTheDocument();
    expect(screen.getByText("All transactions")).toBeInTheDocument();
  });

  it("filters the transaction list", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Transactions" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search transactions" }), { target: { value: "groceries" } });
    expect(screen.getAllByText("Groceries & essentials").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".transaction-row")).toHaveLength(1);
  });

  it("creates a demo budget with a validated whole-number limit", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Budgets" }));
    fireEvent.click(screen.getByRole("button", { name: /Create budget/i }));
    fireEvent.change(screen.getByLabelText("Budget name"), { target: { value: "Emergency fund" } });
    fireEvent.change(screen.getByLabelText("Expense category"), { target: { value: "Housing" } });
    fireEvent.change(screen.getByLabelText("Limit (TZS)"), { target: { value: "50000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }));
    expect(screen.getByText("Emergency fund")).toBeInTheDocument();
    expect(screen.getByText(/changes stay in this page session/i)).toBeInTheDocument();
  });

  it("creates a custom category and allows deactivation without changing system categories", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Mobile data" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    expect(screen.getByText("Mobile data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(screen.getByText(/Custom category · Inactive/)).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("rejects duplicate category names within the same type", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That category already exists");
  });


  it("makes active custom categories available in transaction entry", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: /Add category/i }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Mobile data" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    expect(screen.getByRole("option", { name: "Mobile data" })).toBeInTheDocument();
  });

});
