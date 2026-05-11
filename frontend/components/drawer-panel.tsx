"use client";

import type { ReactNode } from "react";

export function DrawerPanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(16,17,20,0.18)]">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border)] bg-white p-6 shadow-whisper md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
