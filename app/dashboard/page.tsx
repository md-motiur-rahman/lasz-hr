import ProtectedShell from "@/components/ProtectedShell";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import DashboardClient, { type DashboardData } from "@/components/DashboardClient";

async function countInRange(
  supabase: ReturnType<typeof createServerComponentClient>,
  table: string,
  companyId: string,
  column: string,
  startISO: string,
  endISO: string
) {
  const { count = 0 } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte(column, startISO)
    .lte(column, endISO);
  return count;
}

export default async function DashboardPage() {
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

  // Fetch company id for the admin
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_user_id", user?.id || "")
    .maybeSingle();

  const companyId = company?.id ?? null;

  // Server-side counts and chart snapshots
  let employeesCount = 0;
  let pendingLeaveCount = 0;
  let shiftsThisWeek = 0;
  let nextPayrollText = "—";
  let headcountMonths: { label: string; value: number }[] = [];
  let leaveWeekly: { label: string; value: number }[] = [];

  if (companyId) {
    // KPIs
    const { count: ecount } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    employeesCount = ecount ?? 0;

    const { count: lcount } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");
    pendingLeaveCount = lcount ?? 0;

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const { count: scount } = await supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("start_time", monday.toISOString())
      .lte("start_time", sunday.toISOString());
    shiftsThisWeek = scount ?? 0;

    const { data: nextRuns } = await supabase
      .from("payroll_runs")
      .select("scheduled_at,status")
      .eq("company_id", companyId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (nextRuns && nextRuns.length > 0) {
      const d = new Date(nextRuns[0].scheduled_at as any);
      nextPayrollText = d.toLocaleDateString();
    }

    // Charts
    // Headcount per month (last 12 months) using employees.created_at as hire date
    const current = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      const count = await countInRange(
        supabase,
        "employees",
        companyId,
        "created_at",
        start.toISOString(),
        end.toISOString()
      );
      headcountMonths.push({
        label: start.toLocaleString("default", { month: "short" }),
        value: Math.max(1, count) * 5, // scale for display
      });
    }

    // Leave trend (last 8 weeks) by leave_requests.created_at
    const weekNow = new Date();
    for (let w = 7; w >= 0; w--) {
      const end = new Date(weekNow);
      end.setDate(weekNow.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const count = await countInRange(
        supabase,
        "leave_requests",
        companyId,
        "created_at",
        start.toISOString(),
        end.toISOString()
      );
      leaveWeekly.push({ label: `W${8 - w}`, value: count });
    }
  }

  const initial: DashboardData = {
    companyId,
    employeesCount,
    pendingLeaveCount,
    shiftsThisWeek,
    nextPayrollText,
    headcountMonths,
    leaveWeekly,
  };

  return (
    <ProtectedShell>
      <DashboardClient initial={initial} />
    </ProtectedShell>
  );
}
