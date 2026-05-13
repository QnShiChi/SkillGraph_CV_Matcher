"use client";

import type { ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  description,
  count,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <section className="rounded-[20px] border border-[var(--color-border)] bg-white/90 shadow-micro">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
            {typeof count === "number" ? (
              <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-dark)]">
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-medium text-[var(--color-brand-dark)]">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
