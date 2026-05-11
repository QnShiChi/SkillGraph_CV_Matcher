import type { ReactNode } from "react";

export function StateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
