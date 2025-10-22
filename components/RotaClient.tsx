"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Shift = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  role: string | null;
  published: boolean;
  notes: string | null;
};

type Employee = { id: string; full_name: string; department: string | null };

export default function RotaClient({
  userId,
  role,
  companyId,
  companyName,
  userName,
}: {
  userId: string | null;
  role: "business_admin" | "employee" | string;
  companyId: string | null;
  companyName: string | null;
  userName: string | null;
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7; // Monday=0
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>("");

  const weekRange = useMemo(() => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [weekStart]);

  const visibleEmployees = useMemo(() => {
    if (!deptFilter) return employees;
    return employees.filter((e) => (e.department || "") === deptFilter);
  }, [employees, deptFilter]);

  async function loadEmployees() {
    if (!companyId) return;
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, department")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true });
    setEmployees((data as any) || []);
  }

  async function loadShifts() {
    if (!companyId) return;
    const { start, end } = weekRange;
    let query = supabase
      .from("shifts")
      .select("id, employee_id, department, start_time, end_time, location, role, published, notes, employees:employees!shifts_employee_id_fkey(full_name)")
      .eq("company_id", companyId)
      .gte("start_time", start.toISOString())
      .lte("end_time", end.toISOString());

    if (role !== "business_admin" && userId) {
      query = query.eq("assigned_user_id", userId).eq("published", true);
    }

    const { data, error } = await query.order("start_time", { ascending: true });
    if (error) {
      console.error("loadShifts error:", error.message);
    }
    setShifts(
      (data as any)?.map((s: any) => ({
        id: s.id,
        employee_id: s.employee_id,
        employee_name: s.employees?.full_name || "",
        department: s.department,
        start_time: s.start_time,
        end_time: s.end_time,
        location: s.location,
        role: s.role,
        published: s.published,
        notes: s.notes,
      })) || []
    );
  }

  useEffect(() => {
    loadEmployees();
  }, [companyId]);

  useEffect(() => {
    loadShifts();
  }, [companyId, weekRange.start.toISOString(), weekRange.end.toISOString(), role, userId]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("rota-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => loadShifts())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, weekRange.start.toISOString(), weekRange.end.toISOString()]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department && set.add(e.department));
    return Array.from(set);
  }, [employees]);

  return (
    <div className="min-h-screen bg-white">
      <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#ede9fe_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rota</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{companyName ? `${companyName} — Rota` : "Rota"}</h1>
              <p className="mt-2 text-slate-600 text-sm">Department-wise weekly shifts. Employees see their own published rota.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() - 7);
                  return d.toISOString();
                })}
                className="inline-flex items-center h-10 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
              >
                Prev week
              </button>
              <button
                onClick={() => setWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() + 7);
                  return d.toISOString();
                })}
                className="inline-flex items-center h-10 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
              >
                Next week
              </button>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-900 font-semibold">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Start</th>
                  <th className="py-2 pr-3">End</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts
                  .filter((s) => !deptFilter || (s.department || "") === deptFilter)
                  .map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-950">{s.employee_name}</td>
                    <td className="py-2 pr-3 text-slate-900">{s.department || "—"}</td>
                    <td className="py-2 pr-3 text-slate-900">{new Date(s.start_time).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-900">{new Date(s.end_time).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-900">{s.location || "—"}</td>
                    <td className="py-2 pr-3 text-slate-900">{s.role || "—"}</td>
                    <td className="py-2 pr-3">{s.published ? <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">Published</span> : <span className="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs">Draft</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
