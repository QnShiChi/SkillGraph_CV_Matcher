type StatusCardProps = {
  label: string;
  status: string;
  message: string;
};

export function StatusCard({ label, status, message }: StatusCardProps) {
  const ok = status === "ok";

  return (
    <article className="rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{label}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
            ok
              ? "bg-[rgba(20,158,97,0.14)] text-[var(--color-success-text)]"
              : "bg-[rgba(75,65,225,0.12)] text-[var(--color-brand-dark)]"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{message}</p>
    </article>
  );
}
