import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BookOpen,
  CalendarDays, Check, ChevronDown, CircleHelp, CreditCard, Download,
  LayoutDashboard, Menu, Plus, Search, Settings, ShieldCheck, Sparkles,
  Target, TrendingUp, Wallet, X
} from "lucide-react";

type Transaction = { id: number; title: string; category: string; date: string; amount: number; kind: "income" | "expense" };
type Tab = "Overview" | "Transactions" | "Budgets" | "Reports" | "AI Accountant";

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

          {tab === "Budgets" && <section className="panel full-panel"><div className="panel-heading"><div><h2>Monthly budgets</h2><p>Keep spending aligned with your priorities</p></div><span className="demo-pill">OCTOBER 2026</span></div><div className="budget-large"><strong>{money(856000)}</strong><span> spent of {money(1200000)} planned</span><div className="progress-track"><div style={{width:"71.3%"}}/></div></div><div className="budget-categories expanded"><BudgetLine label="Food & groceries" amount="TSh 245,000 / 315,000" percent={78} color="blue"/><BudgetLine label="Transport" amount="TSh 96,000 / 200,000" percent={48} color="purple"/><BudgetLine label="Utilities" amount="TSh 85,000 / 137,000" percent={62} color="orange"/><BudgetLine label="Education" amount="TSh 430,000 / 548,000" percent={78} color="green"/></div></section>}

          {tab === "Reports" && <section className="panel full-panel"><div className="panel-heading"><div><h2>Financial summary</h2><p>October 2026 · Based on demo transactions</p></div><span className="demo-pill">SAMPLE REPORT</span></div><div className="report-stats"><div><small>Total income</small><b>{money(income)}</b></div><div><small>Total expenses</small><b>{money(expenses)}</b></div><div><small>Net cash flow</small><b className="positive">{money(balance)}</b></div></div><div className="report-note"><BookOpen size={19}/><p>Detailed trends, category analysis, exports and financial health scoring will be added in the reporting phase.</p></div></section>}

          {tab === "AI Accountant" && <section className="panel ai-panel"><div className="ai-orb"><Sparkles size={28}/></div><span className="insight-label">MWECau GUIDER INTELLIGENCE</span><h2>Your personal AI accountant.</h2><p>Ask questions about budgeting, spending habits and financial planning. AI advice will be connected to your verified financial records in a later phase.</p><div className="ai-example"><span>Try asking</span><button onClick={() => setQuery("food")}>How much did I spend on food?</button><button onClick={() => setQuery("income")}>How can I plan my monthly income?</button></div><div className="coming-soon"><Sparkles size={15}/> AI assistant is not connected in this demo build.</div></section>}
          <footer className="footer"><span>MWECau GUIDER <i>·</i> Built for smarter financial habits in Tanzania</span><span>Designed & developed by <b>JOHN ONLINE SERVICES AND APPLICATIONS</b> · Developer: <b>John Charles Sarwi</b> · <a href="https://john-charles-sarwi-portfolio.vercel.app/" target="_blank" rel="noreferrer">Portfolio</a></span></footer>
        </div>
      </main>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">LEDGER ENTRY</span><h2 id="modal-title">Add transaction</h2></div><button className="icon-btn" aria-label="Close dialog" onClick={() => setShowForm(false)}><X size={20}/></button></div><form onSubmit={addTransaction}><label>Transaction type<select value={form.kind} onChange={e => setForm({...form, kind: e.target.value as "income" | "expense"})}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Description<input required maxLength={80} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Electricity bill"/></label><label>Amount (TZS)<input required type="number" min="1" step="1" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="Enter amount"/></label><label>Category<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{["Other","Food","Transport","Education","Utilities","Health","Side income"].map(c=><option key={c}>{c}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-btn"><Check size={16}/> Save entry</button></div><p className="form-disclaimer">Demo only: entries are stored in this browser session and are not sent to a server.</p></form></section></div>}
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