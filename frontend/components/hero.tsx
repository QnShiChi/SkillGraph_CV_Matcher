type HeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function Hero({ eyebrow, title, description }: HeroProps) {
  return (
    <section className="rounded-[28px] border border-[var(--color-border)] bg-white/90 p-8 shadow-whisper md:p-12">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
        {eyebrow}
      </p>
      <h1 className="max-w-3xl font-display text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)] md:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] md:text-lg">
        {description}
      </p>
    </section>
  );
}
