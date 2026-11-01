import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ChecksList } from "@/components/ChecksList";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "My checks",
  description: "Review vehicle listing checks you have run with SignalCheck.",
};

export default function ChecksPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Saved work"
        title="My checks"
        description="Open a completed analysis, or start a new listing check. Scores are risk signals — not title or history verification."
        actions={
          <Link href="/check" className="btn-primary">
            New check
          </Link>
        }
      />
      <ChecksList />
    </AppShell>
  );
}
