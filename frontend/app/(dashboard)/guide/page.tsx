import { PageHeader } from "@/components/page-header";
import { SectionShell } from "@/components/section-shell";

const quickStartSteps = [
  {
    step: "1",
    title: "Open Settings",
    detail:
      "Click the Settings dock at the bottom-left corner to open API Configuration before using AI-assisted parsing.",
  },
  {
    step: "2",
    title: "Connect OpenRouter",
    detail:
      "Paste your OpenRouter API key, then press Save. Wait for the green Connected status before continuing.",
  },
  {
    step: "3",
    title: "Import a Job Description",
    detail:
      "Use the Import JD button in the sidebar to upload a JD PDF or create a job record from your hiring brief.",
  },
  {
    step: "4",
    title: "Upload Candidate CVs",
    detail:
      "Open the target job and import candidate CV PDFs into that workspace so the system can parse and attach them correctly.",
  },
  {
    step: "5",
    title: "Run Screening and Ranking",
    detail:
      "From the job workspace, trigger screening to score candidates, review evidence, and produce a ranked shortlist.",
  },
  {
    step: "6",
    title: "Compare Top Candidates",
    detail:
      "Open the benchmarking view to compare strengths, gaps, scores, and supporting evidence side by side.",
  },
];

const workflowGroups = [
  {
    title: "API Configuration",
    icon: "vpn_key",
    bullets: [
      "Open Settings from the bottom-left corner of the dashboard shell.",
      "Paste a valid OpenRouter API key into the password field.",
      "Press Save and confirm the connection badge turns green with Connected.",
      "If the badge turns red with Failed, correct the key and save again before importing any JD or CV.",
    ],
  },
  {
    title: "Job Intake",
    icon: "upload_file",
    bullets: [
      "Click Import JD in the left sidebar.",
      "Upload a text-based JD PDF or enter the job content in the provided form.",
      "Wait for the platform to parse the document and create a job entry.",
      "Open Jobs to verify the title, parsed structure, and graph sync status.",
    ],
  },
  {
    title: "Candidate Intake",
    icon: "person_add",
    bullets: [
      "Open a job workspace before importing candidate files.",
      "Upload candidate CV PDFs so each profile stays linked to the correct job.",
      "Review extracted skills, parse status, and any graph sync issues after import.",
      "Use batch import when you need to process many CVs for the same role.",
    ],
  },
  {
    title: "Evaluation",
    icon: "analytics",
    bullets: [
      "Run screening from the job workspace after candidates are imported.",
      "Read match score, evidence score, pass or reject decision, and explanation summary.",
      "Inspect rejected candidates separately to see missing evidence or verification problems.",
      "Use the ranking output to identify the strongest shortlist for recruiter review.",
    ],
  },
];

const troubleshootingTips = [
  {
    title: "API status shows Failed",
    detail:
      "The OpenRouter key is invalid or not accepted by the provider. Clear the key, paste a valid key, then save again until Connected appears.",
  },
  {
    title: "JD or CV import fails",
    detail:
      "Use a readable PDF with selectable text. Scanned or image-only files may not parse reliably.",
  },
  {
    title: "Candidates do not appear in ranking",
    detail:
      "Check that they were imported into the correct job workspace and that screening has been executed for that job.",
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="User Manual"
        title="How To Use SkillGraph CV Matcher"
        description="Follow this in-app guide to configure API access, import hiring data, evaluate candidates, and compare shortlist results without leaving the workspace."
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

      <SectionShell title="Workflow Guide">
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
