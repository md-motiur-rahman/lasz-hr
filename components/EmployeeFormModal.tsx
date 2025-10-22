"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type EmployeeRecord = {
  id?: string;
  company_id?: string;
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

export const DEPARTMENTS = [
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

export const NATIONALITIES = [
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

export default function EmployeeFormModal({
  open,
  mode,
  companyId,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  companyId?: string; // required for create
  initial?: Partial<EmployeeRecord>;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<EmployeeRecord>({
    id: initial?.id,
    company_id: initial?.company_id,
    full_name: initial?.full_name || "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    department: initial?.department ?? "",
    address: initial?.address ?? "",
    ni_number: initial?.ni_number ?? "",
    id_number: initial?.id_number ?? "",
    id_type: initial?.id_type ?? "passport",
    date_of_birth: initial?.date_of_birth ?? "",
    joined_at: initial?.joined_at ?? "",
    nationality: initial?.nationality ?? "",
    bank_account_name: initial?.bank_account_name ?? "",
    bank_name: initial?.bank_name ?? "",
    sort_code: initial?.sort_code ?? "",
    account_number: initial?.account_number ?? "",
    iban: initial?.iban ?? "",
    building_society_roll_number: initial?.building_society_roll_number ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        id: initial?.id,
        company_id: initial?.company_id,
        full_name: initial?.full_name || "",
        email: initial?.email ?? "",
        phone: initial?.phone ?? "",
        department: initial?.department ?? "",
        address: initial?.address ?? "",
        ni_number: initial?.ni_number ?? "",
        id_number: initial?.id_number ?? "",
        id_type: initial?.id_type ?? "passport",
        date_of_birth: initial?.date_of_birth ?? "",
        joined_at: initial?.joined_at ?? "",
        nationality: initial?.nationality ?? "",
        bank_account_name: initial?.bank_account_name ?? "",
        bank_name: initial?.bank_name ?? "",
        sort_code: initial?.sort_code ?? "",
        account_number: initial?.account_number ?? "",
        iban: initial?.iban ?? "",
        building_society_roll_number: initial?.building_society_roll_number ?? "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useIban, setUseIban] = useState<boolean>(!!initial?.iban);

  const sortCodeRaw = (form.sort_code || "").replace(/\D/g, "");
  const accountRaw = (form.account_number || "").replace(/\D/g, "");
  const ibanRaw = normalizeIban(form.iban || "");
  const isSortCodeValid = validateSortCode(form.sort_code || "");
  const isAccountValid = validateAccountNumber(form.account_number || "");
  const isIbanValid = validateIban(form.iban || "");

  const close = () => {
    setError(null);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: any = {
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
      bank_account_name: useIban ? null : form.bank_account_name || null,
      bank_name: useIban ? null : form.bank_name || null,
      sort_code: useIban ? null : form.sort_code || null,
      account_number: useIban ? null : form.account_number || null,
      iban: useIban ? (form.iban || null) : null,
      building_society_roll_number: useIban ? null : form.building_society_roll_number || null,
    };

    let err = null;
    if (mode === "create") {
      if (!companyId) {
        setError("Missing company id");
        setSaving(false);
        return;
      }
      payload.company_id = companyId;
      const { error } = await supabase.from("employees").insert(payload);
      err = error;
    } else {
      const { error } = await supabase.from("employees").update(payload).eq("id", form.id!);
      err = error;
    }

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    close();
    onSaved?.();
  };

  if (!open) return null;

  return (
    <div className="fixed w-full inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{mode === "create" ? "Add employee" : "Edit employee"}</h2>
            <p className="text-xs text-slate-700">{mode === "create" ? "Capture" : "Update"} personal, identity and bank details</p>
          </div>
          <button onClick={close} className="h-8 w-8 grid place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-100">✕</button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 grid gap-6">
          {/* Personal & contact */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Full name</label>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">Email</label>
                <input type="email" required value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">Phone</label>
                <input required value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 20 1234 5678" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">Department</label>
              <select
                required
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
              <textarea required value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Postcode" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
            </div>
          </div>

          {/* Identity */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900">NI number</label>
              <input required value={form.ni_number || ""} onChange={(e) => setForm({ ...form, ni_number: e.target.value })} placeholder="QQ 12 34 56 C" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
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
                <input required value={form.id_number || ""} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
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
                required
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
                  value={form.iban || ""}
                  onChange={(e) => setForm({ ...form, iban: normalizeIban(e.target.value) })}
                  placeholder="GB29NWBK60161331926819"
                  pattern="^[A-Za-z0-9\\s]{15,34}$"
                  title="15–34 alphanumeric characters"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500"
                  disabled={!useIban}
                />
                <p className="text-xs text-slate-700">If IBAN is provided, domestic fields will be ignored.</p>
              </div>

              {/* Building society roll number */}
              <div className={`space-y-2 sm:col-span-2 ${useIban ? "hidden" : ""}`}>
                <label className="block text-sm font-medium text-slate-900">Building society roll number (optional)</label>
                <input value={form.building_society_roll_number || ""} onChange={(e) => setForm({ ...form, building_society_roll_number: e.target.value })} placeholder="e.g., 123456789/AB" className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 placeholder:text-slate-500" disabled={useIban} />
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button type="button" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-950" onClick={close}>Cancel</button>
            <button className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" disabled={saving}>
              {saving ? (mode === "create" ? "Saving…" : "Saving…") : (mode === "create" ? "Save" : "Save changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
