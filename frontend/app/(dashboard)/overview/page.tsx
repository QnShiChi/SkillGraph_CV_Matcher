import { Hero } from "@/components/hero";
import { PageHeader } from "@/components/page-header";
import { SectionShell } from "@/components/section-shell";
import { StatusCard } from "@/components/status-card";
import { getCandidates, getConnections, getJobs } from "@/lib/api";

const fallbackServices = {
  postgres: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
  neo4j: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
};

export default async function OverviewPage() {
  const [connections, jobs, candidates] = await Promise.all([
    getConnections(),
    getJobs(),
    getCandidates(),
  ]);

  const services = connections?.services ?? fallbackServices;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Track runtime health and inspect the current state of persisted jobs and candidates."
      />

      <Hero
        eyebrow="Explainable Matching"
        title="SkillGraph CV Matcher for transparent HR screening"
        description="A Docker-first scaffold for CV analysis, graph-aware skill matching, and explainable ranking. This milestone adds PostgreSQL-backed persistence and live dashboard data."
      />

      <SectionShell title="Runtime Status">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Frontend"
            status="ok"
            message="Next.js dashboard is rendering."
          />
          <StatusCard
            label="Backend"
            status={connections ? "ok" : "unknown"}
            message={
              connections
                ? "FastAPI connection endpoint responded."
                : "Waiting for backend connection response."
            }
          />
          <StatusCard
            label="PostgreSQL"
            status={services.postgres.status}
            message={services.postgres.message}
          />
          <StatusCard
            label="Neo4j"
            status={services.neo4j.status}
            message={services.neo4j.message}
          />
        </div>
      </SectionShell>

      <SectionShell title="Current Totals">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Jobs</h3>
            <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
              {jobs.length}
            </p>
          </article>
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Candidates</h3>
            <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
              {candidates.length}
            </p>
          </article>
        </div>
      </SectionShell>
    </div>
  );
}
