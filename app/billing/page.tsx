"use client";

import { useEffect, useState } from "react";
import ProtectedShell from "@/components/ProtectedShell";

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"trialing" | "active" | "past_due" | "canceled" | null>(null);
  const [canceledAt, setCanceledAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch("/api/billing/status", { cache: "no-store" });
        const data = await resp.json();
        if (!mounted) return;
        if (resp.ok) {
          setStatus(data.status || null);
          setCanceledAt(data.canceledAt || null);
        }
      } catch {}
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  async function startCheckout(priceId?: string) {
    const resp = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await resp.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert(data?.error || "Failed to start checkout");
    }
  }

  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        <section className="w-full border-b">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
            <p className="text-sm text-slate-600 mt-1">Manage your subscription.</p>
          </div>
        </section>
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Loading…</div>
          ) : (
            <>
              {status === "canceled" && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Subscription canceled</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    You canceled your subscription{canceledAt ? <> on <span className="font-medium">{new Date(canceledAt).toLocaleDateString()}</span></> : null}. To continue using LASZ HR, please resubscribe.
                  </p>
                  <button onClick={() => startCheckout()} className="mt-4 h-10 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Resubscribe</button>
                </div>
              )}

              {status !== "canceled" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Subscribe</h2>
                  <p className="text-sm text-slate-600">Click the button below to start a Stripe Checkout session.</p>
                  <button onClick={() => startCheckout()} className="mt-4 h-10 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Subscribe</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </ProtectedShell>
  );
}
