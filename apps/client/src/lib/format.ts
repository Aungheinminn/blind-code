// Compact number for small spaces (chips, badges). Keeps precision below
// 10K so low balances are always exact; one decimal in the 10K–100K band
// so small burns are still visible on the chip; whole thousands above.
//   < 10K   →  "1,234"
//   < 100K  →  "12.3k"
//   < 1M    →  "150k"
//   >= 1M   →  "1.2M"
// Trailing ".0" is dropped (Math.round over *10 handles it).
// Negatives (soft-overrun credits) keep their sign.
export const formatCompact = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 10_000) return n.toLocaleString();
  if (abs < 100_000) {
    const v = Math.round((abs / 1000) * 10) / 10;
    return `${sign}${v}k`;
  }
  if (abs < 1_000_000) return `${sign}${Math.round(abs / 1000)}k`;
  const m = Math.round(abs / 100_000) / 10;
  return `${sign}${m}M`;
};
