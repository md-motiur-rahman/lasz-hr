"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { JSX, useState } from "react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

type NavItem = {
  href: string;
  label: string;
  icon: JSX.Element;
};

// Primary navigation (no admin/company profile entries here)
const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 13h8V3H3zM13 21h8v-8h-8zM13 3v8h8V3zM3 21h8v-8H3z" />
      </svg>
    ),
  },
  {
    href: "/company",
    label: "Company",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21V7a2 2 0 0 1 2-2h5v16H5a2 2 0 0 1-2-2z" />
        <path d="M14 21V3h5a2 2 0 0 1 2 2v16" />
      </svg>
    ),
  },
  {
    href: "/employees",
    label: "Employees",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/rota",
    label: "Rota",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    href: "/leave",
    label: "Leave",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const onLogout = async () => {
    try {
      // Call server-side signout to clear cookies (middleware sees logout)
      const resp = await fetch("/auth/signout", { method: "POST", credentials: "include", cache: "no-store" });
      if (!resp.ok) throw new Error("signout failed");
    } catch (e) {
      // ignore errors on logout
    } finally {
      // Hard reload to ensure cookies are dropped before middleware runs
      window.location.replace("/sign-in");
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-64"} sticky top-0 h-screen transition-all duration-200 border-r border-slate-200 bg-slate-100`}>        
        <div className="h-14 px-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className={collapsed ? "w-10 overflow-hidden" : undefined}>
              <Logo width={140} height={34} showWordmark={!collapsed} />
            </div>
          </Link>
          <button
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
            className="h-8 w-8 grid place-items-center rounded-full border border-slate-300 bg-white hover:bg-slate-200 text-slate-600 shadow-sm"
          >
            {collapsed ? (
              <svg viewBox="0 0 24 24" className="h-4 w-8" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18-6-6 6-6"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            )}
          </button>
        </div>
        <nav className={`mt-2 ${collapsed ? "px-1" : "px-2"}`}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center ${collapsed ? "justify-start gap-0 px-1" : "gap-3 px-3"} rounded-md py-2 mt-1 ${
                  active ? "bg-indigo-600 text-white" : "text-slate-800 hover:bg-slate-200"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`shrink-0 ${active ? "text-white" : "text-slate-600 group-hover:text-slate-900"}`}>{item.icon}</span>
                {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-3 left-0 right-0 px-2 space-y-1">
          {/* Admin profile quick action only at bottom */}
          <Link href="/admin/profile" className={`flex items-center ${collapsed ? "justify-start gap-0 px-1" : "gap-3 px-3"} rounded-md py-2 text-slate-800 hover:bg-slate-200`} title={collapsed ? "Admin profile" : undefined}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            {!collapsed && <span className="text-sm font-medium truncate">Admin profile</span>}
          </Link>
          <button onClick={onLogout} className={`w-full flex items-center ${collapsed ? "justify-start gap-0 px-1" : "gap-3 px-3"} rounded-md py-2 text-slate-800 hover:bg-slate-200`} title={collapsed ? "Logout" : undefined}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            {!collapsed && <span className="text-sm font-medium truncate">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 min-w-0">
        {children}
      </section>
    </div>
  );
}
