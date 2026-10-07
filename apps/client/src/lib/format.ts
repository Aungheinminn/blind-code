// Compact number for small spaces (chips, badges). Keeps precision below
// 10K so low balances are always exact, abbreviates above:
//   < 10K   →  "1,234"
//   < 1M    →  "12k", "150k"
//   >= 1M   →  "1.2M"
// Negatives (soft-overrun credits) keep their sign.
export const formatCompact = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 10_000) return n.toLocaleString();
  if (abs < 1_000_000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
};
