import Link from "next/link";
import { DEMO_LISTING, DEMO_LISTING_INPUT } from "@/lib/demoListing";

export function DemoListingPreview() {
  const report = DEMO_LISTING.report!;

  return (
    <section id="demo" className="border-y border-[var(--line)] bg-paper">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:gap-14 md:px-8 md:py-28">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">Demo listing</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink md:text-4xl">
            See a sample risk report before you upload anything.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            This is a fixed example based on a typical marketplace post. It is not a live NHTSA
            lookup and does not analyze your photos.
          </p>
          <dl className="mt-8 space-y-4 border-t border-[var(--line)] pt-6 text-sm">
            <div>
              <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Title</dt>
              <dd className="mt-1 text-ink">{DEMO_LISTING_INPUT.title}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Price</dt>
              <dd className="mt-1 text-ink">${DEMO_LISTING_INPUT.price}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">Description</dt>
              <dd className="mt-1 text-muted">{DEMO_LISTING_INPUT.description}</dd>
            </div>
          </dl>
          <Link href="/check?demo=1" className="btn-primary mt-8 inline-flex">
            Open demo in checker
          </Link>
        </div>

        <div className="border border-panel-border bg-panel p-6 md:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <p className="font-mono text-xs tracking-wider text-muted uppercase">Status</p>
              <p className="mt-1 text-lg capitalize text-ink">completed</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs tracking-wider text-muted uppercase">Risk score</p>
              <p className="font-display text-5xl text-warn">{report.riskScore}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{report.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border border-panel-border bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
              History not checked
            </span>
            <span className="border border-panel-border bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
              Title not verified
            </span>
            <span className="border border-panel-border bg-paper px-2.5 py-1 font-mono text-[11px] text-muted">
              Recalls: {report.recalls.count}
            </span>
          </div>
          <p className="mt-4 text-sm text-ink">
            VIN agrees with the listing text · {report.vinMatch.decoded?.modelYear}{" "}
            {report.vinMatch.decoded?.make} {report.vinMatch.decoded?.model}
          </p>
          <ul className="mt-4 space-y-2">
            {report.flags.map((flag) => (
              <li key={flag.code} className="border border-panel-border px-3 py-2.5 text-sm">
                <span className="font-mono text-xs uppercase text-warn">{flag.severity}</span>
                <p className="text-ink">{flag.message}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">{report.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
