"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Shift = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string | null;
  start_time: string; // ISO
  end_time: string;   // ISO
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
  filterEmployeeId,
}: {
  userId: string | null;
  role: "business_admin" | "employee" | string;
  companyId: string | null;
  companyName: string | null;
  userName: string | null;
  filterEmployeeId?: string | null;
}) {
  // Month reference (first day of the displayed month)
  const [refMonthISO, setRefMonthISO] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    first.setHours(0, 0, 0, 0);
    return first.toISOString();
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [dragLabel, setDragLabel] = useState<string | null>(null);

  // Inline shift time editor
  const [editOpen, setEditOpen] = useState(false);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editDayISO, setEditDayISO] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("09:00");
  const [editEnd, setEditEnd] = useState("17:00");
  const [editBreakMins, setEditBreakMins] = useState<string>("0");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [createEmpId, setCreateEmpId] = useState<string | null>(null);
  const [createEmpName, setCreateEmpName] = useState<string | null>(null);
  const [createEmpDept, setCreateEmpDept] = useState<string | null>(null);
  // Export controls (only visible in individual employee view)
  const [exportDate, setExportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [exportRange, setExportRange] = useState<"day" | "week">("week");
  const [downloading, setDownloading] = useState(false);

  const refMonthDate = useMemo(() => new Date(refMonthISO), [refMonthISO]);
  const monthStart = useMemo(() => new Date(refMonthDate.getFullYear(), refMonthDate.getMonth(), 1, 0, 0, 0, 0), [refMonthDate]);
  const monthEnd = useMemo(() => new Date(refMonthDate.getFullYear(), refMonthDate.getMonth() + 1, 0, 23, 59, 59, 999), [refMonthDate]);

  // Calendar grid range (6 weeks, starting Monday)
  const gridDays = useMemo(() => {
    const firstDay = new Date(monthStart);
    // Move back to Monday (0=Sun, 1=Mon...)
    const day = firstDay.getDay();
    const diffToMonday = (day + 6) % 7; // Monday index
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - diffToMonday);
    gridStart.setHours(0, 0, 0, 0);

    return Array.from({ length: 42 }).map((_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [monthStart]);

  const visibleEmployees = useMemo(() => {
    let arr = employees;
    if (filterEmployeeId) arr = arr.filter((e) => e.id === filterEmployeeId);
    if (!deptFilter) return arr;
    return arr.filter((e) => (e.department || "") === deptFilter);
  }, [employees, deptFilter, filterEmployeeId]);

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
    let query = supabase
      .from("shifts")
      .select("id, employee_id, department, start_time, end_time, break_minutes, location, role, published, notes, employees:employees!shifts_employee_id_fkey(full_name)")
      .eq("company_id", companyId)
      .gte("start_time", monthStart.toISOString())
      .lt("start_time", new Date(refMonthDate.getFullYear(), refMonthDate.getMonth() + 1, 1, 0, 0, 0, 0).toISOString())
      .order("start_time", { ascending: true });

    if (role !== "business_admin" && userId) {
      query = query.eq("assigned_user_id", userId);
    }
    if (filterEmployeeId) {
      query = query.eq("employee_id", filterEmployeeId);
    }

    const { data, error } = await query;
    if (error) console.error("loadShifts error:", error.message);
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
        break_minutes: (s as any).break_minutes ?? 0,
      })) || []
    );
  }

  useEffect(() => {
    loadEmployees();
  }, [companyId]);

  useEffect(() => {
    loadShifts();
  }, [companyId, monthStart.toISOString(), monthEnd.toISOString(), role, userId]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("rota-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => loadShifts())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, monthStart.toISOString(), monthEnd.toISOString()]);

  function createDragImage(text: string) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.position = "fixed";
    el.style.top = "-1000px";
    el.style.left = "-1000px";
    el.style.padding = "4px 8px";
    el.style.background = "#111827"; // slate-900
    el.style.color = "white";
    el.style.fontSize = "12px";
    el.style.borderRadius = "6px";
    el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    document.body.appendChild(el);
    return el;
  }

  function onDragStartEmployee(emp: Employee, ev: React.DragEvent) {
    ev.dataTransfer?.setData("text/employee_id", emp.id);
    const img = createDragImage(emp.full_name);
    ev.dataTransfer.setDragImage(img, 0, 0);
    setTimeout(() => document.body.removeChild(img), 0);
    setDragLabel(emp.full_name);
  }
  function onDragEnd() {
    setDragLabel(null);
  }
  function onDragStartShift(shift: Shift, ev: React.DragEvent) {
    ev.dataTransfer?.setData("text/shift_id", shift.id);
    const img = createDragImage(shift.employee_name);
    ev.dataTransfer.setDragImage(img, 0, 0);
    setTimeout(() => document.body.removeChild(img), 0);
    setDragLabel(shift.employee_name);
  }

  function dayKey(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString();
  }

  function formatYMD(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function endOfWeek(date: Date) {
    const s = startOfWeek(date);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  }

  async function isOnLeaveOnDate(empId: string, date: Date) {
    if (!companyId) return false;
    const dateStr = formatYMD(date);
    const { count, error } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("employee_id", empId)
      .in("status", ["pending", "approved"])    
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);
    if (error) return false;
    return (count || 0) > 0;
  }

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    gridDays.forEach((d) => map.set(dayKey(d), []));
    shifts.forEach((s) => {
      const d = new Date(s.start_time);
      const key = dayKey(d);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return map;
  }, [gridDays, shifts]);

  async function handleDropOnDay(ev: React.DragEvent, day: Date) {
    ev.preventDefault?.();
    if (!companyId) return;

    const shiftId = ev.dataTransfer?.getData("text/shift_id");
    if (shiftId) {
      const s = shifts.find((x) => x.id === shiftId);
      if (s) {
        // Prevent assigning a shift when employee is on leave this day
        if (await isOnLeaveOnDate(s.employee_id, day)) {
          window.alert("Cannot assign shift: employee is on leave on this day.");
          setDragLabel(null);
          return;
        }
        // Prevent duplicate assignment for same employee on the same day
        const key = dayKey(day);
        const dayShifts = shiftsByDay.get(key) || [];
        const duplicate = dayShifts.some((x) => x.employee_id === s.employee_id && x.id !== s.id);
        if (duplicate) {
          window.alert("This employee already has a shift on this day.");
          setDragLabel(null);
          return;
        }

        const startOld = new Date(s.start_time);
        const endOld = new Date(s.end_time);
        const newStart = new Date(day);
        newStart.setHours(startOld.getHours(), startOld.getMinutes(), 0, 0);
        // Preserve original duration, support overnight if needed
        let duration = endOld.getTime() - startOld.getTime();
        if (duration <= 0) duration += 24 * 60 * 60 * 1000;
        const newEnd = new Date(newStart.getTime() + duration);
        await supabase
          .from("shifts")
          .update({ start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
          .eq("id", shiftId);
        await loadShifts();
        setDragLabel(null);
        setDragOverKey(null);
        return;
      }
    }

    const empId = ev.dataTransfer?.getData("text/employee_id");
    if (!empId) return;

    // Prevent duplicate for same employee on this day
    const key = dayKey(day);
    const dayShifts = shiftsByDay.get(key) || [];
    const exists = dayShifts.some((x) => x.employee_id === empId);
    if (exists) {
      window.alert("This employee already has a shift on this day.");
      setDragLabel(null);
      setDragOverKey(null);
      return;
    }

    // Prevent assignment if employee is on leave on this day
    if (await isOnLeaveOnDate(empId, day)) {
      window.alert("Cannot assign shift: employee is on leave on this day.");
      setDragLabel(null);
      setDragOverKey(null);
      return;
    }

    const emp = employees.find((e) => e.id === empId);
    // Open create modal to set time instead of defaulting
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    setEditDayISO(d.toISOString());
    setEditStart("");
    setEditEnd("");
    setEditBreakMins("0");
    setCreateEmpId(empId);
    setCreateEmpName(emp?.full_name || "");
    setCreateEmpDept(emp?.department || null);
    setEditShiftId(null);
    setEditOpen(true);
    setDragLabel(null);
    setDragOverKey(null);
  }

  function openEditor(shift: Shift) {
    setEditShiftId(shift.id);
    const d = new Date(shift.start_time);
    d.setHours(0, 0, 0, 0);
    setEditDayISO(d.toISOString());
    const s = new Date(shift.start_time);
    const e = new Date(shift.end_time);
    const hhmm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
    setEditStart(hhmm(s));
    setEditEnd(hhmm(e));
    setEditBreakMins(String((shift as any).break_minutes ?? 0));
    setEditOpen(true);
  }

  async function openCreateForDay(day: Date) {
    if (!filterEmployeeId) return;

    // Prevent duplicate for this employee on this day
    const key = dayKey(day);
    const dayShifts = shiftsByDay.get(key) || [];
    const exists = dayShifts.some((s) => s.employee_id === filterEmployeeId);
    if (exists) {
      window.alert("This employee already has a shift on this day.");
      return;
    }

    // Prevent assignment if employee is on leave on this day
    if (await isOnLeaveOnDate((filterEmployeeId as string), day)) {
      window.alert("Cannot create shift: employee is on leave on this day.");
      return;
    }

    const emp = employees.find((e) => e.id === filterEmployeeId) || visibleEmployees[0];
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    setEditDayISO(d.toISOString());
    setEditStart("");
    setEditEnd("");
    setEditBreakMins("0");
    setCreateEmpId(filterEmployeeId);
    setCreateEmpName(emp?.full_name || "");
    setCreateEmpDept(emp?.department || null);
    setEditShiftId(null);
    setEditOpen(true);
  }

  async function saveEditor() {
    if (!editDayISO) return;
    // Basic validation
    if (!editStart || !editEnd) {
      window.alert("Please select start and end times.");
      return;
    }
    const base = new Date(editDayISO);
    const [sh, sm] = editStart.split(":").map(Number);
    const [eh, em] = editEnd.split(":").map(Number);
    const start = new Date(base);
    start.setHours(sh || 0, sm || 0, 0, 0);
    const end = new Date(base);
    end.setHours(eh || 0, em || 0, 0, 0);

    // Allow overnight: if end is not after start, roll to next day
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    if (editShiftId) {
      // Update existing shift
      await supabase.from("shifts").update({ start_time: start.toISOString(), end_time: end.toISOString(), break_minutes: Number(editBreakMins) || 0 }).eq("id", editShiftId);
    } else if (createEmpId && companyId) {
      // Prevent duplicate for this employee on this day
      const sameDayExists = shifts.some(
        (s) => s.employee_id === createEmpId && dayKey(new Date(s.start_time)) === dayKey(start)
      );
      if (sameDayExists) {
        window.alert("This employee already has a shift on this day.");
        return;
      }
      // Prevent creating shift if employee is on leave on this day
      if (await isOnLeaveOnDate(createEmpId, start)) {
        window.alert("Cannot create shift: employee is on leave on this day.");
        return;
      }
      // Create new shift for selected employee
      const { error } = await supabase.from("shifts").insert({
        company_id: companyId,
        employee_id: createEmpId,
        department: createEmpDept || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        break_minutes: Number(editBreakMins) || 0,
        location: null,
        role: null,
        notes: null,
        published: true,
      });
      if (error) {
        window.alert(error.message);
      }
      setCreateEmpId(null);
      setCreateEmpName(null);
      setCreateEmpDept(null);
    }

    setEditOpen(false);
    setEditShiftId(null);
    await loadShifts();
  }

  async function fetchShiftsForExport(empId: string, start: Date, end: Date) {
    if (!companyId) return [] as { start_time: string; end_time: string; department: string | null; role: string | null }[];
    const { data } = await supabase
      .from("shifts")
      .select("start_time, end_time, department, role, break_minutes")
      .eq("company_id", companyId)
      .eq("employee_id", empId)
      .gte("start_time", start.toISOString())
      .lte("start_time", end.toISOString())
      .order("start_time", { ascending: true });
    return (data as any) || [];
  }

  async function emailRota() {
    if (!filterEmployeeId) return;
    const base = new Date(exportDate + "T00:00:00");
    const rangeStart = exportRange === "day" ? new Date(base) : startOfWeek(base);
    const rangeEnd = exportRange === "day" ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999) : endOfWeek(base);
    const resp = await fetch("/api/rota/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: filterEmployeeId, rangeStart: rangeStart.toISOString(), rangeEnd: rangeEnd.toISOString() }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      alert(data?.error || "Failed to send email");
      return;
    }
    alert("Rota emailed to employee");
  }

  async function downloadPdf() {
    if (!filterEmployeeId) return;
    setDownloading(true);
    try {
      const base = new Date(exportDate + "T00:00:00");
      const rangeStart = exportRange === "day" ? new Date(base) : startOfWeek(base);
      const rangeEnd = exportRange === "day" ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999) : endOfWeek(base);
      const rows = await fetchShiftsForExport(filterEmployeeId, rangeStart, rangeEnd);
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // Header
      const company = companyName || "Company";
      const empName = visibleEmployees[0]?.full_name || "Employee";
      const dept = visibleEmployees[0]?.department || "—";
      const rangeText = `${rangeStart.toLocaleDateString()} — ${rangeEnd.toLocaleDateString()}`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(company, 14, 16);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Employee: ${empName}`, 14, 24);
      doc.text(`Department: ${dept}`, 14, 30);
      doc.text(`Range: ${rangeText}`, 14, 36);

      doc.setDrawColor(60);
      doc.line(14, 40, 196, 40);

      const body = rows.map((r) => {
        const d = new Date(r.start_time);
        const s = new Date(r.start_time);
        const e = new Date(r.end_time);
        let mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
        const b = (r as any).break_minutes ?? 0;
        mins = Math.max(0, mins - (typeof b === "number" ? b : Number(b) || 0));
        const hh = String(Math.floor(mins / 60)).padStart(2, "0");
        const mm = String(mins % 60).padStart(2, "0");
        const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
        return [
          d.toLocaleDateString(),
          dayName,
          s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          `${hh}:${mm}`,
          (r.department || ""),
          (r.role || ""),
        ];
      });

      if (body.length === 0) {
        doc.setFontSize(11);
        doc.text("No shifts in selected range.", 14, 48);
      } else {
        (doc as any).autoTable({
          startY: 46,
          head: [["Date", "Day", "Start", "End", "Duration", "Department", "Role"]],
          body,
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 2 },
          headStyles: { fillColor: [79, 70, 229], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 255] },
          margin: { left: 14, right: 14 },
        });
      }

      const filename = `rota_${(visibleEmployees[0]?.full_name || filterEmployeeId).replace(/\s+/g, "_")}_${exportRange}_${formatYMD(rangeStart)}.pdf`;
      doc.save(filename);
    } catch (e: any) {
      alert(e?.message || "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmShiftId, setConfirmShiftId] = useState<string | null>(null);

  const confirmShift = useMemo(() => shifts.find((s) => s.id === confirmShiftId) || null, [shifts, confirmShiftId]);

  function openDeleteConfirm(id: string) {
    setConfirmShiftId(id);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!confirmShiftId) return;
    await supabase.from("shifts").delete().eq("id", confirmShiftId);
    setConfirmOpen(false);
    setConfirmShiftId(null);
    setEditOpen(false);
    setEditShiftId(null);
    await loadShifts();
  }

  function fmtCellDate(d: Date) {
    return d.toLocaleDateString(undefined, { day: "numeric" });
  }
  function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }
  function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }
  function hashToHue(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i), h |= 0;
  return Math.abs(h) % 360;
  }
  function colorFor(key: string, alpha = 0.18) {
  const hue = hashToHue(key || "");
  return `hsla(${hue}, 85%, 60%, ${alpha})`;
  }
  
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department && set.add(e.department));
    return Array.from(set);
  }, [employees]);

  return (
    <div className="min-h-screen bg-white">
      {/* Drag label helper */}
      {dragLabel && (
        <div className="fixed top-2 right-2 z-50 rounded-md bg-slate-900 text-white text-xs px-3 py-1 shadow">
          {dragLabel}
        </div>
      )}

      <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#ede9fe_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rota</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{companyName ? `${companyName} — Rota` : "Rota"}</h1>
              <p className="mt-2 text-slate-600 text-sm">Monthly calendar. Drag employees to days to create shifts. Click a shift to edit time.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRefMonthISO(new Date(refMonthDate.getFullYear(), refMonthDate.getMonth() - 1, 1).toISOString())}
                className="inline-flex items-center h-10 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
              >Prev</button>
              <div className="px-2 text-sm font-medium text-slate-900 min-w-[8rem] text-center">
                {refMonthDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </div>
              <button
                onClick={() => setRefMonthISO(new Date(refMonthDate.getFullYear(), refMonthDate.getMonth() + 1, 1).toISOString())}
                className="inline-flex items-center h-10 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
              >Next</button>
              {!filterEmployeeId && (
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
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left employees list (admin only) */}
          {role === "business_admin" && !filterEmployeeId && (
            <aside className="lg:col-span-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Employees</h3>
                <div className="rounded-md border border-slate-200 bg-white max-h-[60vh] overflow-y-auto">
                  {visibleEmployees.length === 0 ? (
                    <div className="p-3 text-sm text-slate-600">No employees{deptFilter ? ` in ${deptFilter}` : ""}.</div>
                  ) : (
                    visibleEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        draggable
                        onDragStart={(ev) => onDragStartEmployee(emp, ev)}
                        onDragEnd={onDragEnd}
                        className="px-3 py-2 border-b border-slate-100 cursor-grab active:cursor-grabbing hover:bg-slate-50 text-sm text-slate-900"
                        title="Drag to a day to create a shift"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(emp.id, 0.45) }} />
                          <span className="font-medium truncate">{emp.full_name}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{emp.department || "No department"}</div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2">Drag an employee to a day to create a shift, then set the time in the modal. Drag a shift between days to move it.</p>
              </div>
            </aside>
          )}

          {/* Calendar grid */}
          <section className={role === "business_admin" && !filterEmployeeId ? "lg:col-span-4" : "lg:col-span-5"}>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {filterEmployeeId && visibleEmployees[0] && (
                <>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 px-3 py-1 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(visibleEmployees[0].id, 0.45) }} />
                    Viewing rota for {visibleEmployees[0].full_name}
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <label className="text-slate-600">Export from</label>
                    <input
                      type="date"
                      value={exportDate}
                      onChange={(e) => setExportDate(e.target.value)}
                      className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-950"
                    />
                    <select
                      value={exportRange}
                      onChange={(e) => setExportRange(e.target.value as any)}
                      className="h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-950"
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                    </select>
                    <button
                      onClick={downloadPdf}
                      disabled={downloading}
                      className="h-7 px-3 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {downloading ? "Generating…" : "Download PDF"}
                    </button>
                    <button
                      onClick={emailRota}
                      className="h-7 px-3 rounded-md border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                      Email rota (ICS)
                    </button>
                  </div>
                </>
              )}
              <div className="grid grid-cols-7 gap-2 mb-2 text-[11px] text-slate-600">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {gridDays.map((d) => {
                  const key = dayKey(d);
                  const inMonth = sameMonth(d, refMonthDate);
                  const baseShifts = (shiftsByDay.get(key) || []);
                  const dayShifts = filterEmployeeId ? baseShifts : baseShifts.filter((s) => !deptFilter || (s.department || "") === deptFilter);
                  return (
                    <div
                      key={d.toISOString()}
                      className={`min-h-[140px] rounded-lg border p-2 transition-colors ${inMonth ? ((d.getDay()===0 || d.getDay()===6) ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-gradient-to-b from-white to-slate-50") : "border-slate-100 bg-slate-50"} ${dragOverKey===key ? "ring-2 ring-indigo-300 bg-indigo-50" : ""}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setDragOverKey(key)}
                      onDragLeave={() => setDragOverKey(null)}
                      onDrop={(ev) => handleDropOnDay(ev, d)}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`${isToday(d) ? "bg-indigo-600 text-white" : (inMonth ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-500")} inline-flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full text-xs font-semibold`}>{fmtCellDate(d)}</div>
                        {filterEmployeeId && role === "business_admin" && (
                          <button
                            onClick={() => openCreateForDay(d)}
                            className="inline-flex items-center h-6 px-2 rounded bg-indigo-600 text-white text-[10px] hover:bg-indigo-700"
                            title="Add shift"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayShifts.map((s) => (
                          <div
                            key={s.id}
                            draggable={role === "business_admin"}
                            onDragStart={(ev) => onDragStartShift(s, ev)}
                            onDragEnd={onDragEnd}
                            onClick={() => openEditor(s)}
                            className="relative rounded border text-slate-800 px-2 pr-6 py-1 text-[11px] hover:brightness-105 cursor-pointer"
                            style={{ backgroundColor: colorFor(s.employee_id, 0.18), borderColor: colorFor(s.employee_id, 0.35) }}
                            title={`${s.employee_name} — ${new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          >
                            <div className="font-medium text-indigo-900 break-words">{s.employee_name}</div>
                            <div className="mt-0.5 text-[10px] text-indigo-700">
                              {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              –
                              {new Date(s.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {role === "business_admin" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openDeleteConfirm(s.id); }}
                                className="absolute top-0.5 right-0.5 h-5 w-5 grid place-items-center rounded hover:bg-indigo-200"
                                aria-label="Delete shift"
                                title="Delete shift"
                              >
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                        {dayShifts.length === 0 && (
                          <div className="text-[10px] text-slate-400">{inMonth ? "Drop here" : ""}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Time editor modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
            <h3 className="text-sm font-semibold text-slate-900">{editShiftId ? "Edit shift time" : "Create shift"}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Start</label>
                <input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">End</label>
                <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Break (minutes)</label>
                <input type="number" min={0} step={5} value={editBreakMins} onChange={(e) => setEditBreakMins(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950" />
                <p className="text-[10px] text-slate-500 mt-1">Unpaid break time deducted from total duration.</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              {role === "business_admin" ? (
                editShiftId ? (
                  <button onClick={() => editShiftId && openDeleteConfirm(editShiftId)} className="inline-flex items-center h-9 px-4 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100">Delete</button>
                ) : (
                  <span />
                )
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                <button onClick={() => setEditOpen(false)} className="inline-flex items-center h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
                <button onClick={saveEditor} className="inline-flex items-center h-9 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
            <h3 className="text-sm font-semibold text-slate-900">Delete shift</h3>
            <p className="mt-2 text-sm text-slate-700">
              {confirmShift ? (
                <>
                  Delete shift for <span className="font-medium">{confirmShift.employee_name}</span> on {new Date(confirmShift.start_time).toLocaleDateString()}?
                </>
              ) : (
                "Are you sure you want to delete this shift?"
              )}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setConfirmOpen(false); setConfirmShiftId(null); }} className="inline-flex items-center h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} className="inline-flex items-center h-9 px-4 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
