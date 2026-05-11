import type { ReactNode } from "react";

export function SectionShell({
  title,
  children,
}: Readonly<{
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="mt-10">
      <h2 className="mb-5 font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
