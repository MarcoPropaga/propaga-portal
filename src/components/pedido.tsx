/* Peças de interface compartilhadas pelos módulos de pedidos. */
import type { ReactNode } from "react";
import { NOME_STATUS } from "@/lib/fluxo";
import type { Status } from "@/lib/tipos";

export const brData = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const brDataHora = (v: unknown) => {
  const d = v && typeof v === "object" && "toDate" in v ? (v as { toDate: () => Date }).toDate() : v ? new Date(String(v)) : null;
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
};
export const moeda = (v: number | null | undefined) =>
  v == null ? "A cotar" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COR: Partial<Record<Status, string>> = {
  enviada: "bg-orange-100 text-orange-700",
  producao: "bg-[#E8EEF7] text-[#24456B]",
  apresentacao: "bg-[#FFF1D6] text-[#7A4B00]",
  aprovada: "bg-[#E3F2EA] text-[#1E7047]",
  entregue: "bg-[#E3F2EA] text-[#1E7047]",
  faturada: "bg-[#E3F2EA] text-[#1E7047]",
  paga: "bg-[#E3F2EA] text-[#1E7047]",
  cancelada: "bg-gray-200 text-gray-600",
};

export function SeloStatus({ status }: { status: Status }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR[status] ?? "bg-gray-200"}`}>{NOME_STATUS[status] ?? status}</span>;
}

export function Painel({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid min-w-0 content-start gap-3 rounded border border-gray-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2"><h2 className="mr-auto text-lg">{titulo}</h2>{extra}</div>
      {children}
    </section>
  );
}

export interface PedidoDoc {
  protocolo: string; clienteId: string; titulo: string; status: Status; solicitanteUid: string; solicitanteNome: string;
  unidade: string; email: string; objetivo: string; publico: string;
  itens: { cod: string; variante: number; qtd: number; opcao?: string; canal?: string; audio?: string; obs?: string; nome: string; varianteRotulo: string; sobOrcamento: boolean }[];
  drive: { link: string; conferido: boolean; verificado: boolean }; obs: string;
  prazo: { desejada: string; urgente: boolean; inicio?: string; primeira?: string; final?: string; entrega?: string };
  rodadas: number; versao: number; catalogoVersao: string; recebidoPeloCliente?: boolean;
  criadoEm: unknown; atualizadoEm: unknown;
}
