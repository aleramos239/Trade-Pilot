"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OperatorLogin() {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("operator@tradecopilot.local");
  const [password, setPassword] = useState("");

  async function signIn(demo = false) {
    setError("");
    setIsSigningIn(true);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo ? { demo: true } : { email, password }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Could not start the operator session.");
        return;
      }

      router.refresh();
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#081016] px-4 text-slate-100">
      <section className="w-full max-w-xl rounded-lg border border-white/10 bg-[#0d151d] p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-cyan-300 text-slate-950">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Trade Copilot
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Operator session required</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-400">
          This local build now protects the dashboard behind a demo operator session. Production
          auth should be replaced with a real provider before live broker credentials are connected.
        </p>
        <div className="mt-6 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-11 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="demo"
              className="h-11 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => signIn(false)}
          disabled={isSigningIn}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={16} aria-hidden="true" />
          {isSigningIn ? "Starting session" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={() => signIn(true)}
          disabled={isSigningIn}
          className="ml-2 mt-6 inline-flex h-11 items-center rounded-md border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          Demo session
        </button>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>
    </main>
  );
}
