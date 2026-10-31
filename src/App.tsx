import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BookOpen,
  CalendarDays, Check, ChevronDown, CircleHelp, CreditCard, Download,
  LayoutDashboard, Menu, Plus, Search, Settings, ShieldCheck, Sparkles,
  Target, TrendingUp, Wallet, X
} from "lucide-react";

type Transaction = { id: number; title: string; category: string; date: string; amount: number; kind: "income" | "expense" };
type Tab = "Overview" | "Transactions" | "Budgets" | "Categories" | "Reports" | "AI Accountant";
type Category = { id:number; name:string; type:"income"|"expense"; system:boolean; active:boolean };
type Budget = { id:number; name:string; category:string; limit:number; spent:number };

const initialTransactions: Transaction[] = [
  { id: 1, title: "Monthly allowance", category: "Education", date: "Today, 09:12", amount: 350000, kind: "income" },
  { id: 2, title: "Groceries & essentials", category: "Food", date: "Today, 08:40", amount: 48500, kind: "expense" },
  { id: 3, title: "Campus transport", category: "Transport", date: "Yesterday", amount: 12000, kind: "expense" },
  { id: 4, title: "Freelance website work", category: "Side income", date: "28 Oct 2026", amount: 180000, kind: "income" },
  { id: 5, title: "Internet bundle", category: "Utilities", date: "27 Oct 2026", amount: 25000, kind: "expense" }
];

const money = (value: number) => new Intl.NumberFormat("en-TZ", {
  style: "currency", currency: "TZS", maximumFractionDigits: 0
}).format(value);

