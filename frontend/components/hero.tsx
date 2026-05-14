type HeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function Hero({ eyebrow, title, description }: HeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#c9d7ff] bg-[linear-gradient(135deg,#0b1c30_0%,#131b2e_55%,#23326a_100%)] p-8 text-white shadow-[0_32px_100px_rgba(8,15,30,0.22)] md:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(75,65,225,0.28),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.18),transparent_24%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.05em] md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/72 md:text-lg">
            {description}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Pipeline
            </p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em]">Graph-aware</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Matching
            </p>
            <p className="mt-3 text-2xl font-bold tracking-[-0.04em]">Explainable</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Data layer
            </p>
            <p className="mt-3 text-sm leading-6 text-white/78">
              PostgreSQL-backed persistence with Neo4j projection and recruiter-facing review.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
