import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { LockKeyhole, Mail, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { clearUserOfflineData } from "../lib/offlineStore";
import { apiRequest } from "../lib/api";
import { API_UNAVAILABLE_MESSAGE, isApiConfigured } from "../lib/apiConfig";

export type AuthUser = { id: number; name: string; email: string };
type AuthContextValue = { user: AuthUser; logout: () => Promise<void>; expireSession: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
const request = apiRequest;

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await request<{ user: AuthUser }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ ...(mode === "register" ? { name: name.trim() } : {}), email: email.trim(), password }),
      });
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><div className="auth-logo"><Wallet size={23}/></div><div><b>MWECau <span>GUIDER</span></b><small>PERSONAL FINANCE</small></div></div>
      <div className="auth-kicker"><ShieldCheck size={14}/> SECURE PERSONAL WORKSPACE</div>
      <h1>{mode === "login" ? "Welcome back." : "Create your account."}</h1>
      <p className="auth-intro">{mode === "login" ? "Sign in to access your personal finance workspace." : "Start building better financial habits with a private account."}</p>
      {!isApiConfigured && <p className="auth-error" role="status">{API_UNAVAILABLE_MESSAGE}</p>}
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && <label>Full name<span className="auth-input"><UserRound size={16}/><input required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></span></label>}
        <label>Email address<span className="auth-input"><Mail size={16}/><input required type="email" maxLength={190} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></span></label>
        <label>Password<span className="auth-input"><LockKeyhole size={16}/><input required type="password" minLength={mode === "register" ? 10 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "Enter your password"}/></span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy || !isApiConfigured}>{busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create secure account"}</button>
      </form>
      <p className="auth-switch">{mode === "login" ? "New to MWECau GUIDER?" : "Already have an account?"} <button onClick={()=>{setMode(mode === "login" ? "register" : "login");setError("");}}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
      <div className="auth-security"><ShieldCheck size={15}/><span>Protected with secure, server-managed sessions. Your password is never stored in this browser.</span></div>
    </section>
    <footer className="auth-footer">Designed & developed by <b>JOHN ONLINE SERVICES AND APPLICATIONS</b> · John Charles Sarwi</footer>
  </main>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthGate.");
  return value;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    request<{ user: AuthUser }>("/auth/me")
      .then(result => { if (active) setUser(result.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const logout = useCallback(async () => {
    if (!user) return;
    // Clear the signed-in account's encrypted local records before ending the session.
    await clearUserOfflineData(user.id);
    await request<{ message: string }>("/auth/logout", { method: "POST" });
    setUser(null);
  }, [user]);

  const expireSession = useCallback(async () => {
    if (!user) return;
    try {
      await clearUserOfflineData(user.id);
    } finally {
      setUser(null);
    }
  }, [user]);

  const context = useMemo(() => user ? { user, logout, expireSession } : null, [user, logout, expireSession]);

  if (checking) return <main className="auth-loading"><div className="auth-logo"><Wallet size={23}/></div><p>Checking your secure session…</p></main>;
  if (!user) return <AuthScreen onAuthenticated={setUser}/>;
  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
}
