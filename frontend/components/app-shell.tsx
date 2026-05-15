import type { ReactNode } from "react";

import { SidebarNav } from "@/components/sidebar-nav";
import { SettingsDock } from "@/components/settings-dock";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      <div className="min-h-screen pt-20 md:pl-64 md:pt-0">
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="flex flex-1 items-center gap-3 rounded-full border border-white/70 bg-white/80 px-4 py-2 shadow-[0_10px_30px_rgba(10,20,40,0.05)]">
              <span className="material-symbols-outlined text-[20px] text-[var(--color-muted)]">
                search
              </span>
              <input
                aria-label="Search"
                className="w-full bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
                placeholder="Search jobs, candidates, skills..."
                type="text"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/80 text-[var(--color-muted)] shadow-[0_10px_30px_rgba(10,20,40,0.05)] transition hover:text-[var(--color-brand)]"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
              </button>
              <div className="hidden items-center gap-3 rounded-full border border-white/70 bg-white/80 px-3 py-2 shadow-[0_10px_30px_rgba(10,20,40,0.05)] md:flex">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Alex Thompson</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
                    Senior Recruiter
                  </p>
                </div>
                <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
      <SettingsDock />
    </div>
  );
}
