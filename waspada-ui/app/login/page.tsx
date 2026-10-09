"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const configured = Boolean(getSupabase());

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/");
  }, [router, sessionLoading, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase is not configured. Add the project URL and publishable key to .env.local.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (mode === "sign-up" && fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      setSubmitting(false);
      if (signInError) {
        setError(signInError.message === "Invalid login credentials"
          ? "The email or password is incorrect."
          : signInError.message);
        return;
      }
      router.replace("/");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }
    setMessage("Account created. Check your email to confirm your address, then sign in.");
    setMode("sign-in");
    setPassword("");
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Waspada introduction">
        <div className="login-brand">
          <span className="brand-mark"><Icon name="pulse" size={25} /></span>
          <span>waspada<span className="brand-period">.</span><small>DRIVER INTELLIGENCE</small></span>
        </div>
        <p className="eyebrow"><span className="eyebrow-line" /> AWARENESS IN MOTION</p>
        <h1>Keep every journey<br />a little more aware.</h1>
        <p className="login-story-description">One secure workspace for your drivers, their vehicles, and every signal from the road.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <p className="panel-kicker">FLEET OPERATIONS</p>
          <h2>{mode === "sign-in" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="login-intro">{mode === "sign-in" ? "Sign in to open your driver dashboard." : "Set up a secure account for your fleet."}</p>

          <div className="auth-tabs" aria-label="Authentication method">
            <button type="button" className={mode === "sign-in" ? "selected" : ""} onClick={() => changeMode("sign-in")}>Sign in</button>
            <button type="button" className={mode === "sign-up" ? "selected" : ""} onClick={() => changeMode("sign-up")}>Create account</button>
          </div>

          <form className="login-form" onSubmit={(event) => void submit(event)}>
            {mode === "sign-up" && <label className="field"><span>Full name</span><input required autoComplete="name" maxLength={120} placeholder="Your name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
            <label className="field"><span>Email address</span><input required type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Password</span><input required type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {!configured && <div className="notice error" role="alert">Supabase is not configured. Complete <code>.env.local</code> before signing in.</div>}
            {error && <div className="notice error" role="alert">{error}</div>}
            {message && <div className="notice success" role="status">{message}</div>}
            <button className="primary-button login-submit" type="submit" disabled={submitting || sessionLoading || !configured}>
              {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="login-footnote">Your session is securely managed by Supabase Auth.</p>
        </div>
      </section>
    </main>
  );
}
