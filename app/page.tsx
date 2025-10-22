"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-screen text-slate-800 bg-[radial-gradient(1200px_600px_at_-10%_-10%,#fde68a_10%,transparent_40%),radial-gradient(1000px_500px_at_110%_-10%,#fbcfe8_10%,transparent_40%),radial-gradient(1000px_500px_at_50%_120%,#bfdbfe_10%,#ffffff_40%)]">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center">
          <Logo />
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="hover:text-slate-900/70">Features</a>
          <a href="#why" className="hover:text-slate-900/70">Why LASZ HR</a>
          <a href="#pricing" className="hover:text-slate-900/70">Pricing</a>
          <Link
            href="/sign-in"
            className="inline-flex items-center h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="w-full max-w-7xl mx-auto px-4 pt-6 pb-8 sm:pt-10 sm:pb-16 lg:pt-16 lg:pb-24 grid gap-12 sm:grid-cols-2 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-3">Modern HR Platform</p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-[1.05]">
            LASZ HR
            <br />
            Bright. Powerful. Simple.
          </h1>
          <p className="mt-5 text-slate-700 text-base sm:text-lg max-w-xl">
            Streamline onboarding, manage time off, and run insightful reports in one beautiful, easy-to-use HR system designed for growing teams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center h-12 px-6 rounded-lg text-white font-medium bg-indigo-600 hover:bg-indigo-700 shadow-md transition"
            >
              Get Started
            </Link>
            
          </div>
          <div className="mt-8 flex items-center gap-6 text-slate-500 text-sm">
            <div className="flex -space-x-2">
              <span className="inline-block h-8 w-8 rounded-full bg-fuchsia-400" />
              <span className="inline-block h-8 w-8 rounded-full bg-amber-400" />
              <span className="inline-block h-8 w-8 rounded-full bg-emerald-400" />
            </div>
            <span>Trusted by teams building for tomorrow</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {/* Employee Management */}
            <div className="rounded-xl p-4 border border-slate-200/80 bg-white">
              <div className="h-10 w-10 mb-3 text-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="font-semibold">Employee Management</h3>
              <p className="mt-1 text-sm text-slate-600">
                Centralize profiles, documents, and important employee details.
              </p>
            </div>

            {/* Time Off & Attendance */}
            <div className="rounded-xl p-4 border border-slate-200/80 bg-white">
              <div className="h-10 w-10 mb-3 text-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  <path d="m9 16 2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold">Time Off & Attendance</h3>
              <p className="mt-1 text-sm text-slate-600">
                Simple requests, approvals, and calendars everyone understands.
              </p>
            </div>

            {/* Payroll Ready */}
            <div className="rounded-xl p-4 border border-slate-200/80 bg-white">
              <div className="h-10 w-10 mb-3 text-amber-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M7 12h.01M17 12h.01" />
                </svg>
              </div>
              <h3 className="font-semibold">Payroll Ready</h3>
              <p className="mt-1 text-sm text-slate-600">
                Keep data organized so payroll is consistent and reliable.
              </p>
            </div>

            {/* Insights & Reports */}
            <div className="rounded-xl p-4 border border-slate-200/80 bg-white">
              <div className="h-10 w-10 mb-3 text-fuchsia-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10">
                  <path d="M3 3v18h18" />
                  <rect x="7" y="8" width="3" height="7" rx="1" />
                  <rect x="12" y="6" width="3" height="9" rx="1" />
                  <rect x="17" y="11" width="3" height="4" rx="1" />
                </svg>
              </div>
              <h3 className="font-semibold">Insights & Reports</h3>
              <p className="mt-1 text-sm text-slate-600">
                Real-time analytics to help you make better HR decisions.
              </p>
            </div>

            {/* Rota Management */}
            <div className="rounded-xl p-4 border border-slate-200/80 bg-white">
              <div className="h-10 w-10 mb-3 text-cyan-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <h3 className="font-semibold">Rota Management</h3>
              <p className="mt-1 text-sm text-slate-600">
                Build and share smart shift schedules with ease.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section id="why" className="w-full max-w-7xl mx-auto px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl p-6 border border-slate-200/80 bg-white">
            <h4 className="font-semibold">Delightful UX</h4>
            <p className="mt-1 text-sm text-slate-600">
              Friendly, fast interfaces your team will actually love using.
            </p>
          </div>
          <div className="rounded-xl p-6 border border-slate-200/80 bg-white">
            <h4 className="font-semibold">Secure by default</h4>
            <p className="mt-1 text-sm text-slate-600">
              Authentication and role-based access built on industry standards.
            </p>
          </div>
          <div className="rounded-xl p-6 border border-slate-200/80 bg-white">
            <h4 className="font-semibold">Scales with you</h4>
            <p className="mt-1 text-sm text-slate-600">
              From the first hire to the hundredth, LASZ HR adapts to your growth.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="w-full max-w-7xl mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 md:p-10 shadow-sm">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-indigo-50" aria-hidden />

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1">Free 7-day trial</span>
              <span className="text-xs text-slate-500">No credit card required</span>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <h3 className="text-2xl font-semibold text-slate-900">LASZ HR Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">£30</span>
                <span className="text-slate-500">/month</span>
              </div>
            </div>
            <p className="mt-2 text-slate-600">Full platform access after the trial. Cancel anytime.</p>

            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Employee database</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Leave management</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Rota management</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Payroll management</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Insights & reports</span>
              </div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600"><path d="m5 13 4 4 10-10"/></svg>
                <span>Role-based access</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Link
                href="/sign-in"
                className="inline-flex items-center h-12 px-6 rounded-lg text-white font-medium bg-indigo-600 hover:bg-indigo-700 shadow-md transition"
              >
                Start free trial
              </Link>
              <p className="text-xs text-slate-500">Includes all features during the 7-day trial. £30/month thereafter.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full max-w-7xl mx-auto px-4 pb-10 text-slate-500 text-sm">
        © {new Date().getFullYear()} LASZ HR. All rights reserved.
      </footer>
    </div>
  );
}
