"use client";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,28,48,0.44)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/92 p-6 shadow-[0_30px_90px_rgba(10,20,40,0.2)]">
        <h3 className="text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/70 bg-white/80 px-4 py-3 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(75,65,225,0.24)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
