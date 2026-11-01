import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="font-display text-xl text-ink">SignalCheck</p>
          <p className="mt-2 max-w-md text-sm text-muted">
            Risk signals for user-submitted vehicle listings. Not a Carfax substitute. Title and
            ownership are never verified.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs tracking-wide text-muted uppercase">
          <Link href="/check" className="hover:text-accent">
            Check
          </Link>
          <Link href="/checks" className="hover:text-accent">
            My checks
          </Link>
          <Link href="/how-it-works" className="hover:text-accent">
            How it works
          </Link>
          <Link href="/about" className="hover:text-accent">
            About
          </Link>
          <span>History not checked</span>
          <span>Title not verified</span>
        </div>
      </div>
    </footer>
  );
}
