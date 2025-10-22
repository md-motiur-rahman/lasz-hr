"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  address: string | null;
  ni_number: string | null;
  id_number: string | null;
  id_type: string | null;
  date_of_birth: string | null;
  joined_at: string | null;
  nationality: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  sort_code: string | null;
  account_number: string | null;
  iban: string | null;
  building_society_roll_number: string | null;
};

const DEPARTMENTS = [
  "Operations",
  "Human Resources",
  "Finance",
  "Accounting",
  "Sales",
  "Marketing",
  "Customer Support",
  "Customer Success",
  "Information Technology",
  "Engineering",
  "Product",
  "Design",
  "Quality Assurance",
  "Legal",
  "Procurement",
  "Facilities",
  "Logistics",
  "Supply Chain",
  "Security",
  "Research & Development",
  "Administration",
] as const;

const NATIONALITIES = [
  "British",
  "Irish",
  "Asian British",
  "Indian",
  "Pakistani",
  "Bangladeshi",
  "Chinese",
  "Other Asian",
  "Black British",
  "African",
  "Caribbean",
  "Other Black/African/Caribbean",
  "White",
  "White and Black Caribbean",
  "White and Black African",
  "White and Asian",
  "Other Mixed/Multiple",
  "Arab",
  "Any other ethnic group",
  "EU/EEA (non-UK)",
  "Other European",
] as const;

const BANK_SUGGESTIONS = [
  "Barclays",
  "HSBC",
  "Lloyds Bank",
  "NatWest",
  "Santander",
  "Nationwide",
  "TSB",
  "Metro Bank",
  "Monzo",
  "Starling Bank",
  "Virgin Money",
  "RBS",
] as const;

