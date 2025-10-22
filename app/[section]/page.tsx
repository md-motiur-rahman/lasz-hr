import ProtectedShell from "@/components/ProtectedShell";
import Logo from "@/components/Logo";
import Link from "next/link";

const SECTIONS: Record<string, { title: string; description: string } > = {
  employees: {
    title: "Employees",
    description: "Manage the employee database, roles, documents, and personal details.",
  },
  rota: {
    title: "Rota Management",
    description: "Plan, publish, and manage shifts with clarity and flexibility.",
  },
  leave: {
    title: "Leave Management",
    description: "Track requests, approvals, and calendars across your team.",
  },
  payroll: {
    title: "Payroll",
    description: "Prepare payroll-ready data, summaries, and exports.",
  },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const key = section?.toLowerCase();
  const content = SECTIONS[key];

  return (
    <ProtectedShell>
      <div className="min-h-screen relative overflow-hidden bg-white">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 mask-[radial-gradient(60%_50%_at_50%_0%,black,transparent)]">
          <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-indigo-100" />
          <div className="absolute -top-12 right-0 h-64 w-64 rounded-full bg-emerald-100" />
          <div className="absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-amber-100" />
        </div>

        {/* Header */}
        <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <Logo width={160} height={38} />
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">Dashboard</Link>
            <Link href="/company/profile" className="text-slate-700 hover:text-slate-900">Company</Link>
          </nav>
        </header>

        <main className="relative z-10 w-full max-w-6xl mx-auto px-4 pb-16">
          {content ? (
            <section className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">{content.title}</h1>
                <p className="text-slate-600 mt-2">{content.description}</p>
              </div>

              {/* Sample content blocks */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-medium text-slate-900">Quick actions</h3>
                  <p className="text-sm text-slate-600 mt-1">Add, edit, and manage records.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-medium text-slate-900">Overview</h3>
                  <p className="text-sm text-slate-600 mt-1">Key stats and updates at a glance.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-medium text-slate-900">Reports</h3>
                  <p className="text-sm text-slate-600 mt-1">Export summaries and insights.</p>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center h-11 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  Back to Dashboard
                </Link>
              </div>
            </section>
          ) : (
            <section className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
                <p className="text-slate-600 mt-2">The requested section does not exist.</p>
                <div className="mt-4 flex gap-3">
                  <Link href="/employees" className="underline">Employees</Link>
                  <Link href="/rota" className="underline">Rota</Link>
                  <Link href="/leave" className="underline">Leave</Link>
                  <Link href="/payroll" className="underline">Payroll</Link>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedShell>
  );
}

export function generateStaticParams() {
  return [
    { section: "employees" },
    { section: "rota" },
    { section: "leave" },
    { section: "payroll" },
  ];
}
