"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import Logo from "@/components/Logo";
import ProtectedShell from "@/components/ProtectedShell";

interface CompanyRecord {
  id?: string;
  owner_user_id: string;
  company_name: string;
  address?: string;
  phone?: string;
  company_email?: string;
  paye_ref?: string;
  accounts_office_ref?: string;
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | null;
  trial_start_at?: string | null;
  trial_end_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"company" | "payroll">("company");
  const [userId, setUserId] = useState<string | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState(""); // read-only
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [payeRef, setPayeRef] = useState("");
  const [accountsOfficeRef, setAccountsOfficeRef] = useState("");

  // Subscription-related
  const [subscriptionStatus, setSubscriptionStatus] = useState<CompanyRecord["subscription_status"]>(null);
  const [trialStart, setTrialStart] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);

  // Compute remaining trial days
  const trialDaysRemaining = useMemo(() => {
    if (!trialEnd) return null;
    const end = new Date(trialEnd).getTime();
    const now = Date.now();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  }, [trialEnd]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        if (!mounted) return;
        setError("Please sign in to manage your company profile.");
        setLoading(false);
        return;
      }
      const user = userRes.user;
      if (!mounted) return;
      setUserId(user.id);

      // Try to fetch existing company profile for this admin
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (companyErr) {
        console.warn("companies fetch failed:", companyErr.message);
      }

      if (company) {
        setCompanyName(company.company_name || "");
        setAddress(company.address || "");
        setPhone(company.phone || "");
        setCompanyEmail(company.company_email || "");
        setPayeRef(company.paye_ref || "");
        setAccountsOfficeRef(company.accounts_office_ref || "");
        setSubscriptionStatus(company.subscription_status ?? null);
        setTrialStart(company.trial_start_at ?? null);
        setTrialEnd(company.trial_end_at ?? null);
      } else {
        // Prefill from user metadata on first-time load
        const metaName = (user.user_metadata as any)?.company_name || "";
        setCompanyName(metaName);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    // Calculate trial fields only if not yet set
    const nowIso = new Date().toISOString();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const trialStartToSave = trialStart ?? nowIso;
    const trialEndToSave = trialEnd ?? end.toISOString();
    const statusToSave = subscriptionStatus ?? "trialing";

    const record: CompanyRecord = {
      owner_user_id: userId,
      company_name: companyName,
      address,
      phone,
      company_email: companyEmail,
      paye_ref: payeRef,
      accounts_office_ref: accountsOfficeRef,
      subscription_status: statusToSave,
      trial_start_at: trialStartToSave,
      trial_end_at: trialEndToSave,
    };

    try {
      const { error: upsertErr } = await supabase
        .from("companies")
        .upsert(record, { onConflict: "owner_user_id" });

      if (upsertErr) {
        setError(upsertErr.message);
        console.warn("companies upsert failed:", upsertErr.message);
        setSaving(false);
        return;
      }

      setTrialStart(trialStartToSave);
      setTrialEnd(trialEndToSave);
      setSubscriptionStatus(statusToSave);
      setMessage("Company profile saved. Your 7-day trial is now active.");
    } catch (err: any) {
      setError("Could not save company profile.");
      console.warn("companies upsert exception:", err);
    } finally {
      setSaving(false);
    }
  };

  // UI Helpers
  const TrialBadge = () => {
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
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
        Inactive
      </span>
    );
  };

  return (
    <ProtectedShell>
      <div className="min-h-screen relative overflow-hidden bg-white">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]">
          <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-indigo-100" />
          <div className="absolute -top-12 right-0 h-64 w-64 rounded-full bg-emerald-100" />
          <div className="absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-amber-100" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <Logo width={160} height={38} />
          <div className="flex items-center gap-2"><TrialBadge /></div>
        </header>

        <main className="relative z-10 w-full max-w-6xl mx-auto px-4 pb-16 grid lg:grid-cols-3 gap-6 items-start">
          {/* Left: content */}
          <section className="lg:col-span-2 space-y-6">
            {/* Title & trial summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Company profile</h1>
                  <p className="text-sm text-slate-600 mt-1">Complete your profile to activate the 7‑day trial.</p>
                </div>
                <TrialBadge />
              </div>
              {subscriptionStatus === "trialing" && trialEnd && (
                <div className="mt-3 text-sm text-slate-700">
                  Trial ends on <span className="font-medium">{new Date(trialEnd).toLocaleDateString()}</span>
                  {typeof trialDaysRemaining === "number" && trialDaysRemaining >= 0 && (
                    <> ({trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} left)</>
                  )}
                </div>
              )}
              {subscriptionStatus === "active" && (
                <div className="mt-3 text-sm text-slate-700">Subscription active. Thank you for choosing LASZ HR.</div>
              )}
              {!subscriptionStatus && (
                <div className="mt-3 text-sm text-slate-700">Start your 7-day free trial by completing your company profile.</div>
              )}
            </div>

            {/* Tabs */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="p-2 border-b bg-slate-50 flex gap-2">
                <button
                  className={`h-9 px-4 text-sm font-medium rounded-full transition ${
                    activeTab === "company" ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setActiveTab("company")}
                >
                  Company information
                </button>
                <button
                  className={`h-9 px-4 text-sm font-medium rounded-full transition ${
                    activeTab === "payroll" ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setActiveTab("payroll")}
                >
                  Payroll (UK)
                </button>
              </div>

              {loading ? (
                <div className="p-6">Loading...</div>
              ) : error ? (
                <div className="p-6 text-red-600">{error}</div>
              ) : (
                <div className="p-4 sm:p-6 grid gap-5">
                  {activeTab === "company" ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800">Company name</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          readOnly
                          className="mt-1 w-full rounded-md border border-indigo-200 px-3 py-2 bg-indigo-50 text-slate-950"
                        />
                        <p className="text-xs text-slate-500 mt-1">Name is set from your admin registration.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800">Address</label>
                        <textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={3}
                          className="mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-slate-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                          placeholder="Street, City, Postcode, Country"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-800">Phone</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-slate-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            placeholder="+44 20 1234 5678"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-800">Company email</label>
                          <input
                            type="email"
                            value={companyEmail}
                            onChange={(e) => setCompanyEmail(e.target.value)}
                            className="mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-slate-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                            placeholder="contact@yourcompany.com"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800">PAYE reference</label>
                        <input
                          type="text"
                          value={payeRef}
                          onChange={(e) => setPayeRef(e.target.value)}
                          className="mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-slate-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                          placeholder="123/AB45678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800">Accounts Office reference</label>
                        <input
                          type="text"
                          value={accountsOfficeRef}
                          onChange={(e) => setAccountsOfficeRef(e.target.value)}
                          className="mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-slate-950 placeholder:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                          placeholder="123PA00123456"
                        />
                      </div>
                      <p className="text-xs text-slate-500">These values appear on HMRC correspondence and employer PAYE letters.</p>
                    </>
                  )}

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {message && <p className="text-sm text-emerald-700">{message}</p>}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="inline-flex items-center h-11 px-6 rounded-lg text-white font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save profile"}
                    </button>
                    {subscriptionStatus !== "active" && (
                      <Link
                        href="/sign-in" // Placeholder for billing/checkout page
                        className="inline-flex items-center h-11 px-6 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                      >
                        Subscribe now
                      </Link>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    After completing your company profile, your 7-day trial starts automatically. To continue using LASZ HR after the trial, subscribe for £30/month.
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right: summary card */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Status</h3>
              <div className="mt-3 flex items-center gap-2"><TrialBadge /></div>
              <div className="mt-3 text-sm text-slate-700">
                {subscriptionStatus === "trialing" && trialEnd && (
                  <>Trial ends on <span className="font-medium">{new Date(trialEnd).toLocaleDateString()}</span></>
                )}
                {subscriptionStatus === "active" && <>Subscription active</>}
                {!subscriptionStatus && <>Not started</>}
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
                  Employee DB, Leave, Rota, Payroll
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
                  7‑day free trial, no card required
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </ProtectedShell>
  );
}
