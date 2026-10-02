/* Prazos em dias úteis (America/Sao_Paulo). Feriados nacionais; feriados locais por acordo. */
export const FERIADOS_NACIONAIS = [
  "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25",
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21", "2027-05-01", "2027-05-27",
];

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** Soma n dias úteis a uma data AAAA-MM-DD e devolve AAAA-MM-DD. */
export function somarDiasUteis(inicio: string, n: number, feriados = FERIADOS_NACIONAIS): string {
  const d = new Date(inicio + "T12:00:00Z");
  let c = 0;
  while (c < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6 && !feriados.includes(iso(d))) c++;
  }
  return iso(d);
}

/** Data de hoje no fuso de São Paulo, AAAA-MM-DD. */
export function hojeSP(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export const PRAZO_PADRAO_DIAS_UTEIS = 5;
