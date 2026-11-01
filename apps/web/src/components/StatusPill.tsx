import type { ListingStatus } from "@listing-validator/types";
import { statusLabel } from "@/lib/report";

export function StatusPill({ status }: { status: ListingStatus }) {
  const tone =
    status === "completed"
      ? "border-accent/30 bg-accent-soft text-accent-dim"
      : status === "failed"
        ? "border-danger/30 bg-[#fdeceb] text-danger"
        : status === "processing"
          ? "border-warn/30 bg-[#fff6eb] text-warn"
          : "border-[var(--line)] bg-paper text-muted";

  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 font-mono text-[11px] tracking-wide uppercase ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}
