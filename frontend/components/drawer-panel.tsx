"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-stretch justify-end overflow-hidden bg-[rgba(11,28,48,0.36)] backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-white/60 bg-[rgba(255,255,255,0.9)] shadow-[0_30px_90px_rgba(10,20,40,0.16)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(134,155,189,0.16)] px-6 py-6 md:px-8">
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-white"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
