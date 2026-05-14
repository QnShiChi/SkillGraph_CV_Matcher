import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_24px_80px_rgba(10,20,40,0.08)] backdrop-blur-xl md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-dark)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--color-text)] md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-muted)] md:text-[15px]">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
