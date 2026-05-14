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
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{subtitle}</p>
          {summary ? (
            <p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--color-muted)]">
              {summary}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badges}
          <span className="text-xs font-medium text-[var(--color-brand-dark)]">
            {open ? "Hide" : "Show"}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-3 py-3">
          {detail}
        </div>
      ) : null}
    </article>
  );
}
