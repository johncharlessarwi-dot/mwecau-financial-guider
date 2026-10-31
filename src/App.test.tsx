import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const offlineStoreMocks = vi.hoisted(() => ({ clearUserOfflineData: vi.fn() }));
vi.mock("./lib/offlineStore", () => offlineStoreMocks);

const signedInUser = { id: 7, name: "Test User", email: "test@example.com" };

function mockAuthenticationApi() {
  let accounts = [{id:1,name:"Everyday wallet",type:"cash",currency:"TZS",opening_balance:"10000.00",current_balance:"13000.00"}];
  let transactions = [
    {id:1,description:"Groceries & essentials",category:"Food",occurred_at:"2026-10-30T08:40:00Z",amount:"2000.00",type:"expense",account_id:1},
    {id:2,description:"Monthly allowance",category:"Salary",occurred_at:"2026-10-30T09:12:00Z",amount:"5000.00",type:"income",account_id:1}
  ];
  let categories = [
    {id:1,name:"Salary",type:"income",is_system:true,is_active:true},
    {id:2,name:"Food",type:"expense",is_system:true,is_active:true},
    {id:3,name:"Housing",type:"expense",is_system:true,is_active:true}
  ];
  let budgets: Array<Record<string,unknown>> = [];

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json"}});
    if (url.endsWith("/sanctum/csrf-cookie")) return new Response(null,{status:204});
    if (url.endsWith("/auth/me")) return json({message:"Unauthenticated."},401);
    if (url.endsWith("/auth/login")) return json({user:signedInUser});
    if (url.endsWith("/auth/logout")) return json({message:"Session revoked."});
    if (url.includes("/api/v1/accounts")) {
      if(method==="POST"){
        const body=JSON.parse(String(init?.body));
        const created={id:accounts.length+1,name:body.name,type:body.type,currency:body.currency,opening_balance:body.opening_balance,current_balance:body.opening_balance};
        accounts=[...accounts,created];return json({data:created},201);
      }
      return json({data:accounts});
    }
    if (url.includes("/api/v1/transactions")) {
      if(method==="POST"){
        const body=JSON.parse(String(init?.body));
        const created={id:transactions.length+1,description:body.description,category:body.category,occurred_at:body.occurred_at,amount:body.amount,type:body.type,account_id:body.account_id};
        transactions=[created,...transactions];return json({data:created},201);
      }
      return json({data:transactions});
    }
    if (url.includes("/api/v1/categories")) {
      const match=url.match(/\/categories\/(\d+)/);
      if(method==="POST"){
        const body=JSON.parse(String(init?.body));
        const created={id:Math.max(0,...categories.map(x=>x.id))+1,name:body.name,type:body.type,is_system:false,is_active:true};
        categories=[...categories,created];return json({data:created},201);
      }
      if(method==="PATCH"&&match){
        const body=JSON.parse(String(init?.body));
        categories=categories.map(x=>x.id===Number(match[1])?{...x,...body}:x);
        return json({data:categories.find(x=>x.id===Number(match[1]))});
      }
      return json({data:categories});
    }
    if (url.includes("/api/v1/reports/summary")) return json({data:{from:"2026-10-01",to:"2026-10-31",currencies:[{currency:"TZS",income:"100000.00",expenses:"25000.00",net_cash_flow:"75000.00",categories:[{type:"income",category:"Salary",amount:"100000.00"},{type:"expense",category:"Food",amount:"25000.00"}]}]}});
    if (url.includes("/api/v1/budgets")) {
      if(method==="POST"){
        const body=JSON.parse(String(init?.body));
        const category=categories.find(x=>x.id===body.category_id);
        const created={id:budgets.length+1,name:body.name,category,category_id:body.category_id,amount:body.amount,currency:body.currency,period:body.period,start_date:body.start_date,end_date:body.end_date,is_active:true,spent_amount:"0.00"};
        budgets=[...budgets,created];return json({data:created},201);
      }
      if(method==="DELETE") return json({message:"Budget deactivated."});
      return json({data:budgets});
    }
    return json({message:"Not found."},404);
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
  await waitFor(() => expect(screen.getByText("Groceries & essentials")).toBeInTheDocument());
}

