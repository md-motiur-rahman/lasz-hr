"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedShell from "@/components/ProtectedShell";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [subscriptionStatus, setSubscriptionStatus] = useState<"trialing" | "active" | "past_due" | "canceled" | null>(null);
  const [trialStart, setTrialStart] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [stripeSubId, setStripeSubId] = useState<string | null>(null);

  const [nextBillingAt, setNextBillingAt] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean | null>(null);
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Derived values
  const daysToNextBilling = useMemo(() => {
    if (!nextBillingAt) return null;
    const end = new Date(nextBillingAt).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }, [nextBillingAt]);

  const trialDaysRemaining = useMemo(() => {
    if (!trialEnd) return null;
    const end = new Date(trialEnd).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }, [trialEnd]);

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

        const { data: company, error: compErr } = await supabase
          .from("companies")
          .select("subscription_status, trial_start_at, trial_end_at, stripe_customer_id, stripe_subscription_id")
          .eq("owner_user_id", userRes.user.id)
          .maybeSingle();
        if (compErr) throw compErr;
        if (!mounted) return;

        setSubscriptionStatus(company?.subscription_status ?? null);
        setTrialStart(company?.trial_start_at ?? null);
        setTrialEnd(company?.trial_end_at ?? null);
        setStripeCustomerId(company?.stripe_customer_id ?? null);
        setStripeSubId(company?.stripe_subscription_id ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch next billing when active
  useEffect(() => {
    let cancelled = false;
    async function loadNextBilling() {
      setNextBillingAt(null);
      if (subscriptionStatus !== "active" || !stripeSubId) return;
      try {
        const resp = await fetch(`/api/billing/subscription?subId=${encodeURIComponent(stripeSubId)}`, { cache: "no-store" });
        const data = await resp.json();
        if (!cancelled) {
          if (data?.nextBillingAt) setNextBillingAt(data.nextBillingAt);
          setCancelAtPeriodEnd(Boolean(data?.cancelAtPeriodEnd));
          setCancelAt(data?.cancelAt || null);
        }
      } catch {
        if (!cancelled) setNextBillingAt(null);
      }
    }
    loadNextBilling();
    return () => { cancelled = true; };
  }, [subscriptionStatus, stripeSubId]);

  async function cancelSubscription() {
    if (subscriptionStatus !== "active" || !stripeSubId) return;
    if (!confirm("Cancel subscription at period end?")) return;
    setCancelLoading(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atPeriodEnd: true }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || "Cancel failed");
      setMessage(body.message || "Subscription will cancel at period end.");
      // Optionally refresh the next billing date or flags
      if (body?.nextBillingAt) setNextBillingAt(body.nextBillingAt);
      if (typeof body?.cancelAtPeriodEnd === "boolean") setCancelAtPeriodEnd(body.cancelAtPeriodEnd);
      if (body?.cancelAt) setCancelAt(body.cancelAt);
    } catch (e: any) {
      setError(e?.message || "Cancel failed");
    } finally {
      setCancelLoading(false);
    }
  }

  function StatusBadge() {
    if (subscriptionStatus === "active") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
          Active
        </span>
      );
    }
    if (subscriptionStatus === "trialing") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
          Trial
        </span>
      );
    }
    if (subscriptionStatus === "past_due") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
          Past due
        </span>
      );
    }
    if (subscriptionStatus === "canceled") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18 18 6"/></svg>
          Canceled
        </span>
      );
    }
    return <span className="text-xs text-slate-600">—</span>;
  }

  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        <section className="w-full border-b">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-600 mt-1">Manage your subscription and trial.</p>
          </div>
        </section>

        <main className="max-w-5xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-3">
          {/* Left: subscription overview */}
          <section className="lg:col-span-2 grid gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>
              <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-slate-500">Status</div>
                  <div className="mt-2"><StatusBadge /></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-slate-500">{subscriptionStatus === "active" ? "Next billing" : "Trial end"}</div>
                  <div className="mt-2 font-medium text-slate-900">
                    {subscriptionStatus === "active" ? (nextBillingAt ? new Date(nextBillingAt).toLocaleDateString() : "—") : (trialEnd ? new Date(trialEnd).toLocaleDateString() : "—")}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-slate-500">Days remaining</div>
                  <div className="mt-2 font-medium text-slate-900">
                    {subscriptionStatus === "active"
                      ? (typeof daysToNextBilling === "number" && daysToNextBilling >= 0 ? daysToNextBilling : "—")
                      : (typeof trialDaysRemaining === "number" && trialDaysRemaining >= 0 ? trialDaysRemaining : "—")}
                  </div>
                </div>
              </div>

              {subscriptionStatus === "active" && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={cancelSubscription}
                      disabled={cancelLoading || cancelAtPeriodEnd === true}
                      className="inline-flex items-center h-10 px-4 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {cancelLoading ? "Cancelling…" : (cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel subscription")}
                    </button>
                    {cancelAtPeriodEnd && (
                      <span className="text-xs text-slate-600">Scheduled to cancel on {cancelAt ? new Date(cancelAt).toLocaleDateString() : "period end"}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Cancels at period end. You will retain access until the end of the current billing cycle.</p>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
            </div>

            {/* Trial history */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Trial history</h2>
              <div className="mt-4 text-sm">
                {(trialStart || trialEnd) ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-slate-500">Trial start</div>
                      <div className="mt-1 font-medium text-slate-900">{trialStart ? new Date(trialStart).toLocaleDateString() : "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Trial end</div>
                      <div className="mt-1 font-medium text-slate-900">{trialEnd ? new Date(trialEnd).toLocaleDateString() : "—"}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-600">No trial history found.</p>
                )}
              </div>
            </div>
          </section>

          {/* Right column intentionally left blank (removed identifiers for confidentiality) */}
          <aside className="space-y-6"></aside>
        </main>
      </div>
    </ProtectedShell>
  );
}
