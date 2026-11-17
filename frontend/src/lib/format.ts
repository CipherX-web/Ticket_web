const lkr = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 });
/** Money is always held as integer minor units (cents); format only at the edge. */
export const formatLkr = (minor: number) => lkr.format(minor / 100);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(iso));