function App() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState<Category[]>([
    ...["Salary","Business","Freelance","Investment","Gift","Other income"].map((name,i)=>({id:i+1,name,type:"income" as const,system:true,active:true})),
    ...["Food","Housing","Transport","Utilities","Healthcare","Education","Shopping","Entertainment","Personal Care","Other"].map((name,i)=>({id:i+20,name,type:"expense" as const,system:true,active:true}))
  ]);
  const [budgets, setBudgets] = useState<Budget[]>([
    {id:1,name:"Food & groceries",category:"Food",limit:315000,spent:245000},
    {id:2,name:"Transport",category:"Transport",limit:200000,spent:96000},
    {id:3,name:"Utilities",category:"Utilities",limit:137000,spent:85000},
    {id:4,name:"Education",category:"Education",limit:548000,spent:430000}
  ]);
  const [budgetFormOpen,setBudgetFormOpen]=useState(false);
  const [categoryFormOpen,setCategoryFormOpen]=useState(false);
  const [budgetForm,setBudgetForm]=useState({name:"",category:"Food",limit:""});
  const [categoryForm,setCategoryForm]=useState({name:"",type:"expense" as "income"|"expense"});
  const [formError,setFormError]=useState("");
  const [showForm, setShowForm] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"EN" | "SW">("EN");
  const [form, setForm] = useState({ title: "", amount: "", kind: "expense" as "income" | "expense", category: "Other" });

  const income = transactions.filter(t => t.kind === "income").reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.kind === "expense").reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expenses;
  const filtered = useMemo(() => transactions.filter(t => (t.title + t.category).toLowerCase().includes(query.toLowerCase())), [transactions, query]);

  const nav: { label: Tab; icon: typeof LayoutDashboard }[] = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Transactions", icon: ArrowLeftRight },
    { label: "Budgets", icon: Target },
    { label: "Categories", icon: CreditCard },
    { label: "Reports", icon: Activity },
    { label: "AI Accountant", icon: Sparkles }
  ];

  function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setTransactions(current => [{
      id: Date.now(), title: form.title.trim(), category: form.category,
      date: "Just now", amount, kind: form.kind
    }, ...current]);
    setForm({ title: "", amount: "", kind: "expense", category: "Other" });
    setShowForm(false);
    setTab("Transactions");
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
          <div className="profile"><div className="avatar">JS</div><div><b>Personal workspace</b><small>Free account · Demo</small></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs">Workspace <span>/</span> <b>{tab}</b></div>
          <div className="top-actions">
            <span className="demo-pill"><span /> DEMO DATA</span>
            <button className="language-btn" onClick={() => setLanguage(language === "EN" ? "SW" : "EN")}>{language} <ChevronDown size={14} /></button>
            <button className="icon-btn notification-btn" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="avatar top-avatar">JS</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><CalendarDays size={14} /> FRIDAY, 30 OCTOBER 2026</div>
              <h1>{tab === "Overview" ? "Your money, in focus." : tab}</h1>
              <p>{tab === "Overview" ? "A clearer picture of your finances starts here." : "Explore and manage your personal finance workspace."}</p>
            </div>
            <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={17} /> Add transaction</button>
          </section>

          {tab === "Overview" && <>
            <section className="balance-grid">
              <article className="balance-card">
                <div className="card-top"><span>Total available balance</span><span className="balance-icon"><Wallet size={18} /></span></div>
                <div className="balance-value">{money(balance)}</div>
                <div className="balance-foot"><span className="trend-up"><TrendingUp size={14} /> Live demo calculation</span><span>Across demo records</span></div>
                <div className="balance-glow" />
              </article>
              <article className="metric-card"><div className="metric-heading"><span>Income</span><span className="metric-icon income-icon"><ArrowDownLeft size={17} /></span></div><strong>{money(income)}</strong><small><span className="positive">↑</span> Recorded inflows</small><div className="mini-bars income-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
              <article className="metric-card"><div className="metric-heading"><span>Expenses</span><span className="metric-icon expense-icon"><ArrowUpRight size={17} /></span></div><strong>{money(expenses)}</strong><small><span className="muted">•</span> Recorded outflows</small><div className="mini-bars expense-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            </section>

            <section className="content-grid">
              <article className="panel transactions-panel">
                <div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest money movements</p></div><button className="text-btn" onClick={() => setTab("Transactions")}>View all <span>→</span></button></div>
                <TransactionList items={transactions.slice(0, 5)} />
              </article>
              <article className="panel budget-panel">
                <div className="panel-heading"><div><h2>Budget snapshot</h2><p>October 2026 · Demo plan</p></div><button className="more-btn" aria-label="Budget options">•••</button></div>
                <div className="budget-total"><strong>{money(856000)}</strong><span>of {money(1200000)}</span></div>
                <div className="progress-track"><div style={{ width: "71.3%" }} /></div>
                <div className="budget-caption"><span>71% used</span><b>{money(344000)} left</b></div>
                <div className="budget-categories">
                  <BudgetLine label="Food & groceries" amount="TSh 245,000" percent={78} color="blue" />
                  <BudgetLine label="Transport" amount="TSh 96,000" percent={48} color="purple" />
                  <BudgetLine label="Utilities" amount="TSh 85,000" percent={62} color="orange" />
                </div>
                <button className="secondary-btn" onClick={() => setTab("Budgets")}>Manage budgets</button>
              </article>
            </section>

            <section className="insight-banner">
              <div className="insight-symbol"><Sparkles size={20} /></div>
              <div><span className="insight-label">YOUR FINANCIAL CHECK-IN</span><h3>Small steps make stronger money habits.</h3><p>Start by recording today's spending and reviewing your weekly budget.</p></div>
              <button className="insight-action" onClick={() => setTab("AI Accountant")}>Explore AI tools <span>→</span></button>
            </section>
          </>}

          {tab === "Transactions" && <section className="panel full-panel"><div className="panel-heading"><div><h2>All transactions</h2><p>Review income and expenses in your ledger</p></div><button className="secondary-btn compact"><Download size={15}/> Export</button></div><div className="search-box"><Search size={17}/><input aria-label="Search transactions" placeholder="Search transactions or categories..." value={query} onChange={e => setQuery(e.target.value)}/></div><TransactionList items={filtered}/>{filtered.length === 0 && <p className="empty-state">No matching transactions found.</p>}</section>}


          {tab === "Budgets" && <section className="panel full-panel">
            <div className="panel-heading"><div><h2>Budget management</h2><p>Set spending limits and monitor demo spending by category</p></div><button className="primary-btn" onClick={()=>{setBudgetFormOpen(v=>!v);setFormError("");}}><Plus size={15}/> Create budget</button></div>
            <div className="demo-notice">DEMO WORKSPACE — changes stay in this page session and are not saved to your account.</div>
            <div className="budget-summary-grid"><div><small>Total planned</small><b>{money(budgets.reduce((n,b)=>n+b.limit,0))}</b></div><div><small>Spent so far</small><b>{money(budgets.reduce((n,b)=>n+b.spent,0))}</b></div><div><small>Remaining</small><b>{money(budgets.reduce((n,b)=>n+b.limit-b.spent,0))}</b></div></div>
            {budgetFormOpen && <form className="inline-management-form" onSubmit={event=>{event.preventDefault();const limit=Number(budgetForm.limit);if(!budgetForm.name.trim()||!Number.isSafeInteger(limit)||limit<=0){setFormError("Enter a name and a valid whole-number TZS limit.");return;}if(budgets.some(b=>b.category===budgetForm.category)){setFormError("A budget already exists for this category in this demo.");return;}setBudgets(current=>[...current,{id:Math.max(0,...current.map(b=>b.id))+1,name:budgetForm.name.trim(),category:budgetForm.category,limit,spent:0}]);setBudgetForm({name:"",category:"Food",limit:""});setBudgetFormOpen(false);setFormError("");}}>
              <label>Budget name<input required maxLength={80} value={budgetForm.name} onChange={e=>setBudgetForm({...budgetForm,name:e.target.value})} placeholder="e.g. Weekly groceries"/></label>
              <label>Expense category<select value={budgetForm.category} onChange={e=>setBudgetForm({...budgetForm,category:e.target.value})}>{categories.filter(c=>c.active&&c.type==="expense").map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
              <label>Limit (TZS)<input required type="number" min="1" step="1" value={budgetForm.limit} onChange={e=>setBudgetForm({...budgetForm,limit:e.target.value})} placeholder="e.g. 150000"/></label>
              {formError&&<p className="inline-error" role="alert">{formError}</p>}<div className="inline-form-actions"><button type="button" className="secondary-btn" onClick={()=>setBudgetFormOpen(false)}>Cancel</button><button type="submit" className="primary-btn">Save budget</button></div>
            </form>}
            <div className="managed-budgets">{budgets.map(b=>{const pct=b.limit>0?Math.round(b.spent/b.limit*100):0;return <article className="managed-budget" key={b.id}><div className="managed-budget-head"><div><b>{b.name}</b><small>{b.category}</small></div><strong>{money(b.spent)} <span>/ {money(b.limit)}</span></strong></div><div className="progress-track"><div className={pct>=100?"over-budget":pct>=80?"near-budget":""} style={{width:`${Math.min(pct,100)}%`}}/></div><div className="managed-budget-foot"><span>{pct}% used</span><span>{pct>100?money(b.spent-b.limit)+" over":money(b.limit-b.spent)+" remaining"}</span><button className="text-btn" onClick={()=>setBudgets(current=>current.filter(item=>item.id!==b.id))}>Remove</button></div></article>})}</div>
          </section>}
          {tab === "Categories" && <section className="panel full-panel">
            <div className="panel-heading"><div><h2>Category management</h2><p>Organise income and expense labels used in your ledger</p></div><button className="primary-btn" onClick={()=>{setCategoryFormOpen(v=>!v);setFormError("");}}><Plus size={15}/> Add category</button></div>
            <div className="demo-notice">DEMO WORKSPACE — category changes are temporary and do not modify backend records.</div>
            {categoryFormOpen && <form className="inline-management-form category-form" onSubmit={event=>{event.preventDefault();const name=categoryForm.name.trim();if(name.length<2){setFormError("Category name must contain at least 2 characters.");return;}if(categories.some(c=>c.type===categoryForm.type&&c.name.toLowerCase()===name.toLowerCase())){setFormError("That category already exists for this type.");return;}setCategories(current=>[...current,{id:Math.max(0,...current.map(c=>c.id))+1,name,type:categoryForm.type,system:false,active:true}]);setCategoryForm({name:"",type:"expense"});setCategoryFormOpen(false);setFormError("");}}>
              <label>Category name<input required minLength={2} maxLength={40} value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm,name:e.target.value})} placeholder="e.g. Mobile data"/></label><label>Category type<select value={categoryForm.type} onChange={e=>setCategoryForm({...categoryForm,type:e.target.value as "income"|"expense"})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
              {formError&&<p className="inline-error" role="alert">{formError}</p>}<div className="inline-form-actions"><button type="button" className="secondary-btn" onClick={()=>setCategoryFormOpen(false)}>Cancel</button><button type="submit" className="primary-btn">Save category</button></div>
            </form>}
            <div className="category-columns">{(["income","expense"] as const).map(type=><div className="category-group" key={type}><h3>{type==="income"?"Income categories":"Expense categories"} <span>{categories.filter(c=>c.type===type&&c.active).length}</span></h3>{categories.filter(c=>c.type===type).map(c=><div className={`category-row ${c.active?"":"category-disabled"}`} key={c.id}><div><b>{c.name}</b><small>{c.system?"System category":"Custom category"} · {c.active?"Active":"Inactive"}</small></div>{!c.system&&<button className="text-btn" onClick={()=>setCategories(current=>current.map(item=>item.id===c.id?{...item,active:!item.active}:item))}>{c.active?"Deactivate":"Activate"}</button>}</div>)}</div>)}</div>
          </section>}

          {tab === "Reports" && <section className="panel full-panel"><div className="panel-heading"><div><h2>Financial summary</h2><p>October 2026 · Based on demo transactions</p></div><span className="demo-pill">SAMPLE REPORT</span></div><div className="report-stats"><div><small>Total income</small><b>{money(income)}</b></div><div><small>Total expenses</small><b>{money(expenses)}</b></div><div><small>Net cash flow</small><b className="positive">{money(balance)}</b></div></div><div className="report-note"><BookOpen size={19}/><p>Detailed trends, category analysis, exports and financial health scoring will be added in the reporting phase.</p></div></section>}

          {tab === "AI Accountant" && <section className="panel ai-panel"><div className="ai-orb"><Sparkles size={28}/></div><span className="insight-label">MWECau GUIDER INTELLIGENCE</span><h2>Your personal AI accountant.</h2><p>Ask questions about budgeting, spending habits and financial planning. AI advice will be connected to your verified financial records in a later phase.</p><div className="ai-example"><span>Try asking</span><button onClick={() => setQuery("food")}>How much did I spend on food?</button><button onClick={() => setQuery("income")}>How can I plan my monthly income?</button></div><div className="coming-soon"><Sparkles size={15}/> AI assistant is not connected in this demo build.</div></section>}
          <footer className="footer"><span>MWECau GUIDER <i>·</i> Built for smarter financial habits in Tanzania</span><span>Designed & developed by <b>JOHN ONLINE SERVICES AND APPLICATIONS</b> · Developer: <b>John Charles Sarwi</b> · <a href="https://john-charles-sarwi-portfolio.vercel.app/" target="_blank" rel="noreferrer">Portfolio</a></span></footer>
        </div>
      </main>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">LEDGER ENTRY</span><h2 id="modal-title">Add transaction</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={() => setShowForm(false)}><X size={20}/></button></div><form onSubmit={addTransaction}><label>Transaction type<select value={form.kind} onChange={e => { const kind=e.target.value as "income"|"expense"; const first=categories.find(c=>c.active&&c.type===kind); setForm({...form,kind,category:first?.name??""}); }}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Description<input required maxLength={80} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Electricity bill"/></label><label>Amount (TZS)<input required type="number" min="1" step="1" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="Enter amount"/></label><label>Category<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.filter(c=>c.active&&c.type===form.kind).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-btn"><Check size={16}/> Save entry</button></div><p className="form-disclaimer">Demo only: entries are stored in this browser session and are not sent to a server.</p></form></section></div>}
    </div>
  );
}

function TransactionList({ items }: { items: Transaction[] }) {
  if (!items.length) return <p className="empty-state">No transactions yet. Add your first entry to get started.</p>;
  return <div className="transaction-list">{items.map(item => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? <ArrowDownLeft size={17}/> : <CreditCard size={16}/>}</div><div className="transaction-name"><b>{item.title}</b><small>{item.category} <i>·</i> {item.date}</small></div><strong className={item.kind === "income" ? "positive" : "amount-out"}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</strong></div>)}</div>;
}

function BudgetLine({label, amount, percent, color}: {label:string;amount:string;percent:number;color:string}) {
  return <div className="budget-line"><div><span>{label}</span><b>{amount}</b></div><div className="progress-track"><div className={color} style={{width:`${percent}%`}}/></div></div>;
}

export default App;