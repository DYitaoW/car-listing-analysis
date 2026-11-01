import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-3 text-base leading-relaxed text-muted md:text-lg">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}
