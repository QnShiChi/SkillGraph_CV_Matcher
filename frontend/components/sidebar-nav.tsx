"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/overview", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/jobs", label: "Jobs", icon: "work" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-x-0 top-0 z-40 border-b border-white/70 bg-white/80 px-4 py-4 backdrop-blur-xl md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between md:block">
        <div className="mb-0 md:mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
            SkillGraph AI
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.04em] text-[var(--color-text)] md:text-2xl">
            Recruitment Suite
          </h2>
        </div>
        <div className="md:hidden">
          <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-dark)]">
            Workspace
          </span>
        </div>
      </div>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 md:mt-2 md:flex-col md:gap-2 md:overflow-visible">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition md:rounded-[18px] md:px-4 md:py-3 ${
                active
                  ? "bg-[var(--color-brand)] text-white shadow-[0_14px_28px_rgba(75,65,225,0.24)]"
                  : "bg-[rgba(148,151,169,0.08)] text-[var(--color-text)] hover:bg-[rgba(75,65,225,0.10)]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 hidden md:block">
        <Link
          href="/admin/jobs"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(75,65,225,0.22)] transition hover:opacity-95"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Import JD
        </Link>
      </div>
    </aside>
  );
}
