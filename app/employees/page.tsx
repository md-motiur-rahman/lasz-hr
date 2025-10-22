import ProtectedShell from "@/components/ProtectedShell";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import EmployeesClient from "@/components/EmployeesClient";

export default async function EmployeesPage() {
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

  const { data: company } = await supabase
    .from("companies")
    .select("id, company_name")
    .eq("owner_user_id", user?.id || "")
    .maybeSingle();

  const companyId = company?.id || null;

  return (
    <ProtectedShell>
      <EmployeesClient companyId={companyId} companyName={company?.company_name || null} />
    </ProtectedShell>
  );
}
