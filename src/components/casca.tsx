"use client";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClienteAtivo } from "@/components/cliente-ativo";
import { useSessao } from "@/components/auth/sessao";
import { BotaoVoltar } from "@/components/ui";
import { NOMES_PAPEIS } from "@/content/clientes";
import { VE_NOVA_SOLICITACAO, VE_ARQUIVOS, VE_CONTRATO, VE_RELATORIOS, VE_TAREFAS, VE_VALORES } from "@/lib/fluxo";
import { contarPendencias } from "@/lib/pecas";
import { aplicarMarca } from "@/lib/tema";
import { areaDe } from "@/lib/area";
import { useMarcaExibida } from "@/components/tema";
import { useCalendarios, usePedidos } from "@/lib/usarFila";
import { contarPendenciasCal } from "@/lib/publicacao";

/* Menu da área "Portal Propaga" (só admin): antes de entrar em qualquer cliente. */
const ITENS_PROPAGA = [
  { href: "/propaga/", rotulo: "Início" },
  { href: "/admin/prospeccao/", rotulo: "Prospecção" },
  { href: "/admin/usuarios/", rotulo: "Equipe" },
  { href: "/criativo/pagamentos/", rotulo: "Pagamento dos criativos" },
  { href: "/criativo/visao/", rotulo: "Visão do criativo" },
  { href: "/criativo/tabela/", rotulo: "Tabela dos criativos" },
  { href: "/admin/rodada-de-teste/", rotulo: "Arquivar rodada de testes" },
];

const ITENS = [
  { href: "/propaga/", rotulo: "← Portal Propaga", papeis: ["admin"] },
  { href: "/inicio/", rotulo: "Início", fora: ["midia_social"] },
  { href: "/nova-solicitacao/", rotulo: "Nova solicitação", papeis: VE_NOVA_SOLICITACAO as string[] },
  { href: "/solicitacoes/", rotulo: "Solicitações" },
  { href: "/aprovacoes/", rotulo: "Minhas tarefas", papeis: VE_TAREFAS as string[] },
  { href: "/empresa/", rotulo: "Empresa", papeis: ["solicitante", "atendimento", "admin"], soTeste: true },
  { href: "/valores/", rotulo: "Jobs Propaga", papeis: VE_VALORES as string[] },
  { href: "/relatorios/", rotulo: "Relatórios", papeis: VE_RELATORIOS as string[] },
  { href: "/criativo/relatorio/", rotulo: "Meu relatório", papeis: ["criativo"] },
  { href: "/criativo/tabela/", rotulo: "Minha tabela", papeis: ["criativo"] },
  { href: "/criativo/pagamentos/", rotulo: "Pagamento dos criativos", papeis: ["financeiro_propaga"] },
  { href: "/contrato/", rotulo: "Contrato", papeis: [...VE_CONTRATO, "criativo"] as string[] },
  { href: "/arquivos/", rotulo: "Arquivos no Drive", papeis: VE_ARQUIVOS as string[] },
  { href: "/ajuda/", rotulo: "Ajuda", fora: ["midia_social"] },
];

/** Estrutura das páginas internas: menu lateral grafite + conteúdo. */
export function Casca({ titulo, children }: { titulo: string; children: ReactNode }) {
  const s = useSessao();
  const caminho = usePathname();
  const router = useRouter();
  const ativo = useClienteAtivo();
  const area = areaDe(s.papel, caminho);
  const propaga = area === "propaga";
  const marca = useMarcaExibida();
  const nomePortal = marca.rotuloPortal;
  const veAprov = !!s.papel && (VE_TAREFAS as string[]).includes(s.papel);
  const { lista } = usePedidos(veAprov);
  const cals = useCalendarios(veAprov);
  const pend = contarPendencias(s.papel, lista ?? []) + contarPendenciasCal(s.papel, cals, lista ?? []);
  const nome = s.usuario?.displayName || s.usuario?.email || "";
  return (
    <div className="grid min-h-screen md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="print:hidden flex flex-col gap-6 bg-ink-900 p-4 text-paper md:sticky md:top-0 md:h-screen md:overflow-y-auto md:p-5" aria-label="Menu principal">
        <div>
          {marca.selo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={marca.selo} alt={marca.seloAlt} width={88} height={88} className="size-[88px] [filter:drop-shadow(0_0_1px_rgba(255,255,255,0.6))]" />
            : <b className="block font-display text-3xl font-semibold tracking-tight text-white">Propaga<span className="text-marca-500">.</span></b>}
          <span className="mt-2 block text-sm text-[#A9CBD6]">{nomePortal}</span>
          {!propaga && ativo.opcoes.length > 1 && (
            <div className="mt-3 grid gap-1">
              <label htmlFor="cliente-ativo" className="text-xs text-[#A9CBD6]">Cliente em atendimento</label>
              <select id="cliente-ativo" value={ativo.clienteId}
                onChange={(e) => { ativo.escolher(e.target.value); router.push(s.papel === "admin" ? `/inicio/?cliente=${e.target.value}` : "/inicio/"); }}
                className="min-h-10 w-full rounded border border-white/30 bg-white/10 px-2 text-sm text-paper">
                {ativo.opcoes.map((c) => <option key={c.id} value={c.id} className="text-ink-900">{c.nome}</option>)}
              </select>
            </div>
          )}
        </div>
        <nav className="flex flex-wrap gap-1 md:grid">
          {(propaga ? ITENS_PROPAGA : ITENS).filter((i) => { const x = i as { fora?: string[]; soTeste?: boolean; papeis?: string[] }; return !x.fora?.includes(s.papel ?? "") && (!x.soTeste || !!ativo.cliente.avaliacao) && (!x.papeis || (!!s.papel && x.papeis.includes(s.papel))); }).map((i) => {
            const atual = caminho === i.href || (i.href === "/solicitacoes/" && caminho.startsWith("/solicitacoes/"));
            const destino = i.href === "/inicio/" && s.papel === "admin" ? `/inicio/?cliente=${ativo.clienteId}` : i.href;
            return <a key={i.href} href={destino} aria-current={atual ? "page" : undefined}
              className={`flex items-center gap-2 rounded px-3 py-2.5 font-medium ${atual ? "bg-marca-500 text-on-marca" : "hover:bg-white/10"}`}>{i.rotulo}
              {i.href === "/aprovacoes/" && pend > 0 && <span className="ml-auto inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-alerta-700 px-1.5 text-xs font-semibold tabular-nums text-white" aria-label={`${pend} pendentes`}>{pend}</span>}</a>;
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0"><b className="block truncate text-sm">{nome}</b><span className="text-xs text-[#A9CBD6]">{s.papel ? aplicarMarca(NOMES_PAPEIS[s.papel], marca) : ""}</span></div>
          <button type="button" onClick={() => s.sair()} className="ml-auto rounded border border-white/20 px-2 py-1 text-xs">Sair</button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8 print:p-0">
        {caminho !== "/inicio/" && caminho !== "/inicio" && caminho !== "/propaga/" && caminho !== "/propaga" && <div className="mb-3"><BotaoVoltar /></div>}
        <h1 className="mb-6 text-3xl">{titulo}</h1>
        {children}
      </main>
    </div>
  );
}
