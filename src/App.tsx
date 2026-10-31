import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./lib/api";
import { AuthGate, useAuth } from "./auth/AuthGate";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BookOpen,
  CalendarDays, Check, ChevronDown, CircleHelp, CreditCard,
  LayoutDashboard, Menu, Plus, Search, Settings, ShieldCheck, Sparkles,
  Target, TrendingUp, Wallet, X
} from "lucide-react";

type Transaction = { id: number; title: string; category: string; date: string; amount: number; currency:string; kind: "income" | "expense" };
type Tab = "Overview" | "Accounts" | "Transactions" | "Budgets" | "Categories" | "Reports" | "AI Accountant";
type Category = { id:number; name:string; type:"income"|"expense"; system:boolean; active:boolean };
type Budget = { id:number; name:string; category:string; categoryId:number | null; limit:number; spent:number; currency:string; period:string; startDate:string; endDate:string; active:boolean };
type Account = { id:number; name:string; type:string; currency:string; openingBalance:number; currentBalance:number };
type ApiTransaction = { id:number; description:string; category:string; occurred_at:string; amount:string|number; currency?:string; type:"income"|"expense"; account_id:number };



const dateOnly = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;

const money = (value: number, currency = "TZS") => new Intl.NumberFormat("en-TZ", {
  style: "currency", currency, minimumFractionDigits: currency === "TZS" ? 0 : 2, maximumFractionDigits: currency === "TZS" ? 0 : 2
}).format(value);

