import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ReportPageClient } from "./ReportPageClient";

export const metadata: Metadata = {
  title: "Check results",
  description: "SignalCheck risk report for a vehicle listing analysis.",
};

async function ReportLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportPageClient id={id} />;
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Results"
        title="Listing risk report"
        description="Flags, claim checks, VIN context, and recalls for this submission. History and title were not checked."
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading report…</p>}>
        <ReportLoader params={params} />
      </Suspense>
    </AppShell>
  );
}
