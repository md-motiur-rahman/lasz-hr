"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EmployeeYearActivity({ employeeId, companyId }: { employeeId: string; companyId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type LeaveRow = {
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    status: "pending" | "approved" | "declined" | "cancelled";
    decided_at: string | null;
    created_at: string;
  };

  type ShiftRow = {
    id: string;
    start_time: string;
    end_time: string;
    department: string | null;
    role: string | null;
    published: boolean;
  };

  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);

  const startISO = useMemo(() => new Date(year, 0, 1, 0, 0, 0, 0).toISOString(), [year]);
  const endISO = useMemo(() => new Date(year, 11, 31, 23, 59, 59, 999).toISOString(), [year]);
  const startDate = useMemo(() => `${year}-01-01`, [year]);
  const endDate = useMemo(() => `${year}-12-31`, [year]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Leaves whose start_date falls in the selected year
      const { data: leaveData, error: leaveErr } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, duration_days, status, decided_at, created_at")
        .eq("company_id", companyId)
        .eq("employee_id", employeeId)
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .order("start_date", { ascending: true });
      if (leaveErr) throw leaveErr;

      // Shifts that start in the selected year
      const { data: shiftData, error: shiftErr } = await supabase
        .from("shifts")
        .select("id, start_time, end_time, department, role, published")
        .eq("company_id", companyId)
        .eq("employee_id", employeeId)
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .order("start_time", { ascending: true });
      if (shiftErr) throw shiftErr;

      setLeaves((leaveData as any) || []);
      setShifts((shiftData as any) || []);
    } catch (e: any) {
      setError(e.message || "Failed to load employee activity");
      setLeaves([]);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!employeeId || !companyId) return;
    fetchData();
  }, [employeeId, companyId, year]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 6; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  function fmtDate(v: string) {
    try { return new Date(v).toLocaleDateString(); } catch { return v; }
  }
  function fmtTime(v: string) {
    try { return new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return v; }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Leave & rota — {year}</h2>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950">
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {loading ? (
        <div className="mt-3">Loading…</div>
      ) : (
        <div className="mt-5 grid gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Leave ({leaves.length})</h3>
            {leaves.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No leave records for {year}.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-900 font-semibold">
                      <th className="py-2 pr-3">From</th>
                      <th className="py-2 pr-3">To</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Days</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Decided at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="py-2 pr-3 text-slate-950">{fmtDate(l.start_date)}</td>
                        <td className="py-2 pr-3 text-slate-950">{fmtDate(l.end_date)}</td>
                        <td className="py-2 pr-3 text-slate-950 capitalize">{l.leave_type}</td>
                        <td className="py-2 pr-3 text-slate-950">{l.duration_days}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${
                            l.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                            l.status === "declined" ? "bg-red-100 text-red-700" :
                            l.status === "cancelled" ? "bg-slate-100 text-slate-600" :
                            "bg-amber-100 text-amber-800"
                          }`}>{l.status}</span>
                        </td>
                        <td className="py-2 pr-3 text-slate-950">{l.decided_at ? fmtDate(l.decided_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Rota shifts ({shifts.length})</h3>
            {shifts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No shifts for {year}.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-900 font-semibold">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Start</th>
                      <th className="py-2 pr-3">End</th>
                      <th className="py-2 pr-3">Department</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => {
                      const date = new Date(s.start_time);
                      return (
                        <tr key={s.id} className="border-t border-slate-100">
                          <td className="py-2 pr-3 text-slate-950">{date.toLocaleDateString()}</td>
                          <td className="py-2 pr-3 text-slate-950">{fmtTime(s.start_time)}</td>
                          <td className="py-2 pr-3 text-slate-950">{fmtTime(s.end_time)}</td>
                          <td className="py-2 pr-3 text-slate-950">{s.department || "—"}</td>
                          <td className="py-2 pr-3 text-slate-950">{s.role || "—"}</td>
                          <td className="py-2 pr-3 text-slate-950">{s.published ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