function DashboardApp() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({name:"",type:"cash",openingBalance:"0"});

  const [budgetFormOpen,setBudgetFormOpen]=useState(false);
  const [categoryFormOpen,setCategoryFormOpen]=useState(false);
  const [budgetForm,setBudgetForm]=useState({name:"",category:"Food",limit:""});
  const [categoryForm,setCategoryForm]=useState({name:"",type:"expense" as "income"|"expense"});
  const [formError,setFormError]=useState("");
  const [showForm, setShowForm] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"EN" | "SW">("EN");
  const [form, setForm] = useState({ title: "", amount: "", kind: "expense" as "income" | "expense", category: "", accountId: "" });

  const income = transactions.filter(t => t.kind === "income" && t.currency === "TZS").reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.kind === "expense" && t.currency === "TZS").reduce((sum, t) => sum + t.amount, 0);
  const balance = accounts.filter(a=>a.currency==="TZS").reduce((sum,a)=>sum+a.currentBalance,0);
  const totalBudget = budgets.filter(b=>b.active&&b.currency==="TZS").reduce((sum,b)=>sum+b.limit,0);
  const totalSpent = budgets.filter(b=>b.active&&b.currency==="TZS").reduce((sum,b)=>sum+b.spent,0);
  const budgetPercent = totalBudget > 0 ? Math.min(100, totalSpent / totalBudget * 100) : 0;
  const filtered = useMemo(() => transactions.filter(t => (t.title + t.category).toLowerCase().includes(query.toLowerCase())), [transactions, query]);

  const refreshFinanceData = async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [accountResult, transactionResult, categoryResult, budgetResult] = await Promise.all([
        apiRequest<{data: Array<Record<string, unknown>>}>("/accounts"),
        apiRequest<{data: ApiTransaction[]}>("/transactions?per_page=100"),
        apiRequest<{data: Array<Record<string, unknown>>}>("/categories?include_inactive=1"),
        apiRequest<{data: Array<Record<string, unknown>>}>("/budgets?per_page=100")
      ]);
      const nextAccounts: Account[] = accountResult.data.map((a:any)=>({
        id:Number(a.id),name:String(a.name),type:String(a.type),currency:String(a.currency),
        openingBalance:Number(a.opening_balance),currentBalance:Number(a.current_balance)
      }));
      const nextCategories: Category[] = categoryResult.data.map((item:any)=>({
        id:Number(item.id),name:String(item.name),type:item.type,system:Boolean(item.is_system),
        active:Boolean(item.is_active)
      }));
      const nextTransactions: Transaction[] = transactionResult.data.map(item=>({
        id:Number(item.id),title:item.description,category:item.category,date:new Date(item.occurred_at).toLocaleString(),
        amount:Number(item.amount),currency:item.currency??"TZS",kind:item.type
      }));
      const nextBudgets: Budget[] = budgetResult.data.map((item:any)=>({
        id:Number(item.id),name:String(item.name),category:item.category?.name ?? "All expenses",
        categoryId:item.category_id == null ? null : Number(item.category_id),limit:Number(item.amount),
        spent:Number(item.spent_amount),currency:String(item.currency),period:String(item.period),
        startDate:String(item.start_date),endDate:String(item.end_date),active:Boolean(item.is_active)
      }));
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
      setBudgets(nextBudgets);
      setForm(current=>({...current,accountId:current.accountId || String(nextAccounts[0]?.id ?? ""),category:current.category || nextCategories.find(x=>x.type==="expense"&&x.active)?.name || ""}));
      setBudgetForm(current=>({...current,category:current.category || nextCategories.find(x=>x.type==="expense"&&x.active)?.name || ""}));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to load your financial records.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(()=>{ void refreshFinanceData(); },[]);


  const nav: { label: Tab; icon: typeof LayoutDashboard }[] = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Accounts", icon: Wallet },
    { label: "Transactions", icon: ArrowLeftRight },
    { label: "Budgets", icon: Target },
    { label: "Categories", icon: CreditCard },
    { label: "Reports", icon: Activity },
    { label: "AI Accountant", icon: Sparkles }
  ];

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0 || !form.accountId) return;
    setSaving(true); setFormError("");
    try {
      await apiRequest("/transactions",{method:"POST",body:JSON.stringify({
        account_id:Number(form.accountId),type:form.kind,amount:amount.toFixed(2),currency:accounts.find(a=>a.id===Number(form.accountId))?.currency ?? "TZS",
        category:form.category,description:form.title.trim(),occurred_at:new Date().toISOString()
      })});
      setForm({title:"",amount:"",kind:"expense",category:categories.find(x=>x.type==="expense"&&x.active)?.name??"",accountId:form.accountId});
      setShowForm(false); setTab("Transactions"); await refreshFinanceData();
    } catch(error) { setFormError(error instanceof Error?error.message:"Could not save transaction."); }
    finally { setSaving(false); }
  }

  async function saveCategory(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      await apiRequest("/categories",{method:"POST",body:JSON.stringify({name:categoryForm.name.trim(),type:categoryForm.type})});
      setCategoryForm({name:"",type:"expense"});setCategoryFormOpen(false);await refreshFinanceData();
    } catch(error){setFormError(error instanceof Error?error.message:"Could not save category.");}
    finally{setSaving(false);}
  }

  async function toggleCategory(category:Category) {
    setSaving(true);setFormError("");
    try{await apiRequest(`/categories/${category.id}`,{method:"PATCH",body:JSON.stringify({is_active:!category.active})});await refreshFinanceData();}
    catch(error){setFormError(error instanceof Error?error.message:"Could not update category.");}
    finally{setSaving(false);}
  }

  async function saveBudget(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const limit=Number(budgetForm.limit);
    const selected=categories.find(x=>x.name===budgetForm.category&&x.type==="expense"&&x.active);
    if(!budgetForm.name.trim()||!Number.isFinite(limit)||limit<=0||!selected){setFormError("Enter a budget name, active expense category and valid limit.");return;}
    const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),1);const end=new Date(now.getFullYear(),now.getMonth()+1,0);
    setSaving(true);setFormError("");
    try{
      await apiRequest("/budgets",{method:"POST",body:JSON.stringify({name:budgetForm.name.trim(),category_id:selected.id,amount:limit.toFixed(2),currency:"TZS",period:"monthly",start_date:dateOnly(start),end_date:dateOnly(end)})});
      setBudgetForm({name:"",category:selected.name,limit:""});setBudgetFormOpen(false);await refreshFinanceData();
    }catch(error){setFormError(error instanceof Error?error.message:"Could not save budget.");}
    finally{setSaving(false);}
  }

  async function removeBudget(id:number) {
    setSaving(true);setFormError("");
    try{await apiRequest(`/budgets/${id}`,{method:"DELETE"});await refreshFinanceData();}
    catch(error){setFormError(error instanceof Error?error.message:"Could not deactivate budget.");}
    finally{setSaving(false);}
  }

  async function saveAccount(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const opening=Number(accountForm.openingBalance);
    if(!accountForm.name.trim()||!Number.isFinite(opening)||opening<0){setFormError("Enter a valid account name and opening balance.");return;}
    setSaving(true);setFormError("");
    try{await apiRequest("/accounts",{method:"POST",body:JSON.stringify({name:accountForm.name.trim(),type:accountForm.type,currency:"TZS",opening_balance:opening.toFixed(2)})});setAccountForm({name:"",type:"cash",openingBalance:"0"});setAccountFormOpen(false);await refreshFinanceData();}
    catch(error){setFormError(error instanceof Error?error.message:"Could not create account.");}
    finally{setSaving(false);}
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Wallet size={21} /></div>
          <div><strong>MWECau <span>GUIDER</span></strong><small>PERSONAL FINANCE</small></div>
          <button className="icon-btn mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={19} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${tab === label ? "active" : ""}`} onClick={() => { setTab(label); setMobileNav(false); }}>
              <Icon size={18} /><span>{label}</span>{label === "AI Accountant" && <span className="nav-new">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note"><ShieldCheck size={17} /><div><b>Your money, your control</b><small>Privacy-first by design</small></div></div>
          <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={18} /><span>Help centre</span></button>
          <div className="profile"><div className="avatar">JS</div><div><b>{user.name}</b><small>{user.email}</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs">Workspace <span>/</span> <b>{tab}</b></div>
          <div className="top-actions">
            <span className="demo-pill"><span /> AUTHENTICATED · LIVE LEDGER</span>
            <button className="language-btn" onClick={() => setLanguage(language === "EN" ? "SW" : "EN")}>{language} <ChevronDown size={14} /></button>
            <button className="icon-btn notification-btn" aria-label="Notifications"><Bell size={18} /><i /></button>
            <span className="signed-in-label">{user.name}</span><button className="signout-btn" onClick={() => void logout()}>Sign out</button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><CalendarDays size={14} /> FRIDAY, 30 OCTOBER 2026</div>
              <h1>{tab === "Overview" ? "Your money, in focus." : tab}</h1>
              <p>{tab === "Overview" ? "A clearer picture of your finances starts here." : "Explore and manage your personal finance workspace."}</p>
            </div>
            <button className="primary-btn" onClick={() => {setFormError("");setShowForm(true);}} disabled={!accounts.length}><Plus size={17} /> Add transaction</button>
          </section>

          {dataError && <div className="inline-error" role="alert">{dataError} <button className="text-btn" onClick={()=>void refreshFinanceData()}>Retry</button></div>}
          {loadingData && <div className="demo-notice">Loading your private financial records…</div>}
          {tab === "Overview" && <>
            <section className="balance-grid">
              <article className="balance-card">
                <div className="card-top"><span>Total available balance</span><span className="balance-icon"><Wallet size={18} /></span></div>
                <div className="balance-value">{money(balance)}</div>
                <div className="balance-foot"><span className="trend-up"><TrendingUp size={14} /> Account balances</span><span>{accounts.length} active accounts · TZS only</span></div>
                <div className="balance-glow" />
              </article>
              <article className="metric-card"><div className="metric-heading"><span>Income</span><span className="metric-icon income-icon"><ArrowDownLeft size={17} /></span></div><strong>{money(income)}</strong><small><span className="positive">↑</span> Loaded ledger inflows</small><div className="mini-bars income-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
              <article className="metric-card"><div className="metric-heading"><span>Expenses</span><span className="metric-icon expense-icon"><ArrowUpRight size={17} /></span></div><strong>{money(expenses)}</strong><small><span className="muted">•</span> Loaded ledger outflows</small><div className="mini-bars expense-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            </section>

            <section className="content-grid">
              <article className="panel transactions-panel">
                <div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest money movements</p></div><button className="text-btn" onClick={() => setTab("Transactions")}>View all <span>→</span></button></div>
                <TransactionList items={transactions.slice(0, 5)} />
              </article>
              <article className="panel budget-panel">
                <div className="panel-heading"><div><h2>Budget snapshot</h2><p>Live budget records</p></div><button className="more-btn" aria-label="Budget options">•••</button></div>
                <div className="budget-total"><strong>{money(totalSpent)}</strong><span>of {money(totalBudget)}</span></div>
                <div className="progress-track"><div style={{ width: `${budgetPercent}%` }} /></div>
                <div className="budget-caption"><span>{Math.round(budgetPercent)}% used</span><b>{money(totalBudget-totalSpent)} left</b></div>
                <div className="budget-categories">{budgets.filter(b=>b.active).slice(0,4).map((b,i)=><BudgetLine key={b.id} label={b.name} amount={money(b.spent,b.currency)} percent={b.limit>0?Math.min(100,Math.round(b.spent/b.limit*100)):0} color={["blue","purple","orange","blue"][i]} />)}</div>
                <button className="secondary-btn" onClick={() => setTab("Budgets")}>Manage budgets</button>
              </article>
            </section>

            <section className="insight-banner">
              <div className="insight-symbol"><Sparkles size={20} /></div>
              <div><span className="insight-label">YOUR FINANCIAL CHECK-IN</span><h3>Small steps make stronger money habits.</h3><p>Start by recording today's spending and reviewing your weekly budget.</p></div>
              <button className="insight-action" onClick={() => setTab("AI Accountant")}>Explore AI tools <span>→</span></button>
            </section>
          </>}

          {tab === "Accounts" && <section className="panel full-panel">
            <div className="panel-heading"><div><h2>Your accounts</h2><p>Cash, bank, mobile money and savings balances</p></div><button className="primary-btn" onClick={()=>{setAccountFormOpen(v=>!v);setFormError("");}}><Plus size={15}/> Add account</button></div>
            {accountFormOpen && <form className="inline-management-form" onSubmit={saveAccount}>
              <label>Account name<input required maxLength={80} value={accountForm.name} onChange={e=>setAccountForm({...accountForm,name:e.target.value})} placeholder="e.g. M-Pesa wallet"/></label>
              <label>Account type<select value={accountForm.type} onChange={e=>setAccountForm({...accountForm,type:e.target.value})}><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile_money">Mobile money</option><option value="savings">Savings</option><option value="other">Other</option></select></label>
              <label>Opening balance (TZS)<input required type="number" min="0" step="0.01" value={accountForm.openingBalance} onChange={e=>setAccountForm({...accountForm,openingBalance:e.target.value})}/></label>
              {formError&&<p className="inline-error" role="alert">{formError}</p>}<div className="inline-form-actions"><button type="button" className="secondary-btn" onClick={()=>setAccountFormOpen(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={saving}>{saving?"Saving…":"Create account"}</button></div>
            </form>}
            {formError&&!accountFormOpen&&<p className="inline-error" role="alert">{formError}</p>}
            <div className="managed-budgets">{accounts.map(a=><article className="managed-budget" key={a.id}><div className="managed-budget-head"><div><b>{a.name}</b><small>{a.type.replace("_"," ")} · {a.currency}</small></div><strong>{new Intl.NumberFormat("en-TZ",{style:"currency",currency:a.currency,maximumFractionDigits:2}).format(a.currentBalance)}</strong></div><div className="managed-budget-foot"><span>Opening: {money(a.openingBalance)}</span><span>Current ledger balance</span></div></article>)}</div>
            {!accounts.length&&!loadingData&&<p className="empty-state">No accounts yet. Add your first account before recording a transaction.</p>}
          </section>}

          {tab === "Transactions" && <section className="panel full-panel"><div className="panel-heading"><div><h2>All transactions</h2><p>Latest 100 records from your private ledger</p></div><button className="secondary-btn compact" onClick={()=>void refreshFinanceData()}><Activity size={15}/> Refresh</button></div><div className="search-box"><Search size={17}/><input aria-label="Search transactions" placeholder="Search transactions or categories..." value={query} onChange={e => setQuery(e.target.value)}/></div><TransactionList items={filtered}/>{filtered.length === 0 && <p className="empty-state">No matching transactions found.</p>}</section>}


          {tab === "Budgets" && <section className="panel full-panel">
            <div className="panel-heading"><div><h2>Budget management</h2><p>Set spending limits and monitor your recorded spending</p></div><button className="primary-btn" onClick={()=>{setBudgetFormOpen(v=>!v);setFormError("");}}><Plus size={15}/> Create budget</button></div>
            <div className="demo-notice">LIVE ACCOUNT DATA — budgets are stored securely in your account.</div>
            <div className="budget-summary-grid"><div><small>Total planned</small><b>{money(budgets.filter(b=>b.currency==="TZS").reduce((n,b)=>n+b.limit,0))}</b></div><div><small>Spent so far</small><b>{money(budgets.filter(b=>b.currency==="TZS").reduce((n,b)=>n+b.spent,0))}</b></div><div><small>Remaining</small><b>{money(budgets.filter(b=>b.currency==="TZS").reduce((n,b)=>n+b.limit-b.spent,0))}</b></div></div>
            {budgetFormOpen && <form className="inline-management-form" onSubmit={saveBudget}>
              <label>Budget name<input required maxLength={80} value={budgetForm.name} onChange={e=>setBudgetForm({...budgetForm,name:e.target.value})} placeholder="e.g. Weekly groceries"/></label>
              <label>Expense category<select required value={budgetForm.category} onChange={e=>setBudgetForm({...budgetForm,category:e.target.value})}>{categories.filter(c=>c.active&&c.type==="expense").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
              <label>Monthly limit (TZS)<input required type="number" min="1" step="0.01" value={budgetForm.limit} onChange={e=>setBudgetForm({...budgetForm,limit:e.target.value})} placeholder="e.g. 150000"/></label>
              {formError&&<p className="inline-error" role="alert">{formError}</p>}<div className="inline-form-actions"><button type="button" className="secondary-btn" onClick={()=>setBudgetFormOpen(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={saving}>{saving?"Saving…":"Save budget"}</button></div>
            </form>}
            <div className="managed-budgets">{budgets.filter(b=>b.active).map(b=>{const pct=b.limit>0?Math.round(b.spent/b.limit*100):0;return <article className="managed-budget" key={b.id}><div className="managed-budget-head"><div><b>{b.name}</b><small>{b.category}</small></div><strong>{money(b.spent,b.currency)} <span>/ {money(b.limit,b.currency)}</span></strong></div><div className="progress-track"><div className={pct>=100?"over-budget":pct>=80?"near-budget":""} style={{width:`${Math.min(pct,100)}%`}}/></div><div className="managed-budget-foot"><span>{pct}% used</span><span>{pct>100?money(b.spent-b.limit)+" over":money(b.limit-b.spent)+" remaining"}</span><button className="text-btn" onClick={()=>void removeBudget(b.id)} disabled={saving}>Deactivate</button></div></article>})}</div>
          </section>}
          {tab === "Categories" && <section className="panel full-panel">
            <div className="panel-heading"><div><h2>Category management</h2><p>Organise income and expense labels used in your ledger</p></div><button className="primary-btn" onClick={()=>{setCategoryFormOpen(v=>!v);setFormError("");}}><Plus size={15}/> Add category</button></div>
            <div className="demo-notice">LIVE ACCOUNT DATA — system categories are read-only; your custom categories are private to your account.</div>
            {categoryFormOpen && <form className="inline-management-form category-form" onSubmit={saveCategory}>
              <label>Category name<input required minLength={2} maxLength={60} value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm,name:e.target.value})} placeholder="e.g. Mobile data"/></label><label>Category type<select value={categoryForm.type} onChange={e=>setCategoryForm({...categoryForm,type:e.target.value as "income"|"expense"})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
              {formError&&<p className="inline-error" role="alert">{formError}</p>}<div className="inline-form-actions"><button type="button" className="secondary-btn" onClick={()=>setCategoryFormOpen(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={saving}>{saving?"Saving…":"Save category"}</button></div>
            </form>}
            <div className="category-columns">{(["income","expense"] as const).map(type=><div className="category-group" key={type}><h3>{type==="income"?"Income categories":"Expense categories"} <span>{categories.filter(c=>c.type===type&&c.active).length}</span></h3>{categories.filter(c=>c.type===type).map(c=><div className={`category-row ${c.active?"":"category-disabled"}`} key={c.id}><div><b>{c.name}</b><small>{c.system?"System category":"Custom category"} · {c.active?"Active":"Inactive"}</small></div>{!c.system&&<button className="text-btn" onClick={()=>void toggleCategory(c)} disabled={saving}>{c.active?"Deactivate":"Activate"}</button>}</div>)}</div>)}</div>
          </section>}

          {tab === "Reports" && <section className="panel full-panel"><div className="panel-heading"><div><h2>Financial summary</h2><p>Based on the latest 100 ledger transactions loaded</p></div><span className="demo-pill">SAMPLE REPORT</span></div><div className="report-stats"><div><small>Total income</small><b>{money(income)}</b></div><div><small>Total expenses</small><b>{money(expenses)}</b></div><div><small>Net cash flow</small><b className="positive">{money(balance)}</b></div></div><div className="report-note"><BookOpen size={19}/><p>Detailed trends, category analysis, exports and financial health scoring will be added in the reporting phase.</p></div></section>}

          {tab === "AI Accountant" && <section className="panel ai-panel"><div className="ai-orb"><Sparkles size={28}/></div><span className="insight-label">MWECau GUIDER INTELLIGENCE</span><h2>Your personal AI accountant.</h2><p>Ask questions about budgeting, spending habits and financial planning. AI advice will be connected to your verified financial records in a later phase.</p><div className="ai-example"><span>Try asking</span><button onClick={() => setQuery("food")}>How much did I spend on food?</button><button onClick={() => setQuery("income")}>How can I plan my monthly income?</button></div><div className="coming-soon"><Sparkles size={15}/> AI assistant is not connected in this demo build.</div></section>}
          <footer className="footer"><span>MWECau GUIDER <i>·</i> Built for smarter financial habits in Tanzania</span><span>Designed & developed by <b>JOHN ONLINE SERVICES AND APPLICATIONS</b> · Developer: <b>John Charles Sarwi</b> · <a href="https://john-charles-sarwi-portfolio.vercel.app/" target="_blank" rel="noreferrer">Portfolio</a></span></footer>
        </div>
      </main>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">LEDGER ENTRY</span><h2 id="modal-title">Add transaction</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={() => setShowForm(false)}><X size={20}/></button></div><form onSubmit={addTransaction}><label>Account<select required value={form.accountId} onChange={e=>setForm({...form,accountId:e.target.value})}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label><label>Transaction type<select value={form.kind} onChange={e => { const kind=e.target.value as "income"|"expense"; const first=categories.find(c=>c.active&&c.type===kind); setForm({...form,kind,category:first?.name??""}); }}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Description<input required maxLength={80} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Electricity bill"/></label><label>Amount ({accounts.find(a=>a.id===Number(form.accountId))?.currency ?? "TZS"})<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="Enter amount"/></label><label>Category<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.filter(c=>c.active&&c.type===form.kind).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={saving||!accounts.length}>{saving?"Saving…":<><Check size={16}/> Save entry</>}</button></div>{formError&&<p className="inline-error" role="alert">{formError}</p>}<p className="form-disclaimer">Transactions are submitted to your authenticated account and saved on the server.</p></form></section></div>}
    </div>
  );
}

function TransactionList({ items }: { items: Transaction[] }) {
  if (!items.length) return <p className="empty-state">No transactions yet. Add your first entry to get started.</p>;
  return <div className="transaction-list">{items.map(item => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? <ArrowDownLeft size={17}/> : <CreditCard size={16}/>}</div><div className="transaction-name"><b>{item.title}</b><small>{item.category} <i>·</i> {item.date}</small></div><strong className={item.kind === "income" ? "positive" : "amount-out"}>{item.kind === "income" ? "+" : "−"}{money(item.amount,item.currency)}</strong></div>)}</div>;
}

function BudgetLine({label, amount, percent, color}: {label:string;amount:string;percent:number;color:string}) {
  return <div className="budget-line"><div><span>{label}</span><b>{amount}</b></div><div className="progress-track"><div className={color} style={{width:`${percent}%`}}/></div></div>;
}

export default function App() { return <AuthGate><DashboardApp /></AuthGate>; }