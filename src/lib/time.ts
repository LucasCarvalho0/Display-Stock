/** Datas ficam em UTC no banco e são exibidas em America/Sao_Paulo (UTC-3, sem horário de verão desde 2019). */
export const TZ = "America/Sao_Paulo";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o });
export const formatDateTime = (d: Date | string) => fmt({ dateStyle: "short", timeStyle: "medium" }).format(new Date(d));
export const formatDate = (d: Date | string) => fmt({ dateStyle: "short" }).format(new Date(d));
export const formatTime = (d: Date | string) => fmt({ timeStyle: "short" }).format(new Date(d));
/** "YYYY-MM-DD" no fuso de São Paulo. */
export function ymd(d: Date | string = new Date()): string {
  const p = fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}
export const startOfDay = (ymdStr: string) => new Date(`${ymdStr}T00:00:00-03:00`);
export const endOfDay = (ymdStr: string) => new Date(`${ymdStr}T23:59:59.999-03:00`);
export const dateOnly = (ymdStr: string) => new Date(`${ymdStr}T00:00:00.000Z`); // coluna @db.Date
