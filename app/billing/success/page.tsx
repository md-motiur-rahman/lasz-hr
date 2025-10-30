"use client";

import ProtectedShell from "@/components/ProtectedShell";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function BillingSuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        <section className="w-full border-b">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold text-slate-900">Payment successful</h1>
            <p className="text-sm text-slate-600 mt-1">Thank you. Your subscription will be activated shortly.</p>
          </div>
        </section>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-slate-700">We have received your payment. If you just completed checkout, it may take a few seconds for the subscription status to update.</p>
                {sessionId && (
                  <p className="text-xs text-slate-500 mt-2">Checkout session: <span className="font-mono">{sessionId}</span></p>
                )}
                <div className="mt-6 flex items-center gap-3">
                  <Link href="/dashboard" className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Go to dashboard</Link>
                  <Link href="/billing" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900">Back to billing</Link>
                </div>
                <p className="text-xs text-slate-500 mt-3">If your subscription does not show as active, ensure the Stripe webhook is configured for your environment.</p>
              </div>
              <div className="hidden sm:block">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedShell>
  );
}
