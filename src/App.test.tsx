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
    expect(screen.getByText("Groceries & essentials")).toBeInTheDocument();
    expect(screen.queryByText("Campus transport")).not.toBeInTheDocument();
  });
});