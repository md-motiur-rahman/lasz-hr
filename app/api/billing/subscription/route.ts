import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Returns minimal subscription info (status and current_period_end) for the authenticated admin's company
// GET /api/billing/subscription?subId=stripe_subscription_id
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get("subId");
    if (!subId) {
      return NextResponse.json({ error: "Missing subId" }, { status: 400 });
    }

    // Authenticate user and verify they own a company
    const cookieStore = await cookies();
    const supabase = createServerComponentClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: company } = await supabase
      .from("companies")
      .select("id, owner_user_id, stripe_subscription_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    if (!company.stripe_subscription_id || company.stripe_subscription_id !== subId) {
      return NextResponse.json({ error: "Subscription not found for company" }, { status: 404 });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
    const sub = await stripe.subscriptions.retrieve(subId);

    // current_period_end is a unix timestamp (seconds)
    const nextBillingAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;

    return NextResponse.json({
      status: sub.status,
      nextBillingAt,
      currentPeriodStart,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
