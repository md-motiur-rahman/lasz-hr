import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import ProtectedShell from "@/components/ProtectedShell";
import Link from "next/link";
import EmployeeEditButton from "@/components/EmployeeEditButton";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}

function mask(value?: string | null, visible = 2) {
  if (!value) return "—";
  const clean = String(value);
  if (clean.length <= visible) return clean;
  return `${"•".repeat(Math.max(0, clean.length - visible))}${clean.slice(-visible)}`;
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );

  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      "id, company_id, full_name, email, phone, department, address, ni_number, id_type, id_number, date_of_birth, joined_at, nationality, bank_account_name, bank_name, sort_code, account_number, iban, building_society_roll_number, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  const notFound = !!error || !employee;

  return (
    <ProtectedShell>
      <div className="min-h-screen bg-white">
        <section className="w-full border-b bg-[radial-gradient(1200px_600px_at_-10%_-10%,#e0e7ff_16%,transparent_50%),radial-gradient(1000px_500px_at_110%_-10%,#dcfce7_18%,transparent_50%),radial-gradient(1000px_500px_at_50%_120%,#fff7ed_14%,#ffffff_50%)]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Employee Profile</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-900">
                  {notFound ? "Employee not found" : employee.full_name}
                </h1>
                {!notFound && (
                  <div className="mt-2 text-sm text-slate-700 flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="4"/></svg>
                      {employee.department || "No department"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>
                      Joined {fmtDate(employee.joined_at)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!notFound && (
                  <EmployeeEditButton initial={{
                    id: employee?.id!,
                    company_id: employee?.company_id,
                    full_name: employee?.full_name || "",
                    email: employee?.email || null,
                    phone: employee?.phone || null,
                    department: employee?.department || null,
                    address: employee?.address || null,
                    ni_number: employee?.ni_number || null,
                    id_number: employee?.id_number || null,
                    id_type: employee?.id_type || null,
                    date_of_birth: employee?.date_of_birth || null,
                    joined_at: employee?.joined_at || null,
                    nationality: employee?.nationality || null,
                    bank_account_name: employee?.bank_account_name || null,
                    bank_name: employee?.bank_name || null,
                    sort_code: employee?.sort_code || null,
                    account_number: employee?.account_number || null,
                    iban: employee?.iban || null,
                    building_society_roll_number: employee?.building_society_roll_number || null,
                  }} />
                )}
                <Link href="/employees" className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800">Back to list</Link>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-7xl mx-auto px-4 py-8 grid gap-6 lg:grid-cols-3">
          {notFound ? (
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-slate-700">The requested employee could not be found or you do not have permission to view it.</p>
            </div>
          ) : (
            <>
              {/* Left column */}
              <section className="lg:col-span-2 space-y-6">
                {/* Personal & contact */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Personal & contact</h2>
                  </div>
                  <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <div className="text-slate-500">Full name</div>
                      <div className="font-medium text-slate-950">{employee.full_name}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Email</div>
                      <div className="font-medium text-slate-950">{employee.email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Phone</div>
                      <div className="font-medium text-slate-950">{employee.phone || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Department</div>
                      <div className="font-medium text-slate-950">{employee.department || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Date of birth</div>
                      <div className="font-medium text-slate-950">{fmtDate(employee.date_of_birth)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Joining date</div>
                      <div className="font-medium text-slate-950">{fmtDate(employee.joined_at)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-slate-500">Address</div>
                      <div className="font-medium text-slate-950 whitespace-pre-line">{employee.address || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Nationality / Ethnicity</div>
                      <div className="font-medium text-slate-950">{employee.nationality || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Identity */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">Identity</h2>
                  <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <div className="text-slate-500">NI number</div>
                      <div className="font-medium text-slate-950">{employee.ni_number || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">ID type</div>
                      <div className="font-medium text-slate-950">{employee.id_type || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">ID number</div>
                      <div className="font-medium text-slate-950">{employee.id_number || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Bank details */}
                <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm">
                  <div className="px-6 py-4 border-b border-indigo-200 flex items-center gap-3">
                    <span className="h-8 w-8 grid place-items-center rounded-md bg-indigo-100 text-indigo-700">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l9-7 9 7"/><path d="M21 10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10"/><path d="M7 21v-8h10v8"/></svg>
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Bank details</h2>
                      <p className="text-xs text-slate-600">Sensitive fields partially masked.</p>
                    </div>
                  </div>
                  <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500">Bank name</div>
                      <div className="font-medium text-slate-950">{employee.bank_name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Account name</div>
                      <div className="font-medium text-slate-950">{employee.bank_account_name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Sort code</div>
                      <div className="font-medium text-slate-950">{employee.sort_code ? mask(employee.sort_code, 2) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Account number</div>
                      <div className="font-medium text-slate-950">{employee.account_number ? mask(employee.account_number, 2) : "—"}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-slate-500">IBAN</div>
                      <div className="font-medium text-slate-950">{employee.iban ? mask(employee.iban, 4) : "—"}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-slate-500">Building society roll number</div>
                      <div className="font-medium text-slate-950">{employee.building_society_roll_number || "—"}</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right column */}
              <aside className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Profile metadata</h3>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Created</span>
                      <span className="font-medium text-slate-950">{fmtDate(employee.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last updated</span>
                      <span className="font-medium text-slate-950">{fmtDate(employee.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">History</h3>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      Profile created {fmtDate(employee.created_at)}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Last updated {fmtDate(employee.updated_at)}
                    </li>
                    <li className="flex items-start gap-2 text-slate-500">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                      More events coming soon
                    </li>
                  </ul>
                </div>
              </aside>
            </>
          )}
        </main>
      </div>
    </ProtectedShell>
  );
}
