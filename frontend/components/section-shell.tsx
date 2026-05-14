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
      <div className="mb-5 flex items-end gap-4">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
          {title}
        </h2>
        <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(75,65,225,0.22),transparent)]" />
      </div>
      {children}
    </section>
  );
}
