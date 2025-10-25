import ProtectedShell from "@/components/ProtectedShell";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import RotaClient from "@/components/RotaClient";

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
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

  // Resolve profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("user_id", user?.id || "")
    .maybeSingle();

  // Resolve company for admin
  const { data: company } = await supabase
    .from("companies")
    .select("id, company_name")
    .eq("owner_user_id", user?.id || "")
    .maybeSingle();

  const sp = await searchParams;
  const empParam = typeof sp?.employee === "string" ? sp.employee : null;

  return (
    <ProtectedShell>
      <RotaClient
        userId={user?.id || null}
        role={(profile?.role as any) || "business_admin"}
        companyId={company?.id || null}
        companyName={company?.company_name || null}
        userName={profile?.full_name || null}
        filterEmployeeId={empParam}
      />
    </ProtectedShell>
  );
}
