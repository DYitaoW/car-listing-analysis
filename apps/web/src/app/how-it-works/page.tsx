import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "How it works",
  description: "Walk through SignalCheck intake, analysis, and report pages.",
};

const STEPS = [
  {
    title: "Bring the listing",
    body: "On /check, paste the title, price, description, optional VIN and source URL, then upload the photos buyers actually see.",
  },
  {
    title: "Analysis runs in the background",
    body: "The API stores the listing, inspects photos locally, queries NHTSA when a VIN is present, and optionally calls a vision model.",
  },
  {
    title: "Read the report",
    body: "Completed checks open on /report/[id] with risk score, flags, claim checks, VIN context, and recall notes. Saved work lives under /checks.",
  },
];

export default function HowItWorksPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="How it works"
        title="From marketplace tab to risk report"
        description="A short map of the SignalCheck website flow — intake, analysis, results, and saved checks."
      />
      <ol className="space-y-10">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-t border-[var(--line)] pt-6">
            <p className="font-mono text-xs tracking-[0.18em] text-muted">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-3 font-display text-2xl text-ink md:text-3xl">{step.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
      <Link href="/check" className="btn-primary mt-4 inline-flex w-fit">
        Start a check
      </Link>
    </AppShell>
  );
}
