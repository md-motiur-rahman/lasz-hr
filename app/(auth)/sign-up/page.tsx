"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { log } from "console";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    // First, check if email already exists (server-side check uses service role if available)
    try {
      const resp = await fetch("/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const body = await resp.json();
      if (body.supported && body.exists) {
        setLoading(false);
        setError("An account with this email already exists.");
        return;
      }
    } catch (err) {
      console.warn("email check failed:", err);
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "business_admin",
          full_name: fullName,
          company_name: companyName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    try {
      const { error: insertError } = await supabase.from("profiles").insert({
        email,
        full_name: fullName,
        company_name: companyName,
        role: "business_admin",
      });
      if (insertError) {
        console.warn("profiles insert failed:", insertError.message);
      }
    } catch (err) {
      console.warn("profiles insert exception:", err);
    }

    setLoading(false);
    if (signUpData?.session) {
      router.replace("/company/profile");
      return;
    }
    setMessage(
      "Sign-up successful. Please check your email to confirm your account before signing in."
    );
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
          <h1 className="text-3xl font-semibold text-slate-900">Create your admin account</h1>
          <p className="mt-3 text-slate-600 max-w-md">
            Get full access free for 7 days after completing your company profile.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">Faster onboarding</p>
              <p className="text-xs text-slate-500 mt-1">Invite your team in minutes</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-800">Everything included</p>
              <p className="text-xs text-slate-500 mt-1">Employee DB, leave, rota, payroll</p>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div className="w-full">
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Sign up for LASZ HR</h2>
              <p className="text-sm text-slate-600 mt-1">Business admin</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800">Work email</label>
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
                <label className="block text-sm font-medium text-slate-800">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="••••••••"
                />
                <p className="text-xs text-slate-500 mt-1">Minimum 6 characters.</p>
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {message && <p className="text-sm text-emerald-700">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-indigo-600 text-white font-medium shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-600">
              Already have an account? {" "}
              <Link href="/sign-in" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
