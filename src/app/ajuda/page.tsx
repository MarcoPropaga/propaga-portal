"use client";
/* Ajuda: dúvidas frequentes e contato do atendimento. */
import { Protegido } from "@/components/auth/protegido";
import { Casca } from "@/components/casca";
import { Painel } from "@/components/pedido";
import { MAX_RODADAS } from "@/lib/fluxo";
import { PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { useTxt } from "@/components/tema";
import { useClienteAtivo } from "@/components/cliente-ativo";

const FAQ: [string, string][] = [
  ["Como faço uma solicitação?", "Em Nova solicitação, preencha os dados, escolha os serviços, informe a pasta do Drive e a data desejada. O que você preenche fica salvo como rascunho até o envio."],
  ["Por que alguns itens aparecem “a cotar”?", "O catálogo não define preço para algumas faixas, como vídeos mais longos ou mais páginas. A Propaga informa o valor, conforme o contrato, ao aceitar o pedido."],
  ["Quando o prazo começa a contar?", `Quando a Propaga aceita o pedido, com briefing completo e materiais acessíveis no Drive. Em serviços simples, a 1ª apresentação sai em até ${PRAZO_PADRAO_DIAS_UTEIS} dias úteis.`],
  ["Como funcionam as aprovações?", "Em Minhas tarefas, abra cada peça e escolha: aprovar, pedir refação (um ajuste por linha). Depois, envie a avaliação do pedido. O relatório é atualizado na hora: aprovada = concluída. A aprovação e a refação seguem direto para o atendimento e o criativo da Propaga, que são avisados. O atendimento revisa a nova versão antes de ela voltar para você."],
  ["Quantos ajustes estão incluídos?", `Até ${MAX_RODADAS} refações. A partir da 3ª, se as edições forem diferentes das pedidas antes, é adicionado 30% ao valor da peça. Liste todos os ajustes da peça de uma vez, um por linha.`],
  ["Não vejo a pré-visualização da peça.", "A pré-visualização vem do Drive compartilhado da {cliente}. Entre no Google, no mesmo navegador, com a conta que tem acesso ao Drive. Se preferir, use “Abrir no Drive”."],
  ["Recebo muitos e-mails?", "Você recebe um e-mail quando algo passa para você e, nos dias úteis às 8h, um resumo do que está pendente, com prazos e atrasos."],
  ["Preciso de filmagem, fotografia ou impressão. Como peço?", "Descreva em Observações para a Propaga: necessidade, local, quantidade, especificações e data. A Propaga orça à parte antes de contratar."],
  ["Onde eu ajo? Onde acompanho?", "Tudo o que depende de você fica em Minhas tarefas, com o número de pendências no menu. Em Solicitações você só consulta: etapa, cronograma, pasta do Drive e a linha do tempo completa."],
  ["Esqueci a senha.", "Na tela de entrada, use “Esqueci minha senha”. O link chega por e-mail e vale por 1 hora."],
  ["Troquei de celular e perdi o aplicativo autenticador.", "Fale com o atendimento da Propaga. Por segurança, a verificação em duas etapas é refeita com confirmação da sua identidade."],
];

function Conteudo() {
  const t = useTxt();
  const { cliente: c } = useClienteAtivo();
  return (
    <Casca titulo="Ajuda">
      <div className="grid max-w-3xl gap-5">
        <p className="text-gray-600">Dúvidas frequentes sobre o portal e o atendimento.</p>
        <div className="divide-y divide-gray-200 rounded border border-gray-200 bg-white px-4 md:px-5">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-3.5">
              <summary className="cursor-pointer font-semibold marker:text-marca-700">{q}</summary>
              <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-gray-600">{t(a)}</p>
            </details>
          ))}
        </div>
        <Painel titulo="Atendimento Propaga">
          <p className="text-sm">{c.atendimento.nome} · <a className="underline" href={`mailto:${c.atendimento.email}`}>{c.atendimento.email}</a></p>
          <p className="text-sm text-gray-600">A Propaga nunca pede sua senha ou o código do autenticador por e-mail, telefone ou mensagem.</p>
        </Painel>
      </div>
    </Casca>
  );
}

export default function Ajuda() {
  return <Protegido><Conteudo /></Protegido>;
}
