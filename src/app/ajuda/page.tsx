"use client";
/* Ajuda: dúvidas frequentes e contato do atendimento. */
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { Painel } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import { MAX_RODADAS } from "@/lib/fluxo";
import { PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";

const FAQ: [string, string][] = [
  ["Como faço uma solicitação?", "Em Nova solicitação, preencha os dados, escolha os serviços, informe a pasta do Drive e a data desejada. O que você preenche fica salvo como rascunho até o envio."],
  ["Por que alguns itens aparecem “a cotar”?", "O catálogo não define preço para algumas faixas, como vídeos mais longos ou mais páginas. A Propaga informa o valor, conforme o contrato, ao aceitar o pedido."],
  ["Quando o prazo começa a contar?", `Quando a Propaga aceita o pedido, com briefing completo e materiais acessíveis no Drive. Em serviços simples, a 1ª apresentação sai em até ${PRAZO_PADRAO_DIAS_UTEIS} dias úteis.`],
  ["Quantos ajustes estão incluídos?", `Até ${MAX_RODADAS} refações. A partir da 3ª, se as edições forem diferentes das pedidas antes, é adicionado 30% ao valor da peça. Reúna todos os pontos de uma versão numa única lista ao clicar em “Pedir ajustes”.`],
  ["Preciso de filmagem, fotografia ou impressão. Como peço?", "Descreva em Observações para a Propaga: necessidade, local, quantidade, especificações e data. A Propaga orça à parte antes de contratar."],
  ["Como acompanho meu pedido?", "Em Solicitações, abra o pedido. Você vê a etapa atual, o cronograma, a pasta do Drive e o histórico completo. Quando houver algo para você fazer, o botão aparece no topo."],
  ["Esqueci a senha.", "Na tela de entrada, use “Esqueci minha senha”. O link chega por e-mail e vale por 1 hora."],
  ["Troquei de celular e perdi o aplicativo autenticador.", "Fale com o atendimento da Propaga. Por segurança, a verificação em duas etapas é refeita com confirmação da sua identidade."],
];

function Conteudo() {
  const s = useSessao();
  const c = CLIENTES[s.clienteId ?? Object.keys(CLIENTES)[0]];
  return (
    <Casca titulo="Ajuda">
      <div className="grid max-w-3xl gap-5">
        <p className="text-gray-600">Dúvidas frequentes sobre o portal e o atendimento.</p>
        <div className="divide-y divide-gray-200 rounded border border-gray-200 bg-white px-4 md:px-5">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-3.5">
              <summary className="cursor-pointer font-semibold marker:text-marca-700">{q}</summary>
              <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-gray-600">{a}</p>
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
