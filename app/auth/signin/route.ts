import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const role = data.user?.user_metadata?.role;
  if (role !== "business_admin") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "This account is not a business admin." }, { status: 403 });
  }

  // Determine next path based on company profile completion
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("address, phone, company_email, paye_ref")
    .eq("owner_user_id", data.user.id)
    .maybeSingle();

  const completed = !companyErr && company && company.address && company.phone && company.company_email && company.paye_ref;
  const next = completed ? "/dashboard" : "/company/profile";

  return NextResponse.json({ next }, { status: 200 });
}
