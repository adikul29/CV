export function formatCurrency(value: number | null | undefined, currency: string = "INR"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  return symbol + Math.round(value).toLocaleString("en-IN");
}

export function formatCurrencyPrecise(value: number | null | undefined, currency: string = "INR"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  return (
    symbol +
    value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value >= 10000000) return (value / 10000000).toFixed(2) + "Cr";
  if (value >= 100000) return (value / 100000).toFixed(2) + "L";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return Math.round(value).toString();
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits) + "%";
}

export function formatRoas(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2) + "x";
}
