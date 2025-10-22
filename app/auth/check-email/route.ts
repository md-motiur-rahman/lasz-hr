import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ supported: false, exists: false }, { status: 200 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // Use admin API to check user by email
  const { data, error } = await (admin.auth as any).admin.getUserByEmail(email);
  if (error) {
    return NextResponse.json({ supported: true, exists: false, error: error.message }, { status: 200 });
  }
  return NextResponse.json({ supported: true, exists: !!data?.user }, { status: 200 });
}
