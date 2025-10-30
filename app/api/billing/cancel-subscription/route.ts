import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { atPeriodEnd = true } = await req.json().catch(() => ({ atPeriodEnd: true }));

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient(
      { cookies: () => cookieStore },
      { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: company } = await supabase
      .from("companies")
      .select("id, stripe_subscription_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!company || !company.stripe_subscription_id) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });

    // Retrieve first to handle already cancelled/scheduled scenarios gracefully
    let existing = await stripe.subscriptions.retrieve(company.stripe_subscription_id);
    if (existing.status === "canceled") {
      return NextResponse.json({ ok: true, message: "Subscription already canceled.", nextBillingAt: null, cancelAtPeriodEnd: false, cancelAt: existing.canceled_at ? new Date(existing.canceled_at * 1000).toISOString() : null });
    }
    if (existing.cancel_at_period_end) {
      return NextResponse.json({ ok: true, message: "Cancellation already scheduled at period end.", nextBillingAt: existing.current_period_end ? new Date(existing.current_period_end * 1000).toISOString() : null, cancelAtPeriodEnd: true, cancelAt: existing.cancel_at ? new Date(existing.cancel_at * 1000).toISOString() : null });
    }

    // Cancel at period end (recommended) or immediately
    const sub = await stripe.subscriptions.update(company.stripe_subscription_id, { cancel_at_period_end: Boolean(atPeriodEnd) });

    const nextBillingAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

    // If cancelled immediately, optionally reflect in DB (owner has RLS update permission)
    if (!atPeriodEnd) {
      try {
        await supabase.from("companies").update({ subscription_status: "canceled" }).eq("owner_user_id", user.id);
      } catch {}
    }

    return NextResponse.json({ ok: true, message: atPeriodEnd ? "Subscription will end at period end." : "Subscription cancelled.", nextBillingAt, cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to cancel" }, { status: 500 });
  }
}
