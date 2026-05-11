"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/admin/jobs", label: "Admin Jobs" },
  { href: "/admin/candidates", label: "Admin Candidates" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-[var(--color-border)] bg-white/90 px-4 py-4 md:w-72 md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
          SkillGraph
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
          Admin Workspace
        </h2>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[16px] px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[var(--color-brand)] text-white shadow-micro"
                  : "bg-[rgba(148,151,169,0.08)] text-[var(--color-text)] hover:bg-[var(--color-brand-subtle)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
