import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } } as any;

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (!sig || !secret) return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

  const buf = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.company_id;
      if (companyId) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status: "active" }),
        });
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const companyId = (invoice?.subscription_details as any)?.metadata?.company_id || invoice?.metadata?.company_id;
      if (companyId) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status: "past_due" }),
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = sub.metadata?.company_id;
      if (companyId) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status: "canceled" }),
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ received: true, error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
