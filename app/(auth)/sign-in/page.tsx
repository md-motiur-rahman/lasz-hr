"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Use server-side route to establish session cookies for middleware
    const resp = await fetch("/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.error || "Failed to sign in");
      return;
    }

    // After cookies are set, navigate to the next route returned by the server
    const body = await resp.json().catch(() => ({}));
    const next = body.next || "/company/profile";
    window.location.assign(next);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 mask-[radial-gradient(60%_50%_at_50%_0%,black,transparent)]">
        <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-indigo-100" />
        <div className="absolute -top-12 right-0 h-64 w-64 rounded-full bg-emerald-100" />
        <div className="absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-amber-100" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 py-6 flex items-center">
        <Logo width={160} height={38} />
      </header>

      {/* Main */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 pb-16 grid md:grid-cols-2 gap-8 items-center">
        {/* Intro panel (hidden on small screens) */}
        <div className="hidden md:block">
          <h1 className="text-3xl font-semibold text-slate-900">
            Welcome back
          </h1>
          <p className="mt-3 text-slate-600 max-w-md">
            Sign in to manage employees, schedules, time off and payroll in one
            place.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">
                All-in-one HR
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Simple workflows for growing teams
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">
                Secure access
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Role-based and privacy-first
              </p>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div className="w-full">
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                Sign in to LASZ HR
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Business admin access
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-800">
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Forgot?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-indigo-600 text-white font-medium shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-600">
              Don’t have an account?{" "}
              <Link
                href="/sign-up"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Create one
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
