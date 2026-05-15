import { PageHeader } from "@/components/page-header";
import { SectionShell } from "@/components/section-shell";

const quickStartSteps = [
  {
    step: "1",
    title: "Open Settings",
    detail:
      "Open the Settings dock in the lower-left corner to check whether OpenRouter is already connected before importing or screening.",
  },
  {
    step: "2",
    title: "Connect OpenRouter",
    detail:
      "Paste an API key and click Save. The app validates the key first, then shows Connected when the active key is ready to use.",
  },
  {
    step: "3",
    title: "Create or Import a Job",
    detail:
      "Use Import JD to upload a JD PDF, or create a job manually inside Jobs when you already have the hiring requirements.",
  },
  {
    step: "4",
    title: "Import Candidate CVs",
    detail:
      "Open the target job workspace and import CV PDFs there so each candidate is attached to the correct job from the start.",
  },
  {
    step: "5",
    title: "Run Screening and Ranking",
    detail:
      "Inside the workspace, click Run Screening & Ranking to verify project links, assign pass or reject decisions, and build the ranked shortlist.",
  },
  {
    step: "6",
    title: "Compare Candidates",
    detail:
      "Select one ranked candidate, choose the second name from the inline compare list, and the app opens benchmarking automatically.",
  },
];

const workflowGroups = [
  {
    title: "API and Key Source",
    icon: "vpn_key",
    bullets: [
      "Open Settings in the lower-left corner of the screen.",
      "If the server already provides an OpenRouter key, the dock shows that the active source is the server environment.",
      "If you save a key manually, the app validates it before storing it and switching the active connection.",
      "Use Clear when you want to remove the saved fallback key and reset the current user-managed override.",
    ],
  },
  {
    title: "Job Intake",
    icon: "upload_file",
    bullets: [
      "Click Import JD in the left sidebar.",
      "Upload a JD PDF or create the job manually from the Jobs area.",
      "Wait for the parser to create the job record and structured job content.",
      "Open the workspace to review the title, parsed sections, and graph sync status.",
    ],
  },
  {
    title: "Candidate Intake",
    icon: "person_add",
    bullets: [
      "Open the correct job workspace before importing CVs.",
      "Upload one or more CV PDFs so each candidate profile stays attached to the active job.",
      "New imports appear in the Newly Imported section before they are screened.",
      "Review extracted skills, parse source, and graph sync after each import.",
    ],
  },
  {
    title: "Screening, Ranking, and Compare",
    icon: "analytics",
    bullets: [
      "Run screening only after the target candidate set for that job has been imported.",
      "Candidates move into Ranked Candidates only if their evidence passes the verification rules.",
      "Evidence score reflects project-link verification strength, while match score reflects job fit.",
      "To compare two ranked candidates, choose the first candidate and then click the second candidate name in the inline list. Benchmarking opens immediately.",
    ],
  },
];

const troubleshootingTips = [
  {
    title: "OpenRouter shows Failed",
    detail:
      "The key is invalid, expired, or rejected by OpenRouter. Open Settings, replace the key, save again, and wait for the status to return to Connected.",
  },
  {
    title: "JD or CV import fails",
    detail:
      "Use PDFs with real selectable text whenever possible. Image-only or low-quality scanned PDFs can still import, but extracted content is less reliable.",
  },
  {
    title: "Candidate does not appear in ranking",
    detail:
      "Check whether the CV was imported into the correct job, then run Screening & Ranking. Candidates with failed evidence checks stay in the rejected section instead of the ranked board.",
  },
  {
    title: "Evidence score looks too high",
    detail:
      "Evidence score is based on reachable project links and whether the fetched content supports the CV claims. It is a link-verification signal, not a full technical interview score.",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Guide"
        title="How to Use SkillGraph CV Matcher"
        description="This page summarizes the live workflow of the current app: connect OpenRouter, import jobs and CVs, run evidence-based screening, rank candidates, and open benchmarking from the workspace."
      />

      <SectionShell title="Quick Start">
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {quickStartSteps.map((item) => (
            <article
              key={item.step}
              className="rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold text-[var(--color-text)]">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{item.detail}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Workflow">
        <div className="grid gap-5 xl:grid-cols-2">
          {workflowGroups.map((group) => (
            <article
              key={group.title}
              className="rounded-[26px] border border-white/70 bg-white/82 p-6 shadow-[0_18px_50px_rgba(10,20,40,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(75,65,225,0.10)] text-[var(--color-brand)]">
                  <span className="material-symbols-outlined text-[22px]">{group.icon}</span>
                </span>
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                  {group.title}
                </h3>
              </div>
              <div className="mt-5 space-y-3">
                {group.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex items-start gap-3 rounded-[18px] border border-[rgba(75,65,225,0.10)] bg-[rgba(248,250,255,0.86)] px-4 py-3"
                  >
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)]" />
                    <p className="text-sm leading-6 text-[var(--color-muted)]">{bullet}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell title="Troubleshooting">
        <div className="grid gap-5 md:grid-cols-3">
          {troubleshootingTips.map((tip) => (
            <article
              key={tip.title}
              className="rounded-[24px] border border-[rgba(239,68,68,0.12)] bg-[rgba(255,255,255,0.84)] p-6 shadow-[0_18px_50px_rgba(10,20,40,0.05)] backdrop-blur-xl"
            >
              <p className="inline-flex rounded-full bg-[rgba(239,68,68,0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
                Support
              </p>
              <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{tip.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{tip.detail}</p>
            </article>
          ))}
        </div>
      </SectionShell>
    </div>
  );
}
