import ProtectedShell from "@/components/ProtectedShell";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import LeaveClient from "@/components/LeaveClient";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
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

  const params = await searchParams;
  const requestedEmployeeId = typeof params?.employee === "string" ? params.employee : undefined;

  let role: string | null = null;
  let companyId: string | null = null;
  let employeeId: string | null = null;

  // Determine role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user?.id || "")
    .maybeSingle();
  role = profile?.role ?? null;

  if (role === "business_admin") {
    // Admin: company is owned by this user
    const { data: company } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("owner_user_id", user?.id || "")
      .maybeSingle();
    companyId = company?.id || null;
  } else {
    // Employee: find employee record linked to this user
    const { data: emp } = await supabase
      .from("employees")
      .select("id, company_id")
      .eq("user_id", user?.id || "")
      .maybeSingle();
    companyId = emp?.company_id || null;
    employeeId = emp?.id || null;
  }

  return (
    <ProtectedShell>
      <LeaveClient
        role={role}
        companyId={companyId}
        employeeId={employeeId}
        initialEmployeeId={role === "business_admin" ? (requestedEmployeeId || null) : employeeId}
      />
    </ProtectedShell>
  );
}