// Helpers for formatting/validation
function digits(value: string, max?: number) {
  const d = (value || "").replace(/\D/g, "");
  return typeof max === "number" ? d.slice(0, max) : d;
}
function formatSortCode(value: string) {
  const d = digits(value, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}
function validateSortCode(value: string) {
  return digits(value).length === 6;
}
function validateAccountNumber(value: string) {
  return digits(value).length === 8;
}
function normalizeIban(value: string) {
  return (value || "").toUpperCase().replace(/\s+/g, "");
}
function validateIban(value: string) {
  const v = normalizeIban(value);
  return /^[A-Z0-9]{15,34}$/.test(v) && v.startsWith("GB");
}

export default function EmployeesClient({ companyId, companyName }: { companyId: string | null; companyName: string | null }) {
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for create
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [useIban, setUseIban] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [sortAsc, setSortAsc] = useState(true);

  const canWrite = useMemo(() => !!companyId, [companyId]);
  const sortCodeRaw = (form.sort_code || "").replace(/\D/g, "");
  const accountRaw = (form.account_number || "").replace(/\D/g, "");
  const ibanRaw = normalizeIban((form as any).iban || "");
  const isSortCodeValid = validateSortCode(form.sort_code || "");
  const isAccountValid = validateAccountNumber(form.account_number || "");
  const isIbanValid = validateIban((form as any).iban || "");

  // Derived view with filters/search/sort
  const view = useMemo(() => {
    let arr = list;
    if (deptFilter) arr = arr.filter((e) => (e.department || "") === deptFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (e) =>
          (e.full_name || "").toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q) ||
          (e.phone || "").toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const an = (a.full_name || "").toLowerCase();
      const bn = (b.full_name || "").toLowerCase();
      return sortAsc ? an.localeCompare(bn) : bn.localeCompare(an);
    });
    return arr;
  }, [list, deptFilter, search, sortAsc]);

  async function fetchEmployees() {
    if (!companyId) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, email, phone, department, address, ni_number, id_number, id_type, date_of_birth, joined_at, nationality, bank_account_name, bank_name, sort_code, account_number, iban, building_society_roll_number")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true });
    if (error) {
      setError(error.message);
      setList([]);
    } else {
      setList((data as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEmployees();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("employees-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, (payload) => {
        const rowCompanyId = (payload.new as any)?.company_id ?? (payload.old as any)?.company_id;
        if (!rowCompanyId || rowCompanyId !== companyId) return;
        fetchEmployees();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);

    const payload: any = {
      company_id: companyId,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      department: form.department || null,
      address: form.address || null,
      ni_number: form.ni_number || null,
      id_number: form.id_number || null,
      id_type: form.id_type || "passport",
      date_of_birth: form.date_of_birth || null,
      joined_at: form.joined_at || null,
      nationality: form.nationality || null,
      bank_account_name: form.bank_account_name || null,
      bank_name: form.bank_name || null,
      sort_code: useIban ? null : form.sort_code || null,
      account_number: useIban ? null : form.account_number || null,
      iban: useIban ? (form as any).iban || null : null,
      building_society_roll_number: useIban ? null : (form as any).building_society_roll_number || null,
    };

    const { error } = await supabase.from("employees").insert(payload);
    if (error) setError(error.message);
    else {
      setOpen(false);
      setForm({});
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#ede9fe_20%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_20%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_10%,#ffffff_50%)]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Employees</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{companyName ? `${companyName} — Employees` : "Employees"}</h1>
              <p className="mt-2 text-slate-600 text-sm">Manage your employee database with live updates.</p>
            </div>
            <div>
              <button onClick={() => setOpen(true)} disabled={!canWrite} className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">Add employee</button>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div>Loading…</div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email or phone"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                >
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortAsc((v) => !v)}
                  className="inline-flex items-center h-10 px-3 rounded-md border border-slate-300 bg-white text-slate-900 text-sm hover:bg-slate-50"
                >
                  Sort: Name {sortAsc ? "A→Z" : "Z→A"}
                </button>
                {(search || deptFilter || !sortAsc) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setDeptFilter(""); setSortAsc(true); }}
                    className="inline-flex items-center h-10 px-3 rounded-md text-sm text-slate-700 hover:text-slate-900"
                  >
                    Reset
                  </button>
                )}
              </div>

              {list.length === 0 ? (
                <div className="text-slate-600">No employees yet.</div>
              ) : view.length === 0 ? (
                <div className="text-slate-600">No matching employees.</div>
              ) : (
                <div className="relative max-h-[60vh] overflow-y-auto overflow-x-auto rounded-md">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-slate-900 font-semibold">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Department</th>
                        <th className="py-2 pr-3">Phone</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.map((emp) => (
                        <tr key={emp.id} className="border-t border-slate-100">
                          <td className="py-2 pr-3 font-semibold text-slate-950">{emp.full_name}</td>
                          <td className="py-2 pr-3 text-slate-950">{emp.department || "—"}</td>
                          <td className="py-2 pr-3 text-slate-950">{emp.phone || "—"}</td>
                          <td className="py-2 pr-3 text-slate-950">{emp.email || "—"}</td>
                          <td className="py-2 pr-3">
                            <Link href={`/employees/${emp.id}`} className="inline-flex items-center h-8 px-3 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer / Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Add employee</h2>
                  <p className="text-xs text-slate-700">Capture personal, identity and bank details</p>
                </div>
                <button onClick={() => setOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-100">✕</button>
              </div>

              <form onSubmit={createEmployee} className="flex-1 overflow-y-auto p-6 grid gap-6">
                {/* Personal & contact */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Full name</label>
                    <input required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-900">Email</label>
                      <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-900">Phone</label>
                      <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 20 1234 5678" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Department</label>
                    <select
                      value={form.department || ""}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    >
                      <option value="" disabled>
                        Select department
                      </option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="block text-sm font-medium text-slate-900">Address</label>
                    <textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Postcode" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                  </div>
                </div>

                {/* Identity */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">NI number</label>
                    <input value={form.ni_number || ""} onChange={(e) => setForm({ ...form, ni_number: e.target.value })} placeholder="QQ 12 34 56 C" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                    <p className="text-xs text-slate-700">UK National Insurance format: QQ 12 34 56 C</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-900">ID type</label>
                      <select value={form.id_type || "passport"} onChange={(e) => setForm({ ...form, id_type: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500">
                        <option value="passport">Passport</option>
                        <option value="brp">BRP</option>
                        <option value="arc">ARC</option>
                        <option value="eu_id">EU ID</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-900">ID number</label>
                      <input value={form.id_number || ""} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Date of birth</label>
                    <input type="date" required value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Joining date</label>
                    <input type="date" required value={form.joined_at || ""} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Nationality / Ethnicity</label>
                    <select
                      value={form.nationality || ""}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    >
                      <option value="" disabled>
                        Select nationality / ethnicity
                      </option>
                      {NATIONALITIES.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bank details */}
                <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm">
                  <div className="px-6 py-4 border-b border-indigo-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 grid place-items-center rounded-md bg-indigo-100 text-indigo-700">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l9-7 9 7"/><path d="M21 10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10"/><path d="M7 21v-8h10v8"/></svg>
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Bank details</h4>
                        <p className="text-xs text-slate-700">Domestic (UK) or IBAN. Fields auto-format and validate.</p>
                      </div>
                    </div>
                    <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1 text-xs font-medium">
                      <button type="button" onClick={() => setUseIban(false)} className={`px-3 py-1 rounded ${!useIban ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-white/70"}`} aria-pressed={!useIban}>UK account</button>
                      <button type="button" onClick={() => setUseIban(true)} className={`px-3 py-1 rounded ${useIban ? "bg-indigo-600 text-white shadow-sm" : "text-slate-700 hover:bg-white/70"}`} aria-pressed={useIban}>IBAN account</button>
                    </div>
                  </div>

                  <div className="p-6 grid gap-4 sm:grid-cols-2">
                    {/* Bank name with suggestions */}
                    <div className={`space-y-2 ${useIban ? "hidden" : ""}`}>
                      <label className="block text-sm font-medium text-slate-900">Bank name</label>
                      <input list="bank-list" value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Barclays" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500" disabled={useIban} />
                      <datalist id="bank-list">
                        {BANK_SUGGESTIONS.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                    <div className={`space-y-2 ${useIban ? "hidden" : ""}`}>
                      <label className="block text-sm font-medium text-slate-900">Account name</label>
                      <input value={form.bank_account_name || ""} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} placeholder="Jane Doe" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500" disabled={useIban} />
                    </div>

                    {/* Sort code with formatter and validity chip */}
                    <div className={`space-y-1 ${useIban ? "hidden" : ""}`}>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-900">Sort code</label>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isSortCodeValid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{isSortCodeValid ? "Valid" : `${sortCodeRaw.length}/6`}</span>
                      </div>
                      <input
                        value={form.sort_code || ""}
                        onChange={(e) => setForm({ ...form, sort_code: formatSortCode(e.target.value) })}
                        placeholder="12-34-56"
                        inputMode="numeric"
                        pattern="^\\d{2}-?\\d{2}-?\\d{2}$"
                        title="Enter a UK sort code, e.g. 12-34-56"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500"
                        disabled={useIban}
                      />
                    </div>

                    {/* Account number with formatter and validity chip */}
                    <div className={`space-y-1 ${useIban ? "hidden" : ""}`}>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-900">Account number</label>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isAccountValid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{isAccountValid ? "Valid" : `${accountRaw.length}/8`}</span>
                      </div>
                      <input
                        value={form.account_number || ""}
                        onChange={(e) => setForm({ ...form, account_number: digits(e.target.value, 8) })}
                        placeholder="12345678"
                        inputMode="numeric"
                        pattern="^\\d{8}$"
                        title="8-digit UK account number"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500"
                        disabled={useIban}
                      />
                    </div>

                    {/* IBAN with paste helper */}
                    <div className={`space-y-1 sm:col-span-2 ${useIban ? "" : "hidden"}`}>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-900">IBAN</label>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isIbanValid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{ibanRaw ? (isIbanValid ? "Valid" : `${ibanRaw.length} chars`) : "Optional"}</span>
                          <button type="button" onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setForm({ ...form, iban: normalizeIban(text) });
                            } catch {}
                          }} className="h-8 px-2 rounded-md bg-indigo-600 text-white text-xs hover:bg-indigo-700">Paste</button>
                        </div>
                      </div>
                      <input
                        value={(form as any).iban || ""}
                        onChange={(e) => setForm({ ...form, iban: normalizeIban(e.target.value) })}
                        placeholder="GB29NWBK60161331926819"
                        pattern="^[A-Za-z0-9\s]{15,34}$"
                        title="15–34 alphanumeric characters"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500"
                        disabled={!useIban}
                      />
                      <p className="text-xs text-slate-700">If IBAN is provided, domestic fields will be ignored.</p>
                    </div>

                    {/* Building society roll number */}
                    <div className={`space-y-2 sm:col-span-2 ${useIban ? "hidden" : ""}`}>
                      <label className="block text-sm font-medium text-slate-900">Building society roll number (optional)</label>
                      <input value={(form as any).building_society_roll_number || ""} onChange={(e) => setForm({ ...form, building_society_roll_number: e.target.value })} placeholder="e.g., 123456789/AB" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500" disabled={useIban} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-2 flex items-center justify-end gap-3">
                  <button type="button" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-950" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
