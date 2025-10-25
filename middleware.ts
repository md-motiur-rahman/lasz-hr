import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const PUBLIC_PATHS = new Set<string>([
  "/", // landing page
  "/sign-in",
  "/sign-up",
  "/auth/callback", // email confirmation callback
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next internals and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth")
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public paths logic
  if (PUBLIC_PATHS.has(pathname)) {
    // If unauthenticated, allow
    if (!session) return res;

    // If authenticated and trying to access sign-in or sign-up, redirect based on company profile completion
    if (pathname === "/sign-in" || pathname === "/sign-up") {
      const profileCompleted = await isCompanyProfileCompleted(supabase, session.user.id);
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = profileCompleted ? "/dashboard" : "/company/profile";
      return NextResponse.redirect(redirectUrl);
    }

    // For other public paths (/, /auth/callback) allow request to proceed while refreshing session
    return res;
  }

  // Protected paths: require session
  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated but company profile is not completed, restrict access to only /company/profile
  const profileCompleted = await isCompanyProfileCompleted(supabase, session.user.id);
  if (!profileCompleted && pathname !== "/company/profile") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/company/profile";
    return NextResponse.redirect(redirectUrl);
  }

  // Gate access if trial expired and subscription not active
  const { gated, redirectTo } = await shouldGateForBilling(supabase, session.user.id, pathname);
  if (gated) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = redirectTo;
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

async function shouldGateForBilling(supabase: ReturnType<typeof createMiddlewareClient>, userId: string, pathname: string) {
  // Allow billing routes
  if (pathname.startsWith("/billing") || pathname.startsWith("/api/billing") || pathname.startsWith("/api/internal/billing") || pathname.startsWith("/api/auth")) {
    return { gated: false, redirectTo: "/billing" } as const;
  }
  // Only gate admins (company owners)
  const { data: company } = await (supabase as any)
    .from("companies")
    .select("subscription_status, trial_end_at, owner_user_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!company) return { gated: false, redirectTo: "/billing" } as const;

  const now = new Date();
  const trialEnd = company.trial_end_at ? new Date(company.trial_end_at) : null;
  const trialExpired = trialEnd ? now > trialEnd : false;
  const active = company.subscription_status === "active";

  if (trialExpired && !active) {
    return { gated: true, redirectTo: "/billing" } as const;
  }
  return { gated: false, redirectTo: "/billing" } as const;
}

async function isCompanyProfileCompleted(supabase: ReturnType<typeof createMiddlewareClient>, userId: string) {
  const { data, error } = await (supabase as any)
    .from("companies")
    .select("address, phone, company_email, paye_ref")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) return false;
  if (!data) return false;
  const { address, phone, company_email, paye_ref } = data as { address?: string; phone?: string; company_email?: string; paye_ref?: string };
  return Boolean(address && phone && company_email && paye_ref);
}

export const config = {
  // Apply to all paths except static assets handled above
  matcher: ["/(.*)"],
};
