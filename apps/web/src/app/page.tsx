import Link from "next/link";
import { HeroVisual } from "@/components/HeroVisual";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function LandingPage() {
  return (
    <>
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <HeroVisual />
        <SiteHeader tone="on-hero" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5.5rem)] w-full max-w-6xl flex-col justify-end px-5 pb-16 pt-10 md:px-8 md:pb-24">
          <div className="max-w-2xl">
            <p className="rise font-display text-5xl leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.25rem]">
              SignalCheck
            </p>
            <h1 className="rise rise-delay-1 mt-5 max-w-xl text-2xl font-medium leading-snug text-white/95 md:text-3xl">
              Check a vehicle listing before you trust it.
            </h1>
            <p className="rise rise-delay-2 mt-4 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
              Paste the seller&apos;s copy, upload their photos, and get risk signals — not a Carfax,
              not a certified inspection.
            </p>
            <div className="rise rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/check" className="btn-primary bg-white text-ink hover:bg-accent-soft hover:text-accent-dim">
                Check a listing
              </Link>
              <Link
                href="/#how-it-works"
                className="btn-secondary border-white/30 bg-white/10 text-white hover:border-white/55 hover:bg-white/16"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">How it works</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight text-ink md:text-4xl">
          Three steps from marketplace tab to a risk report.
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              step: "01",
              title: "Paste the listing",
              body: "Copy the title, asking price, and seller description. Add the VIN when the post includes one.",
            },
            {
              step: "02",
              title: "Upload their photos",
              body: "Use the photos from the listing — the ones buyers actually see — not studio shots from another ad.",
            },
            {
              step: "03",
              title: "Read the signals",
              body: "Get a risk score, claim checks, photo findings, VIN alignment, and NHTSA recall context.",
            },
          ].map((item) => (
            <li key={item.step} className="border-t border-[var(--line)] pt-6">
              <p className="font-mono text-xs tracking-[0.18em] text-muted">{item.step}</p>
              <h3 className="mt-3 text-xl font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted md:text-[0.95rem]">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[var(--line)] bg-paper">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8 md:py-28">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">What we check</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink md:text-4xl">
              Signals buyers miss when skimming a marketplace post.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              SignalCheck inspects the materials the seller already published. It does not scrape
              listings or claim the vehicle is authentic.
            </p>
          </div>
          <ul className="space-y-5">
            {[
              ["Photo quality & consistency", "Low-res placeholders, duplicates, and odd timestamps."],
              ["Seller claims", "“No rust,” “like new,” and similar lines held against the photos."],
              ["VIN & recalls", "NHTSA decode vs listing text, plus open recall campaigns."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-[2px] bg-accent" aria-hidden />
                <div>
                  <p className="font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="limits" className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Honest limits</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight text-ink md:text-4xl">
          Built to warn — never to certify.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          Every report discloses that vehicle history and title status were not checked. Use
          SignalCheck alongside a mechanic, a title search, and your own judgment.
        </p>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">
          <span>History not checked</span>
          <span>Title not verified</span>
          <span>User-assisted uploads only</span>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-ink text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-8 md:py-20">
          <div>
            <h2 className="font-display text-3xl tracking-tight md:text-4xl">Ready to check a listing?</h2>
            <p className="mt-3 max-w-lg text-white/70">
              Upload photos and seller copy. A risk report appears when analysis finishes.
            </p>
          </div>
          <Link href="/check" className="btn-primary bg-white text-ink hover:bg-accent-soft">
            Open the checker
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
