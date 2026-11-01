import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function AppShell({
  children,
  tone = "light",
  wide = false,
}: {
  children: ReactNode;
  tone?: "light" | "on-hero";
  wide?: boolean;
}) {
  if (tone === "on-hero") {
    return (
      <>
        <SiteHeader tone="on-hero" />
        {children}
        <SiteFooter />
      </>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-[var(--line)] bg-paper/80 backdrop-blur-sm">
        <SiteHeader />
      </div>
      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-10 px-5 py-10 md:px-8 md:py-14 ${
          wide ? "max-w-6xl" : "max-w-6xl"
        }`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
