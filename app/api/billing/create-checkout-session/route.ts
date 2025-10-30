import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const priceId = body?.priceId || process.env.STRIPE_DEFAULT_PRICE_ID;
    if (!priceId) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerComponentClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve company for owner
    const { data: company } = await supabase
      .from("companies")
      .select("id, company_name, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/cancelled`,
      client_reference_id: company.id,
      metadata: {
        company_id: company.id,
        owner_user_id: user.id,
      },
      subscription_data: {
        metadata: {
          company_id: company.id,
          owner_user_id: user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create checkout session" }, { status: 500 });
  }
}
