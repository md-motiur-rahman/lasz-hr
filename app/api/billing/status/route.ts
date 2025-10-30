import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient(
      { cookies: () => cookieStore },
      { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: company } = await supabase
      .from("companies")
      .select("id, owner_user_id, subscription_status, stripe_customer_id, stripe_subscription_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });

    let status: "trialing" | "active" | "past_due" | "canceled" | null = null;
    let canceledAt: string | null = null;
    let nextBillingAt: string | null = null;

    let subId: string | null = company.stripe_subscription_id || null;

    async function loadFromSubscription(id: string) {
      const sub = await stripe.subscriptions.retrieve(id);
      if (sub.status === "canceled") {
        status = "canceled";
        canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;
        subId = null;
      } else if (sub.status === "active") {
        status = "active";
      } else if (sub.status === "past_due") {
        status = "past_due";
      } else if (sub.status === "trialing") {
        status = "trialing";
      }
      if (sub.current_period_end) nextBillingAt = new Date(sub.current_period_end * 1000).toISOString();
    }

    if (subId) {
      try {
        await loadFromSubscription(subId);
      } catch (e: any) {
        // If the subscription no longer exists, treat as canceled
        status = "canceled";
        subId = null;
      }
    } else if (company.stripe_customer_id) {
      // No sub id stored — look up latest subscription for the customer
      const list = await stripe.subscriptions.list({ customer: company.stripe_customer_id, status: "all", limit: 1 });
      const sub = list.data[0];
      if (!sub) {
        status = "canceled";
        subId = null;
      } else {
        subId = sub.id;
        await loadFromSubscription(sub.id);
      }
    } else {
      // No Stripe identifiers — fall back to current stored status
      status = (company.subscription_status as any) || null;
    }

    return NextResponse.json({ status, canceledAt, nextBillingAt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
