import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    // Determine latest subscription status from Stripe
    let subId: string | null = company.stripe_subscription_id || null;
    let status: "trialing" | "active" | "past_due" | "canceled" | null = null;

    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.status === "canceled") {
          status = "canceled";
          subId = null; // clear local id if canceled
        } else if (sub.status === "active") status = "active";
        else if (sub.status === "past_due") status = "past_due";
        else if (sub.status === "trialing") status = "trialing";
      } catch (e: any) {
        // If subscription no longer exists on Stripe, treat as canceled
        status = "canceled";
        subId = null;
      }
    } else if (company.stripe_customer_id) {
      // No sub id; list subscriptions for the customer
      const list = await stripe.subscriptions.list({ customer: company.stripe_customer_id, status: "all", limit: 1 });
      const sub = list.data[0];
      if (!sub) {
        status = "canceled";
        subId = null;
      } else {
        if (sub.status === "canceled") {
          status = "canceled";
          subId = null;
        } else if (sub.status === "active") {
          status = "active";
          subId = sub.id;
        } else if (sub.status === "past_due") {
          status = "past_due";
          subId = sub.id;
        } else if (sub.status === "trialing") {
          status = "trialing";
          subId = sub.id;
        }
      }
    } else {
      // No identifiers -> cannot reconcile against Stripe; keep current
      return NextResponse.json({ error: "Missing Stripe identifiers on company" }, { status: 400 });
    }

    if (!status) {
      // Default fallback; if Stripe returned an unexpected state
      status = "canceled";
      subId = null;
    }

    // Update company row if different
    const updates: any = {};
    if (company.subscription_status !== status) updates.subscription_status = status;
    if ((status === "canceled" && company.stripe_subscription_id !== null) || (status !== "canceled" && company.stripe_subscription_id !== subId)) {
      updates.stripe_subscription_id = subId;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("companies")
        .update(updates)
        .eq("id", company.id);
    }

    return NextResponse.json({ ok: true, status, stripeSubscriptionId: subId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reconcile" }, { status: 500 });
  }
}
