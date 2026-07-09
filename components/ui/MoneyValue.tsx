import { formatUSDCx } from "@/lib/format";

interface MoneyValueProps {
  amount: number;
  /** Show +/- sign and semantic color (used for net positions). */
  signed?: boolean;
  /** Append the USDCx unit label. */
  showUnit?: boolean;
  className?: string;
}

/**
 * Every monetary figure in the product renders through this component:
 * mono font, tabular numerals, optional signed coloring for net positions
 * (receivers green, payers amber).
 */
export default function MoneyValue({
  amount,
  signed = false,
  showUnit = true,
  className = "",
}: MoneyValueProps) {
  const color = !signed
    ? ""
    : amount > 0
      ? "text-settled"
      : amount < 0
        ? "text-pending"
        : "text-frost/60";
  const sign = signed && amount > 0 ? "+" : "";

  return (
    <span className={`figures whitespace-nowrap ${color} ${className}`}>
      {sign}
      {formatUSDCx(amount)}
      {showUnit && (
        <span className="ml-1 text-[0.72em] opacity-60">USDCx</span>
      )}
    </span>
  );
}
