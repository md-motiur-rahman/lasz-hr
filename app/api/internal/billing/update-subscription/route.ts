import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { companyId, status, stripeCustomerId, stripeSubscriptionId } = await req.json();
    if (!companyId || !status) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const updates: Record<string, any> = { subscription_status: status };
    if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;
    if (status === "canceled") {
      updates.stripe_subscription_id = null;
    } else if (stripeSubscriptionId) {
      updates.stripe_subscription_id = stripeSubscriptionId;
    }

    const { error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", companyId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
