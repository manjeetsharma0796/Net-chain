import {
  CheckCircle2,
  Clock3,
  XCircle,
  Lock,
  Bot,
  CircleDot,
} from "lucide-react";

export type PillStatus =
  | "settled"
  | "pending"
  | "rejected"
  | "private"
  | "agent"
  | "netted"
  | "open";

const STYLES: Record<
  PillStatus,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  settled: {
    label: "Settled",
    classes: "text-settled border-settled/40 bg-settled/10",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    classes: "text-pending border-pending/40 bg-pending/10",
    Icon: Clock3,
  },
  rejected: {
    label: "Rejected",
    classes: "text-rejected border-rejected/40 bg-rejected/10",
    Icon: XCircle,
  },
  private: {
    label: "Private",
    classes: "text-privacy border-privacy/40 bg-privacy/10",
    Icon: Lock,
  },
  agent: {
    label: "Agent",
    classes: "text-privacy border-privacy/40 bg-privacy/10",
    Icon: Bot,
  },
  netted: {
    label: "Netted",
    classes: "text-frost border-frost/30 bg-frost/10",
    Icon: CircleDot,
  },
  open: {
    label: "Open",
    classes: "text-frost/80 border-frost/25 bg-frost/5",
    Icon: CircleDot,
  },
};

/**
 * Semantic status chip. Icon + label so state is never conveyed by
 * color alone.
 */
export default function StatusPill({
  status,
  label,
  className = "",
}: {
  status: PillStatus;
  label?: string;
  className?: string;
}) {
  const { label: fallback, classes, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${classes} ${className}`}
    >
      <Icon size={12} aria-hidden="true" />
      {label ?? fallback}
    </span>
  );
}
