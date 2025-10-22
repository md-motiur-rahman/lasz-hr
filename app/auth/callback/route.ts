import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  // Use Next.js cookies helper so auth-helpers can attach cookies to the response
  const res = new NextResponse(null, { status: 302 });

  try {
    const supabase = createRouteHandlerClient(
      { cookies },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      }
    );

  if (!code) {
      const redirectUrl = new URL("/sign-in?error=missing_code", requestUrl.origin);
      res.headers.set("Location", redirectUrl.toString());
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Establish a session using the confirmation code
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const redirectUrl = new URL("/sign-in?error=invalid_code", requestUrl.origin);
      res.headers.set("Location", redirectUrl.toString());
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Retrieve the authenticated user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (!user || userErr) {
      const redirectUrl = new URL("/sign-in?error=no_user", requestUrl.origin);
      res.headers.set("Location", redirectUrl.toString());
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Upsert the user profile. Try authed client first (RLS), then fall back to service role.
    try {
      const meta = (user.user_metadata as any) || {};
      const full_name = meta.full_name ?? null;
      const company_name = meta.company_name ?? null;
      const role = meta.role ?? "business_admin";

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            email: user.email ?? "",
            full_name,
            company_name,
            role,
          },
          { onConflict: "user_id" }
        );

      if (profileErr) {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
          const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
          );
          await admin.from("profiles").upsert(
            {
              user_id: user.id,
              email: user.email ?? "",
              full_name,
              company_name,
              role,
            },
            { onConflict: "user_id" }
          );
        } else {
          console.warn("profiles upsert failed (no service key available):", profileErr.message);
        }
      }
    } catch (profileErr) {
      console.warn("profiles upsert exception:", profileErr);
    }

    // Determine redirect based on company profile completion
    let redirectPath = "/";
    if ((user.user_metadata as any)?.role === "business_admin") {
      const { data, error } = await supabase
        .from("companies")
        .select("address, phone, company_email, paye_ref")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      const isCompleted = !error && data && data.address && data.phone && data.company_email && data.paye_ref;
      redirectPath = isCompleted ? "/dashboard" : "/company/profile";
    }

    const redirectUrl = new URL(redirectPath, requestUrl.origin);
    res.headers.set("Location", redirectUrl.toString());
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    console.error("/auth/callback error:", e);
    return NextResponse.redirect(new URL("/sign-in?error=callback", requestUrl.origin));
  }
}
