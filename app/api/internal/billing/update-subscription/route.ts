import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { companyId, status } = await req.json();
    if (!companyId || !status) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerComponentClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      }
    );

    const { error } = await supabase
      .from("companies")
      .update({ subscription_status: status })
      .eq("id", companyId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
