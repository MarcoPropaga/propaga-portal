"use client";
/* Minha tabela — valores da Mariane (só ela e o administrador). */
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { Aviso } from "@/components/ui";
import { VE_TABELA_CRIATIVO } from "@/lib/criativo";
import { moeda, useTabelaCriativo } from "@/lib/usarTabelaCriativo";
import type { Papel } from "@/lib/tipos";

function Conteudo() {
  const { tab, erro } = useTabelaCriativo();
  return (
    <Casca titulo="Minha tabela de valores">
      <div className="grid max-w-5xl gap-5">
        <p className="max-w-[75ch] text-gray-600">Valores unitários dos seus serviços de criação. Só você e a administração da Propaga veem esta tabela. No fim do mês, o seu relatório usa estes valores para cada peça concluída ou cancelada.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {!tab && !erro && <p className="text-gray-600" aria-busy="true">Carregando…</p>}
        {tab && (
          <div className="relative overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-[#EAF3F5] text-left text-xs uppercase tracking-wide text-gray-600">
                <tr><th className="px-3 py-2.5">Material / serviço</th><th className="px-3 py-2.5 text-right">Adaptação</th><th className="px-3 py-2.5 text-right">Nova criação</th><th className="px-3 py-2.5">Observações</th></tr>
              </thead>
              <tbody>
                {tab.itens.map((i) => (
                  <tr key={i.id} className="border-t border-gray-200">
                    <td className="px-3 py-2.5 font-semibold">{i.nome}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{i.sobConsulta ? "—" : moeda(i.adaptacao)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{i.sobConsulta ? "Sob consulta" : moeda(i.nova)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{i.obs ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-gray-600">Valores de referência por peça/serviço. Projetos complexos são avaliados individualmente: o valor é informado por você no relatório do mês. Tabela revisada · versão {tab?.versao ?? "—"}.</p>
      </div>
    </Casca>
  );
}

export default function MinhaTabela() {
  return <Protegido papeis={VE_TABELA_CRIATIVO as Papel[]}><Conteudo /></Protegido>;
}
