import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Checker } from "./Checker";

export const metadata: Metadata = {
  title: "Check a listing",
  description: "Upload vehicle listing photos and seller copy to get SignalCheck risk signals.",
};

export default function CheckPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Listing checker"
        title="Add a vehicle listing"
        description="Paste seller copy, drop the marketplace photos, and run analysis. Completed checks open on a dedicated results page."
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading checker…</p>}>
        <Checker />
      </Suspense>
    </AppShell>
  );
}
