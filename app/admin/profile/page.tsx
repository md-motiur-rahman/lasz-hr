"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password reset flow
  const [pwEmail, setPwEmail] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSending, setPwSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) {
          if (!mounted) return;
          setError("Please sign in.");
          setLoading(false);
          return;
        }
        const u = userRes.user;
        if (!mounted) return;
        setUserId(u.id);
        setEmail(u.email || "");
        setPwEmail(u.email || "");

        // Load profile row
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, company_name")
          .eq("user_id", u.id)
          .maybeSingle();
        if (profErr) {
          if (!mounted) return;
          setError("Could not load profile");
        } else {
          if (!mounted) return;
          setFullName(prof?.full_name || "");
          setCompanyName(prof?.company_name || "");
        }
      } catch (e) {
        if (!mounted) return;
        setError("Unexpected error loading profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            email,
            full_name: fullName || null,
            company_name: companyName || null,
            role: "business_admin",
          },
          { onConflict: "user_id" }
        );
      if (upErr) throw upErr;
      setMessage("Profile updated.");
    } catch (e: any) {
      setError(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    setPwError(null);
    if (!pwEmail || !email || pwEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setPwError("Email does not match your account email.");
      return;
    }
    setPwSending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || "");
      const redirectTo = `${origin}/auth/update-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(pwEmail, { redirectTo });
      if (resetErr) throw resetErr;
      setPwMessage("Password reset link sent. Check your email to continue.");
    } catch (e: any) {
      setPwError(e?.message || "Could not send reset email.");
    } finally {
      setPwSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <nav className="text-sm text-slate-600">
            <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-900 font-medium">Admin profile</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile editor */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
                <p className="text-sm text-slate-600 mt-1">Update your admin details.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {loading ? (
                <p className="text-sm text-slate-600">Loading…</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-800">Full name</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800">Company name</label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                      placeholder="Company Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800">Email</label>
                    <input
                      value={email}
                      disabled
                      className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email changes require security verification and are not editable here.</p>
                  </div>

                  {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                  {message && <p className="text-sm text-emerald-700">{message}</p>}

                  <div className="pt-2">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Password change */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
            <p className="text-sm text-slate-600 mt-1">For security, verify your admin email to receive a reset link.</p>

            <form onSubmit={sendPasswordReset} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800">Verify email</label>
                <input
                  type="email"
                  value={pwEmail}
                  onChange={(e) => setPwEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  placeholder="admin@company.com"
                />
                <p className="text-xs text-slate-500 mt-1">Enter your account email to receive a password reset link.</p>
              </div>

              {pwError && <p className="text-sm text-red-600" role="alert">{pwError}</p>}
              {pwMessage && <p className="text-sm text-emerald-700">{pwMessage}</p>}

              <div>
                <button
                  type="submit"
                  disabled={pwSending}
                  className="inline-flex items-center h-10 px-5 rounded-md bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-60"
                >
                  {pwSending ? "Sending…" : "Send reset link"}
                </button>
              </div>

              <div className="text-xs text-slate-500">
                You will be redirected to a secure page to set a new password after clicking the email link.
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
