const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("id-ID");

export const fmtMoney = (v: number | null | undefined) => (v == null ? "—" : brl.format(v));
export const fmtMoneyShort = (v: number | null | undefined) => (v == null ? "—" : brlCompact.format(v));
export const fmtNumber = (v: number | null | undefined) => (v == null ? "—" : num.format(v));
export const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/** "2017-11-24" -> "Jum, 24 Nov 2017" (no timezone shifts). */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[dow]}, ${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