describe("MWECau GUIDER live finance workspace", () => {
  beforeEach(() => { vi.unstubAllGlobals(); offlineStoreMocks.clearUserOfflineData.mockReset().mockResolvedValue(undefined); });

  it("requires authentication before rendering the finance workspace", async () => {
    mockAuthenticationApi();
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument());
    expect(screen.queryByText("Recent transactions")).not.toBeInTheDocument();
  });

  it("clears the signed-in account's offline data before server logout", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button", {name:"Sign out"}));
    await waitFor(() => expect(screen.getByRole("heading", {name:"Welcome back."})).toBeInTheDocument());
    expect(offlineStoreMocks.clearUserOfflineData).toHaveBeenCalledOnce();
    expect(offlineStoreMocks.clearUserOfflineData).toHaveBeenCalledWith(signedInUser.id);
  });

  it("loads the authenticated user's real account balance and ledger records", async () => {
    await renderAuthenticatedApp();
    expect(screen.getByText(/13,000/)).toBeInTheDocument();
    expect(screen.getByText("Groceries & essentials")).toBeInTheDocument();
    expect(screen.getByText(/AUTHENTICATED · LIVE LEDGER/i)).toBeInTheDocument();
  });

  it("submits a transaction to the authenticated API and refreshes the ledger", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    fireEvent.change(screen.getByLabelText("Description"), {target:{value:"Test payment"}});
    fireEvent.change(screen.getByLabelText(/Amount \(TZS\)/), {target:{value:"15000"}});
    fireEvent.click(screen.getByRole("button",{name:/Save entry/i}));
    await waitFor(()=>expect(screen.getByText("Test payment")).toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls.some(([url,init])=>String(url).includes("/api/v1/transactions")&&init?.method==="POST")).toBe(true);
  });

  it("reuses the same idempotency key and exact payload after a failed transaction response", async () => {
    await renderAuthenticatedApp();
    const fetchMock = vi.mocked(fetch);
    const originalFetch = fetchMock.getMockImplementation();
    if (!originalFetch) throw new Error("Expected the authenticated API mock to be installed.");
    let failFirstAttempt = true;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).includes("/api/v1/transactions") && (init?.method || "GET").toUpperCase() === "POST" && failFirstAttempt) {
        failFirstAttempt = false;
        return new Response(JSON.stringify({message:"Temporary server error"}),{status:503,headers:{"Content-Type":"application/json"}});
      }
      return originalFetch(input, init);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Add transaction/i })[0]);
    fireEvent.change(screen.getByLabelText("Description"), {target:{value:"Retry-safe payment"}});
    fireEvent.change(screen.getByLabelText(/Amount \(TZS\)/), {target:{value:"18000"}});
    fireEvent.click(screen.getByRole("button", {name:/Save entry/i}));
    await waitFor(() => expect(screen.getByText("Temporary server error")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", {name:/Save entry/i}));
    await waitFor(() => expect(screen.getByText("Retry-safe payment")).toBeInTheDocument());

    const attempts = fetchMock.mock.calls.filter(([url, init]) =>
      String(url).includes("/api/v1/transactions") && (init?.method || "GET").toUpperCase() === "POST"
    );
    expect(attempts).toHaveLength(2);
    const firstHeaders = new Headers(attempts[0][1]?.headers);
    const secondHeaders = new Headers(attempts[1][1]?.headers);
    expect(firstHeaders.get("Idempotency-Key")).toBeTruthy();
    expect(secondHeaders.get("Idempotency-Key")).toBe(firstHeaders.get("Idempotency-Key"));
    expect(attempts[1][1]?.body).toBe(attempts[0][1]?.body);
  });

  it("creates a server-backed account", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button",{name:"Accounts"}));
    fireEvent.click(screen.getByRole("button",{name:/Add account/i}));
    fireEvent.change(screen.getByLabelText("Account name"),{target:{value:"New bank account"}});
    fireEvent.change(screen.getByLabelText("Opening balance (TZS)"),{target:{value:"50000"}});
    fireEvent.click(screen.getByRole("button",{name:"Create account"}));
    await waitFor(()=>expect(screen.getByText("New bank account")).toBeInTheDocument());
  });

  it("persists budgets through the API and reloads budget progress", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button",{name:"Budgets"}));
    fireEvent.click(screen.getByRole("button",{name:/Create budget/i}));
    fireEvent.change(screen.getByLabelText("Budget name"),{target:{value:"Emergency fund"}});
    fireEvent.change(screen.getByLabelText("Expense category"),{target:{value:"Food"}});
    fireEvent.change(screen.getByLabelText("Monthly limit (TZS)"),{target:{value:"50000"}});
    fireEvent.click(screen.getByRole("button",{name:"Save budget"}));
    await waitFor(()=>expect(screen.getByText("Emergency fund")).toBeInTheDocument());
    expect(screen.getByText(/budgets are stored securely/i)).toBeInTheDocument();
  });

  it("persists custom categories and deactivation through the API", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button",{name:"Categories"}));
    fireEvent.click(screen.getByRole("button",{name:/Add category/i}));
    fireEvent.change(screen.getByLabelText("Category name"),{target:{value:"Mobile data"}});
    fireEvent.click(screen.getByRole("button",{name:"Save category"}));
    await waitFor(()=>expect(screen.getByText("Mobile data")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:"Deactivate"}));
    await waitFor(()=>expect(screen.getByText(/Custom category · Inactive/)).toBeInTheDocument());
  });

  it("makes active custom categories available in the transaction form", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button",{name:"Categories"}));
    fireEvent.click(screen.getByRole("button",{name:/Add category/i}));
    fireEvent.change(screen.getByLabelText("Category name"),{target:{value:"Mobile data"}});
    fireEvent.click(screen.getByRole("button",{name:"Save category"}));
    await waitFor(()=>expect(screen.getByText("Mobile data")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button",{name:/Add transaction/i})[0]);
    expect(screen.getByRole("option",{name:"Mobile data"})).toBeInTheDocument();
  });

  it("loads date-filtered financial reports from the authenticated API", async () => {
    await renderAuthenticatedApp();
    fireEvent.click(screen.getByRole("button",{name:"Reports"}));
    fireEvent.click(screen.getByRole("button",{name:"Generate report"}));
    await waitFor(()=>expect(screen.getByText("TZS summary")).toBeInTheDocument());
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes("/api/v1/reports/summary?from="))).toBe(true);
  });

  it("uses credentialed requests and never persists a bearer token in browser storage", async () => {
    await renderAuthenticatedApp();
    const calls=vi.mocked(fetch).mock.calls;
    const financeCall=calls.find(([url])=>String(url).includes("/api/v1/accounts"));
    expect(financeCall?.[1]?.credentials).toBe("include");
    expect(window.localStorage.length).toBe(0);
  });
});
