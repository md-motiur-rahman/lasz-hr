"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EmployeeInput = {
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

export default function EmployeeEditor({ employee }: { employee: EmployeeInput }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(employee);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: any = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      department: form.department,
      address: form.address,
      ni_number: form.ni_number,
      id_number: form.id_number,
      id_type: form.id_type || "passport",
      date_of_birth: form.date_of_birth,
      joined_at: form.joined_at,
      nationality: form.nationality,
      bank_account_name: form.bank_account_name,
      bank_name: form.bank_name,
      sort_code: form.sort_code,
      account_number: form.account_number,
      iban: form.iban,
      building_society_roll_number: form.building_society_roll_number,
    };

    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", employee.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    // Reload the page to reflect server-rendered updates
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit employee</h2>
                <p className="text-xs text-slate-700">Update personal, identity and bank details</p>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-200 bg-white hover:bg-slate-100">✕</button>
            </div>

            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 grid gap-6">
              {/* Personal */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Full name</label>
                  <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Email</label>
                    <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Phone</label>
                    <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Department</label>
                  <input value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-900">Address</label>
                  <textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
              </div>

              {/* Identity */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">NI number</label>
                  <input value={form.ni_number || ""} onChange={(e) => setForm({ ...form, ni_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">ID type</label>
                    <input value={form.id_type || ""} onChange={(e) => setForm({ ...form, id_type: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">ID number</label>
                    <input value={form.id_number || ""} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Date of birth</label>
                  <input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Joining date</label>
                  <input type="date" value={form.joined_at || ""} onChange={(e) => setForm({ ...form, joined_at: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-900">Nationality / Ethnicity</label>
                  <input value={form.nationality || ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
              </div>

              {/* Bank */}
              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                <h4 className="text-sm font-semibold text-slate-900">Bank (optional)</h4>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Bank name</label>
                    <input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Account name</label>
                    <input value={form.bank_account_name || ""} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Sort code</label>
                    <input value={form.sort_code || ""} onChange={(e) => setForm({ ...form, sort_code: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-900">Account number</label>
                    <input value={form.account_number || ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-900">IBAN</label>
                    <input value={form.iban || ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-900">Building society roll number</label>
                    <input value={form.building_society_roll_number || ""} onChange={(e) => setForm({ ...form, building_society_roll_number: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>
                </div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="mt-2 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50">Cancel</button>
                <button className="inline-flex items-center h-10 px-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
