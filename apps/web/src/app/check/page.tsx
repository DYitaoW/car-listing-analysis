import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Checker } from "./Checker";

export const metadata: Metadata = {
  title: "Check a listing",
  description: "Upload vehicle listing photos and seller copy to get SignalCheck risk signals.",
};

export default function CheckPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-[var(--line)] bg-paper/80 backdrop-blur-sm">
        <SiteHeader />
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 py-10 md:px-8 md:py-14">
        <header className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Listing checker</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            Analyze a marketplace listing
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted md:text-lg">
            Submit the seller&apos;s photos and copy. SignalCheck returns risk signals for photo
            quality, claims, VIN alignment, and recalls.
          </p>
        </header>
        <Checker />
      </main>
      <SiteFooter />
    </div>
  );
}
