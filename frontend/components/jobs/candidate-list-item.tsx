"use client";

import type { ReactNode } from "react";

type CandidateListItemProps = {
  title: string;
  subtitle: string;
  badges?: ReactNode;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  detail: ReactNode;
  tone?: "default" | "success" | "danger";
};

export function CandidateListItem({
  title,
  subtitle,
  badges,
  summary,
  open,
  onToggle,
  detail,
  tone = "default",
}: CandidateListItemProps) {
  const toneClass =
    tone === "danger"
      ? "border-[rgba(183,54,54,0.18)] bg-[rgba(183,54,54,0.05)]"
      : tone === "success"
        ? "border-[var(--color-border)] bg-white/90"
        : "border-[var(--color-border)] bg-white/90";

  return (
    <article className={`rounded-[18px] border ${toneClass}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--color-text)]">
            {title}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
          {summary ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
              {summary}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {badges}
          <span className="text-sm font-medium text-[var(--color-brand-dark)]">
            {open ? "Hide" : "Show"}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          {detail}
        </div>
      ) : null}
    </article>
  );
}
