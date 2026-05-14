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
    <article className="rounded-[24px] border border-white/70 bg-white/82 p-5 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#14b8a6_100%)]" />
        <h3 className="text-[1.05rem] font-semibold text-[var(--color-text)]">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
