"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaveType =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "parental"
  | "bereavement"
  | "unpaid"
  | "study"
  | "compassionate"
  | "other";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "maternity", label: "Maternity leave" },
  { value: "paternity", label: "Paternity leave" },
  { value: "parental", label: "Parental leave" },
  { value: "bereavement", label: "Bereavement leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "study", label: "Study leave" },
  { value: "compassionate", label: "Compassionate leave" },
  { value: "other", label: "Other" },
];

type BalanceRow = {
  company_id: string;
  employee_id: string;
  leave_type: LeaveType;
  period_start: string;
  period_end: string;
  total_entitled_days: number;
  taken_days: number;
  balance_days: number;
};

type RequestRow = {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
};

type EmpOption = { id: string; full_name: string; email: string | null };

export default function LeaveClient({ role, companyId, employeeId, initialEmployeeId }: { role: string | null; companyId: string | null; employeeId: string | null; initialEmployeeId?: string | null }) {
  const isAdmin = role === "business_admin";

  // Data
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [empOptions, setEmpOptions] = useState<EmpOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(initialEmployeeId || null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [adminSearch, setAdminSearch] = useState<string>("");

  // Add/Edit modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState<Partial<RequestRow> & { employee_id?: string; leave_type?: LeaveType }>({ leave_type: "annual" });

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<RequestRow> & { id?: string }>({});

  const empNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empOptions) m.set(e.id, e.full_name || e.email || e.id.slice(0, 6));
    return m;
  }, [empOptions]);

  useEffect(() => {
    setFilterEmployeeId(initialEmployeeId || null);
  }, [initialEmployeeId]);

  const monthRange = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const end = new Date(y, m, 0); // last day of month
    const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const endStr = `${y}-${String(m).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return { startStr, endStr };
  }, [selectedMonth]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      if (!companyId) {
        setRequests([]);
        setEmpOptions([]);
        setLoading(false);
        return;
      }

      // Requests: one table with all statuses; RLS will scope for employees
      let rq = supabase
        .from("leave_requests")
        .select("id, company_id, employee_id, leave_type, start_date, end_date, duration_days, reason, status, decided_by_user_id, decided_at, created_at")
        .eq("company_id", companyId)
        // Overlap current month: start_date <= monthEnd AND end_date >= monthStart
        .lte("start_date", monthRange.endStr)
        .gte("end_date", monthRange.startStr)
        .order("start_date", { ascending: true });
      if (isAdmin && filterEmployeeId) {
        rq = rq.eq("employee_id", filterEmployeeId);
      }
      const { data: reqData, error: reqErr } = await rq;
      if (reqErr) throw reqErr;

      // Employees for picker: admin sees all; employee only self
      if (isAdmin) {
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id, full_name, email")
          .eq("company_id", companyId)
          .order("full_name", { ascending: true });
        if (empErr) throw empErr;
        setEmpOptions((empData as any) || []);
      } else if (employeeId) {
        const { data: me, error: meErr } = await supabase
          .from("employees")
          .select("id, full_name, email")
          .eq("id", employeeId)
          .maybeSingle();
        if (meErr) throw meErr;
        setEmpOptions(me ? [me as any] : []);
      } else {
        setEmpOptions([]);
      }

      // Balances for annual leave (for showing remaining balance on table)
      let balQ = supabase
        .from("leave_balances_v")
        .select("company_id, employee_id, leave_type, period_start, period_end, total_entitled_days, taken_days, balance_days")
        .eq("company_id", companyId)
        .eq("leave_type", "annual");
      if (isAdmin && filterEmployeeId) balQ = balQ.eq("employee_id", filterEmployeeId as string);
      else if (!isAdmin && employeeId) balQ = balQ.eq("employee_id", employeeId as string);
      const { data: balData, error: balErr } = await balQ;
      if (balErr) throw balErr;

      setBalances((balData as any) || []);
      setRequests((reqData as any) || []);
    } catch (e: any) {
      setError(e.message || "Failed to load leave data");
      setRequests([]);
      setEmpOptions([]);
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [companyId, employeeId, isAdmin, filterEmployeeId, monthRange.startStr, monthRange.endStr]);

  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel("leave-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_entitlements" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId]);

  function openAdd() {
    setError(null);
    // Employee cannot select another employee; prefill
    if (!isAdmin && employeeId) {
      setAddForm({ employee_id: employeeId, leave_type: "annual" });
    } else {
      setAddForm({ leave_type: "annual", employee_id: (filterEmployeeId || undefined) as any });
    }
    setAddOpen(true);
  }

  async function hasOverlap(empId: string, start: string, end: string, excludeId?: string) {
    // overlap if existing.start <= new.end AND existing.end >= new.start, and status in pending/approved
    let q = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId as string)
      .eq("employee_id", empId)
      .in("status", ["pending", "approved"])
      .lte("start_date", end)
      .gte("end_date", start);
    if (excludeId) q = q.neq("id", excludeId);
    const { count, error } = await q;
    if (error) throw error;
    return (count || 0) > 0;
  }

  async function createLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setAddSaving(true);
    setError(null);
    try {
      const empId = (isAdmin ? addForm.employee_id : employeeId) as string;
      const start = addForm.start_date as string;
      const end = (addForm.end_date || addForm.start_date) as string;

      if (!empId || !start) throw new Error("Missing required fields");

      if (await hasOverlap(empId, start, end)) {
        throw new Error("Leave dates overlap with an existing pending/approved request.");
      }

      const payload: any = {
        company_id: companyId,
        employee_id: empId,
        leave_type: addForm.leave_type,
        start_date: start,
        end_date: end,
        reason: addForm.reason || null,
      };
      const { error } = await supabase.from("leave_requests").insert(payload);
      if (error) throw error;
      setAddOpen(false);
      setAddForm({ leave_type: "annual" });
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to create leave");
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(r: RequestRow) {
    if (!isAdmin) return;
    setError(null);
    setEditForm({ id: r.id, employee_id: r.employee_id, leave_type: r.leave_type, start_date: r.start_date, end_date: r.end_date, reason: r.reason || "" });
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !editForm.id) return;
    setEditSaving(true);
    setError(null);
    try {
      const empId = editForm.employee_id as string;
      const start = editForm.start_date as string;
      const end = (editForm.end_date || editForm.start_date) as string;

      if (await hasOverlap(empId, start, end, editForm.id)) {
        throw new Error("Leave dates overlap with an existing pending/approved request.");
      }

      const payload: any = {
        employee_id: empId,
        leave_type: editForm.leave_type,
        start_date: start,
        end_date: end,
        reason: editForm.reason || null,
      };
      const { error } = await supabase.from("leave_requests").update(payload).eq("id", editForm.id);
      if (error) throw error;
      setEditOpen(false);
      setEditForm({});
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to update leave");
    } finally {
      setEditSaving(false);
    }
  }

  async function approve(id: string) {
    if (!isAdmin) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "approved", decided_at: new Date().toISOString(), decided_by_user_id: user?.id || null })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to approve");
    }
  }

  async function deleteReq(id: string) {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from("leave_requests").delete().eq("id", id);
      if (error) throw error;
      await fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to delete");
    }
  }

  function getAnnualBalance(empId: string, date: string): number | string {
    const row = balances.find(
      (b) => b.employee_id === empId && b.leave_type === "annual" && b.period_start <= date && b.period_end >= date
    );
    return row ? row.balance_days : "—";
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#e0e7ff_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Leave</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">Leave management</h1>
              <p className="mt-2 text-slate-600 text-sm">Create and manage leave requests. New requests are pending by default.</p>
            </div>
            <button onClick={openAdd} className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Add leave</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid gap-6">
        {error && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">All requests</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const [y, m] = selectedMonth.split("-").map(Number);
                  const d = new Date(y, (m - 1) - 1, 1);
                  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs"
                title="Previous month"
              >Prev</button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
              />
              <button
                type="button"
                onClick={() => {
                  const [y, m] = selectedMonth.split("-").map(Number);
                  const d = new Date(y, (m - 1) + 1, 1);
                  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs"
                title="Next month"
              >Next</button>
              {isAdmin && (
                <input
                  placeholder="Search employee"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="h-9 w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950"
                />
              )}
              {isAdmin && filterEmployeeId && (
                <span className="text-xs rounded-full bg-indigo-50 text-indigo-800 px-2 py-1">
                  Filtered to: {empNameById.get(filterEmployeeId) || filterEmployeeId.slice(0,6)}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="mt-3">Loading…</div>
          ) : requests.length === 0 ? (
            <p className="mt-2 text-slate-600 text-sm">No leave requests yet.</p>
          ) : (
            <div className="mt-4 relative overflow-x-auto rounded-md">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-slate-900 font-semibold">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3">From</th>
                    <th className="py-2 pr-3">To</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Days</th>
                    <th className="py-2 pr-3">Annual balance</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    (isAdmin && adminSearch.trim())
                      ? requests.filter((r) => (empNameById.get(r.employee_id) || "").toLowerCase().includes(adminSearch.toLowerCase()))
                      : requests
                  ).map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-950">{empNameById.get(r.employee_id) || r.employee_id.slice(0, 6)}</td>
                      <td className="py-2 pr-3 text-slate-950">{r.start_date}</td>
                      <td className="py-2 pr-3 text-slate-950">{r.end_date}</td>
                      <td className="py-2 pr-3 text-slate-950 capitalize">{r.leave_type}</td>
                      <td className="py-2 pr-3 text-slate-950">{r.duration_days}</td>
                      <td className="py-2 pr-3 text-slate-950">{r.leave_type === "annual" ? getAnnualBalance(r.employee_id, r.start_date) : "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${
                          r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                          r.status === "declined" ? "bg-red-100 text-red-700" :
                          r.status === "cancelled" ? "bg-slate-100 text-slate-600" :
                          "bg-amber-100 text-amber-800"
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          {isAdmin && r.status === "pending" && (
                            <button onClick={() => approve(r.id)} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-xs">Approve</button>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(r)} className="h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-xs">Edit</button>
                              <button onClick={() => deleteReq(r.id)} className="h-8 px-3 rounded-md border border-red-300 bg-white text-red-700 text-xs">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-600">Note: Annual leave consumes the default entitlement of 28 days upon approval (based on the approved request's duration).</p>
        </div>
      </main>

      {/* Add leave modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add leave</h2>
                <p className="text-xs text-slate-700">New requests start in pending state</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-100">✕</button>
            </div>

            <form onSubmit={createLeave} className="p-6 grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Employee</label>
                  <select
                    required
                    value={addForm.employee_id || (!isAdmin ? employeeId || "" : "")}
                    onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                    disabled={!isAdmin}
                  >
                    {!isAdmin && employeeId && (
                      <option value={employeeId}>{empNameById.get(employeeId) || "Me"}</option>
                    )}
                    {isAdmin && <option value="" disabled>Select employee</option>}
                    {isAdmin && empOptions.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}{emp.email ? ` — ${emp.email}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Leave type</label>
                  <select required value={addForm.leave_type as any} onChange={(e) => setAddForm({ ...addForm, leave_type: e.target.value as LeaveType })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950">
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">From</label>
                  <input required type="date" value={addForm.start_date || ""} onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">To</label>
                  <input type="date" value={addForm.end_date || ""} onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900">Note (optional)</label>
                <textarea value={addForm.reason || ""} onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
              </div>
              <div className="mt-2 flex items-center justify-end gap-3">
                <button type="button" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-950" onClick={() => setAddOpen(false)}>Cancel</button>
                <button className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60" disabled={addSaving || (!isAdmin && !employeeId) || (isAdmin && !addForm.employee_id) || !addForm.start_date}>{addSaving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit leave modal (admin only) */}
      {isAdmin && editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit leave</h2>
                <p className="text-xs text-slate-700">Update details</p>
              </div>
              <button onClick={() => setEditOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-100">✕</button>
            </div>

            <form onSubmit={saveEdit} className="p-6 grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Employee</label>
                  <select
                    required
                    value={editForm.employee_id || ""}
                    onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  >
                    {empOptions.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}{emp.email ? ` — ${emp.email}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Leave type</label>
                  <select required value={editForm.leave_type as any} onChange={(e) => setEditForm({ ...editForm, leave_type: e.target.value as any })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950">
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">From</label>
                  <input required type="date" value={editForm.start_date || ""} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">To</label>
                  <input type="date" value={editForm.end_date || ""} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900">Note (optional)</label>
                <textarea value={editForm.reason || ""} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
              </div>
              <div className="mt-2 flex items-center justify-end gap-3">
                <button type="button" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-950" onClick={() => setEditOpen(false)}>Cancel</button>
                <button className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60" disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
