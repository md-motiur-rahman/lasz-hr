"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export type DashboardData = {
  companyId: string | null;
  employeesCount: number;
  pendingLeaveCount: number;
  shiftsThisWeek: number;
  nextPayrollText: string;
  headcountMonths: { label: string; value: number }[];
  leaveWeekly: { label: string; value: number }[];
};

async function refetchCounts(companyId: string | null) {
  if (!companyId) return { employeesCount: 0, pendingLeaveCount: 0, shiftsThisWeek: 0, nextPayrollText: "—" };

  // Employees count
  const { count: employeesCount = 0 } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  // Pending leave count
  const { count: pendingLeaveCount = 0 } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "pending");

  // Shifts this week
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7; // Monday=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const { count: shiftsThisWeek = 0 } = await supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("start_time", monday.toISOString())
    .lte("start_time", sunday.toISOString());

  // Next payroll
  let nextPayrollText = "—";
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

  return { employeesCount: employeesCount ?? 0, pendingLeaveCount: pendingLeaveCount ?? 0, shiftsThisWeek: shiftsThisWeek ?? 0, nextPayrollText };
}

// Build headcount bars using hires per month in the last 12 months
async function refetchHeadcount(companyId: string | null) {
  if (!companyId) return [] as { label: string; value: number }[];

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: hires } = await supabase
    .from("employees")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", start.toISOString())
    .lte("created_at", new Date(end.setHours(23, 59, 59, 999)).toISOString());

  const buckets = new Array(12).fill(0);
  (hires || []).forEach((row: any) => {
    const d = new Date(row.created_at);
    const idx = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
    if (idx >= 0 && idx < 12) buckets[idx] += 1;
  });
  const max = Math.max(1, ...buckets);
  return buckets.map((count, i) => {
    const labelDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return {
      label: labelDate.toLocaleString("default", { month: "short" }),
      value: Math.max(4, Math.round((count / max) * 100)), // scale to ~100px
    };
  });
}

// Build weekly leave trend for the last 8 weeks (based on created_at)
async function refetchLeaveWeekly(companyId: string | null) {
  if (!companyId) return [] as { label: string; value: number }[];

  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7; // Monday=0
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - diffToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - 7 * 7); // 7 weeks before current week start

  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", start.toISOString());

  const buckets = new Array(8).fill(0);
  (leaves || []).forEach((row: any) => {
    const d = new Date(row.created_at);
    const days = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const w = Math.floor(days / 7);
    if (w >= 0 && w < 8) buckets[w] += 1;
  });
  return buckets.map((count, i) => ({ label: `W${i + 1}`, value: count }));
}

