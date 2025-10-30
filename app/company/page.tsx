import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import ProtectedShell from "@/components/ProtectedShell";
import Link from "next/link";
import Stripe from "stripe";

export default async function CompanyOverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = await supabase
    .from("companies")
    .select(
      "company_name, address, phone, company_email, paye_ref, accounts_office_ref, subscription_status, trial_start_at, trial_end_at, stripe_subscription_id"
    )
    .eq("owner_user_id", user?.id as string)
    .maybeSingle();

  const status = company?.subscription_status ?? null;
  const trialEnd = company?.trial_end_at ? new Date(company.trial_end_at) : null;
  const trialDaysRemaining = trialEnd
    ? Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // For active subscriptions, compute next billing date and days remaining from Stripe
  let nextBilling: Date | null = null;
  let daysToNext: number | null = null;
  if (status === "active" && company?.stripe_subscription_id) {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) {
      try {
        const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });
        const sub = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
        if (sub.current_period_end) {
          nextBilling = new Date(sub.current_period_end * 1000);
          daysToNext = Math.ceil((nextBilling.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
        // Reconcile DB status with Stripe if different
        const newStatus = sub.status === "canceled" ? "canceled" : (sub.status === "past_due" ? "past_due" : (sub.status === "active" ? "active" : null));
        if (newStatus && newStatus !== status) {
          try {
            await supabase
              .from("companies")
              .update({ subscription_status: newStatus, stripe_subscription_id: newStatus === "canceled" ? null : company.stripe_subscription_id })
              .eq("owner_user_id", user?.id as string);
          } catch {}
        }
      } catch (e) {
        // ignore errors; show fallback UI
      }
    }
  }

  const StatusBadge = () => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
          Active
        </span>
      );
    }
    if (status === "trialing") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
          Trial
        </span>
      );
    }
    if (status === "past_due") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
          Past due
        </span>
      );
    }
    if (status === "canceled") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18 18 6"/></svg>
          Canceled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l3 3"/></svg>
        Inactive
      </span>
    );
  };

  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        {/* Hero banner */}
        <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#ede9fe_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Company Overview</p>
                <h1 className="mt-1 text-3xl sm:text-4xl font-semibold text-slate-900">
                  {company?.company_name || "Your Company"}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <StatusBadge />
                  {status === "trialing" && trialEnd && (
                    <span>
                      Trial ends {trialEnd.toLocaleDateString()}
                      {typeof trialDaysRemaining === "number" && trialDaysRemaining >= 0 && (
                        <> ({trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} left)</>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/company/profile" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800">Edit profile</Link>
                <Link href="/employees" className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Manage team</Link>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-slate-500">Status</div>
                <div className="mt-2"><StatusBadge /></div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-slate-500">{status === "active" ? "Next billing" : "Trial end"}</div>
                <div className="mt-2 font-medium text-slate-900">{status === "active" ? (nextBilling ? nextBilling.toLocaleDateString() : "—") : (trialEnd ? trialEnd.toLocaleDateString() : "—")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-slate-500">Days remaining</div>
                <div className="mt-2 font-medium text-slate-900">{status === "active" ? ((typeof daysToNext === "number" && daysToNext >= 0) ? daysToNext : "—") : ((typeof trialDaysRemaining === "number" && trialDaysRemaining >= 0) ? trialDaysRemaining : "—")}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Content grid */}
        <main className="w-full max-w-7xl mx-auto px-4 py-10 grid gap-6 lg:grid-cols-3">
          {/* Left column (2/3) */}
          <section className="lg:col-span-2 space-y-6">
            {/* Organization */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
                <Link href="/company/profile" className="text-sm text-indigo-600 hover:text-indigo-700">Edit</Link>
              </div>
              {company ? (
                <div className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
                  <div>
                    <div className="text-slate-500">Company name</div>
                    <div className="font-medium text-slate-950">{company.company_name}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Company email</div>
                    <div className="font-medium text-slate-950">{company.company_email || "—"}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-slate-500">Address</div>
                    <div className="font-medium text-slate-950 whitespace-pre-line">{company.address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Phone</div>
                    <div className="font-medium text-slate-950">{company.phone || "—"}</div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-slate-600">No company profile found. Please complete your profile.</p>
              )}
            </div>

            {/* Identifiers & Links */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900">Identifiers</h3>
                <div className="mt-4 grid gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">PAYE reference</div>
                    <div className="font-medium text-slate-950">{company?.paye_ref || "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Accounts Office ref</div>
                    <div className="font-medium text-slate-950">{company?.accounts_office_ref || "—"}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900">Quick links</h3>
                <ul className="mt-4 grid gap-2 text-sm text-slate-700 list-disc list-inside">
                  <li><Link className="underline" href="/employees">Employees</Link></li>
                  <li><Link className="underline" href="/rota">Rota</Link></li>
                  <li><Link className="underline" href="/leave">Leave</Link></li>
                  <li><Link className="underline" href="/payroll">Payroll</Link></li>
                </ul>
              </div>
            </div>
          </section>

          {/* Right column (1/3) */}
          <aside className="space-y-6">
            {/* Subscription */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Subscription</h2>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge />
              </div>
              <div className="mt-3 text-sm text-slate-700">
                {status === "trialing" && trialEnd && (
                  <>Trial ends on <span className="font-medium">{trialEnd.toLocaleDateString()}</span>{typeof trialDaysRemaining === "number" && trialDaysRemaining >= 0 && (<> ({trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} left)</>)}.</>
                )}
                {status === "active" && (
                  <>Next billing on <span className="font-medium">{nextBilling ? nextBilling.toLocaleDateString() : "—"}</span>{typeof daysToNext === "number" && daysToNext >= 0 && (<> ({daysToNext} day{daysToNext === 1 ? "" : "s"} left)</>)}.</>
                )}
                {status === "canceled" && <>Subscription canceled</>}
                {!status && <>No subscription yet</>}
              </div>
              <div className="mt-4 flex gap-3">
                <Link href="/company/profile" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800">Edit company</Link>
                <Link href="/payroll" className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Billing</Link>
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Get started</h2>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
                  Complete your company profile
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
                  Invite employees and assign roles
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 13 4 4 10-10"/></svg>
                  Set up your rota and leave policies
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </ProtectedShell>
  );
}
