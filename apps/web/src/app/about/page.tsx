import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "About",
  description: "What SignalCheck is — and what it deliberately does not claim.",
};

export default function AboutPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="About"
        title="Risk signals for marketplace listings"
        description="SignalCheck helps buyers notice photo, claim, VIN, and recall issues in the materials a seller already published."
      />
      <div className="grid gap-10 md:grid-cols-2">
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-ink">What we do</h2>
          <p className="text-sm leading-relaxed text-muted md:text-base">
            You paste listing text, upload the seller&apos;s photos, and optionally include a VIN. Our
            API inspects image quality, extracts optimistic claims, compares VIN decode data to the
            ad, and looks up NHTSA recalls for that make/model/year. An optional vision model can
            compare photos to the text.
          </p>
        </section>
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-ink">What we never do</h2>
          <ul className="space-y-3 text-sm text-muted md:text-base">
            <li>Verify title, liens, or ownership</li>
            <li>Pull Carfax / NMVTIS vehicle history</li>
            <li>Certify that a car is safe or authentic</li>
            <li>Scrape private marketplaces without the user bringing the listing</li>
          </ul>
        </section>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-8">
        <Link href="/check" className="btn-primary">
          Check a listing
        </Link>
        <Link href="/how-it-works" className="btn-secondary">
          How it works
        </Link>
      </div>
    </AppShell>
  );
}