export default function DashboardClient({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);

  // On mount or company change, fetch chart datasets from DB
  useEffect(() => {
    (async () => {
      const [hc, lw] = await Promise.all([
        refetchHeadcount(data.companyId),
        refetchLeaveWeekly(data.companyId),
      ]);
      setData((prev) => ({ ...prev, headcountMonths: hc, leaveWeekly: lw }));
    })();
  }, [data.companyId]);

  // Subscribe to realtime changes and refresh counts and charts
  useEffect(() => {
    if (!data.companyId) return;

    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        async (payload) => {
          const companyId = (payload.new as any)?.company_id ?? (payload.old as any)?.company_id;
          if (!companyId || companyId !== data.companyId) return;
          const [counts, hc] = await Promise.all([
            refetchCounts(data.companyId),
            refetchHeadcount(data.companyId),
          ]);
          setData((prev) => ({ ...prev, ...counts, headcountMonths: hc }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        async (payload) => {
          const companyId = (payload.new as any)?.company_id ?? (payload.old as any)?.company_id;
          if (!companyId || companyId !== data.companyId) return;
          const [counts, lw] = await Promise.all([
            refetchCounts(data.companyId),
            refetchLeaveWeekly(data.companyId),
          ]);
          setData((prev) => ({ ...prev, ...counts, leaveWeekly: lw }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        async (payload) => {
          const companyId = (payload.new as any)?.company_id ?? (payload.old as any)?.company_id;
          if (!companyId || companyId !== data.companyId) return;
          const counts = await refetchCounts(data.companyId);
          setData((prev) => ({ ...prev, ...counts }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payroll_runs" },
        async (payload) => {
          const companyId = (payload.new as any)?.company_id ?? (payload.old as any)?.company_id;
          if (!companyId || companyId !== data.companyId) return;
          const counts = await refetchCounts(data.companyId);
          setData((prev) => ({ ...prev, ...counts }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.companyId]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero / heading */}
      <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#ede9fe_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Welcome to LASZ HR</h1>
              <p className="mt-2 text-slate-600 text-sm">Manage your people, scheduling, leave, and payroll from one simple place.</p>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/employees" className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Add employee</Link>
              <Link href="/rota" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium">Create rota</Link>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Employees</span>
                <span className="h-8 w-8 grid place-items-center rounded-md bg-indigo-50 text-indigo-600">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{data.employeesCount}</div>
              <div className="text-xs text-slate-500 mt-1">Total active employees</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Pending leave</span>
                <span className="h-8 w-8 grid place-items-center rounded-md bg-emerald-50 text-emerald-600">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{data.pendingLeaveCount}</div>
              <div className="text-xs text-slate-500 mt-1">Awaiting approval</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Shifts this week</span>
                <span className="h-8 w-8 grid place-items-center rounded-md bg-cyan-50 text-cyan-600">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{data.shiftsThisWeek}</div>
              <div className="text-xs text-slate-500 mt-1">Across all teams</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Payroll status</span>
                <span className="h-8 w-8 grid place-items-center rounded-md bg-amber-50 text-amber-600">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                </span>
              </div>
              <div className="mt-3 text-sm font-medium text-slate-900">{data.nextPayrollText}</div>
              <div className="text-xs text-slate-500 mt-1">Next run</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-3">
        {/* Charts / summaries */}
        <section className="lg:col-span-2 grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Headcount</h2>
              <span className="text-xs text-slate-500">Last 12 months</span>
            </div>
            <div className="mt-6 grid grid-cols-12 gap-2 items-end h-36">
              {data.headcountMonths.map((m) => (
                <div key={m.label} className="rounded-md bg-indigo-200 relative group" style={{ height: `${m.value}px` }}>
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Leave trend</h2>
              <span className="text-xs text-slate-500">Last 8 weeks</span>
            </div>
            <div className="mt-6 h-36">
              <div className="relative h-full">
                <div className="absolute inset-0 grid grid-cols-8">
                  {data.leaveWeekly.map((_, i) => (
                    <div key={i} className="border-r border-slate-100" />
                  ))}
                </div>
                <svg viewBox="0 0 320 120" className="relative z-10 h-full w-full">
                  <polyline
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                    points={data.leaveWeekly
                      .map((p, i) => {
                        const x = (320 / (data.leaveWeekly.length - 1)) * i;
                        // Scale y: max value to 100px
                        const max = Math.max(1, ...data.leaveWeekly.map((v) => v.value));
                        const y = 120 - (p.value / max) * 100 - 10;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-8 text-[10px] text-slate-500">
                {data.leaveWeekly.map((p) => (
                  <div key={p.label} className="text-center">{p.label}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Side column */}
        <aside className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
            <div className="mt-4 grid gap-2 text-sm">
              <Link href="/employees" className="inline-flex items-center h-10 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Invite employee</Link>
              <Link href="/leave" className="inline-flex items-center h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-800">Approve leave</Link>
              <Link href="/rota" className="inline-flex items-center h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-800">Publish rota</Link>
              <Link href="/payroll" className="inline-flex items-center h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-800">Run payroll</Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            <ul className="mt-4 grid gap-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500" />
                New employee added — updates in realtime
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                Leave approvals reflected as they happen
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
                Rota changes update your counts
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
