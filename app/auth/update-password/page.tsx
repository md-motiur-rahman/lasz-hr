"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // When arriving via password recovery link, Supabase sets a recovery session.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        // If no error, user is at least in a session; proceed.
        if (!mounted) return;
      } catch (e) {
        if (!mounted) return;
        setError("Invalid or expired password reset link.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      setMessage("Password updated. You can now close this tab or go to the dashboard.");
    } catch (e: any) {
      setError(e?.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Set a new password</h1>
        <p className="text-sm text-slate-600 mt-1">Enter your new password below.</p>

        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Checking reset link…</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Updating…" : "Update password"}
              </button>
              <Link href="/dashboard" className="text-sm text-slate-700 hover:text-slate-900">Go to dashboard</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
