"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSessao } from "@/components/auth/sessao";
import { BotaoVoltar } from "@/components/ui";
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";
import { VE_ARQUIVOS, VE_CONTRATO, VE_RELATORIOS, VE_VALORES } from "@/lib/fluxo";

const ITENS = [
  { href: "/inicio/", rotulo: "Início" },
  { href: "/nova-solicitacao/", rotulo: "Nova solicitação", papeis: ["solicitante", "admin"] },
  { href: "/solicitacoes/", rotulo: "Solicitações" },
  { href: "/valores/", rotulo: "Valores", papeis: VE_VALORES as string[] },
  { href: "/relatorios/", rotulo: "Relatórios", papeis: VE_RELATORIOS as string[] },
  { href: "/contrato/", rotulo: "Contrato", papeis: VE_CONTRATO as string[] },
  { href: "/arquivos/", rotulo: "Arquivos no Drive", papeis: VE_ARQUIVOS as string[] },
  { href: "/admin/usuarios/", rotulo: "Usuários", papeis: ["admin"] },
  { href: "/ajuda/", rotulo: "Ajuda" },
];

/** Estrutura das páginas internas: menu lateral grafite + conteúdo. */
export function Casca({ titulo, children }: { titulo: string; children: ReactNode }) {
  const s = useSessao();
  const caminho = usePathname();
  const nomePortal = s.clienteId ? CLIENTES[s.clienteId]?.nomePortal : "Portal Propaga";
  const nome = s.usuario?.displayName || s.usuario?.email || "";
  return (
    <div className="grid min-h-screen md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="print:hidden flex flex-col gap-6 bg-ink-900 p-4 text-paper md:sticky md:top-0 md:h-screen md:p-5" aria-label="Menu principal">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/selo-mkt-bmlog.png" alt="mkt B&M Log" width={88} height={88} className="size-[88px] [filter:drop-shadow(0_0_1px_rgba(255,255,255,0.6))]" />
          <span className="mt-2 block text-sm text-[#A9CBD6]">{nomePortal}</span>
        </div>
        <nav className="flex flex-wrap gap-1 md:grid">
          {ITENS.filter((i) => !i.papeis || (s.papel && i.papeis.includes(s.papel))).map((i) => {
            const atual = caminho === i.href || (i.href === "/solicitacoes/" && caminho.startsWith("/solicitacoes/"));
            return <a key={i.href} href={i.href} aria-current={atual ? "page" : undefined}
              className={`rounded px-3 py-2.5 font-medium ${atual ? "bg-marca-500 text-ink-900" : "hover:bg-white/10"}`}>{i.rotulo}</a>;
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="min-w-0"><b className="block truncate text-sm">{nome}</b><span className="text-xs text-[#A9CBD6]">{s.papel ? NOMES_PAPEIS[s.papel] : ""}</span></div>
          <button type="button" onClick={() => s.sair()} className="ml-auto rounded border border-white/20 px-2 py-1 text-xs">Sair</button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8 print:p-0">
        {caminho !== "/inicio/" && caminho !== "/inicio" && <div className="mb-3"><BotaoVoltar /></div>}
        <h1 className="mb-6 text-3xl">{titulo}</h1>
        {children}
      </main>
    </div>
  );
}
