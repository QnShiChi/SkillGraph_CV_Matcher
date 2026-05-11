type StatusCardProps = {
  label: string;
  status: string;
  message: string;
};

export function StatusCard({ label, status, message }: StatusCardProps) {
  const ok = status === "ok";

  return (
    <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{label}</h3>
        <span
          className={`rounded-md px-3 py-1 text-xs font-semibold ${
            ok
              ? "bg-[rgba(20,158,97,0.16)] text-[var(--color-success-text)]"
              : "bg-[rgba(113,50,245,0.12)] text-[var(--color-brand-dark)]"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{message}</p>
    </article>
  );
}
