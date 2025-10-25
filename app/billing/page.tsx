import ProtectedShell from "@/components/ProtectedShell";

export default function BillingPage() {
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
            <p className="text-sm text-slate-600 mt-1">Subscribe to continue using LASZ HR after your trial.</p>
          </div>
        </section>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Subscribe</h2>
            <p className="text-sm text-slate-600">Click the button below to start a Stripe Checkout session.</p>
            <button onClick={() => startCheckout()} className="mt-4 h-10 px-4 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Subscribe</button>
          </div>
        </main>
      </div>
    </ProtectedShell>
  );
}
