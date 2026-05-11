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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,17,20,0.22)] px-4">
      <div className="w-full max-w-md rounded-[24px] border border-[var(--color-border)] bg-white p-6 shadow-whisper">
        <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[12px] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
