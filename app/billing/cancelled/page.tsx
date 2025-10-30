"use client";

import ProtectedShell from "@/components/ProtectedShell";
import Link from "next/link";

export default function BillingCancelledPage() {
  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        <section className="w-full border-b">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold text-slate-900">Checkout cancelled</h1>
            <p className="text-sm text-slate-600 mt-1">Your subscription was not created.</p>
          </div>
        </section>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-700">You cancelled the Stripe Checkout. You can try again any time.</p>
            <div className="mt-6 flex items-center gap-3">
              <Link href="/billing" className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Back to billing</Link>
              <Link href="/dashboard" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-900">Go to dashboard</Link>
            </div>
          </div>
        </main>
      </div>
    </ProtectedShell>
  );
}
