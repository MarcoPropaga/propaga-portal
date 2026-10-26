"use client";
/* Contrato: pontos principais que regem o portal + documento assinado (quando registrado). */
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { brData, Painel } from "@/components/pedido";
import { CLIENTES } from "@/content/clientes";
import { REGRA_REFACAO, VE_CONTRATO } from "@/lib/fluxo";
import { PRAZO_PADRAO_DIAS_UTEIS } from "@/lib/datas";
import { useTxt } from "@/components/tema";

/* Contrato da Mariane (Criativo Propaga): só ela vê esta versão da página (Marco, 15/10/2026). */
function ContratoCriativo() {
  const t = useTxt();
  const pontos: [string, string][] = [
    ["Partes", "Prestação de serviços de criação para a Propaga, nos jobs do Portal MKT {cliente}."],
    ["Como chega o trabalho", "O Marcelo (Atendimento Propaga) envia a solicitação pelo portal, sem valores. Você cria as peças, envia ao Marcelo e acompanha a aprovação, refação ou cancelamento pelo marketing da {cliente}."],
    ["Valores", "Os da sua tabela de valores (Minha tabela), por peça/serviço. Projetos complexos são avaliados individualmente e o valor é informado por você no relatório."],
    ["O que entra no mês", "Cada peça entra no relatório do mês em que foi concluída (arquivo final em 04 Aprovados). Refações são registradas como observação, sem valor extra."],
    ["Relatório e pagamento", "No fim do mês você confere o relatório e envia à Marisa (Financeiro Propaga), que confere e registra o pagamento. Você é avisada por e-mail."],
    ["Sigilo", "Sua tabela e este contrato são vistos só por você e pela administração da Propaga. O marketing e o financeiro da {cliente} e o Atendimento não têm acesso."],
  ];
  return (
    <Casca titulo="Contrato">
      <div className="grid max-w-6xl gap-5">
        <p className="max-w-[75ch] text-gray-600">Contrato de prestação de serviços de criação entre você e a Propaga.</p>
        <span className="w-fit rounded-full bg-aviso-100 px-3 py-1 text-xs font-semibold text-aviso-700">Documento assinado: registro pendente</span>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Painel titulo="Pontos principais">
            <dl className="grid gap-4 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              {pontos.map(([a, b]) => <div key={a} className="contents"><dt className="font-semibold">{a}</dt><dd className="leading-relaxed text-gray-600">{t(b)}</dd></div>)}
            </dl>
          </Painel>
          <div className="grid content-start gap-5">
            <Painel titulo="Documento assinado">
              <p className="rounded bg-aviso-100 px-4 py-3 text-sm text-aviso-700">O PDF assinado será disponibilizado aqui pela Propaga.</p>
            </Painel>
            <Painel titulo="Tabela anexa">
              <p className="text-sm text-gray-600">Sua tabela de valores por peça/serviço.</p>
              <a href="/criativo/tabela/" className="inline-flex min-h-11 w-fit items-center rounded border border-ink-900 bg-white px-4 font-semibold">Ver minha tabela</a>
            </Painel>
          </div>
        </div>
      </div>
    </Casca>
  );
}

function Conteudo() {
  const t = useTxt();
  const s = useSessao();
  if (s.papel === "criativo") return <ContratoCriativo />;
  const c = CLIENTES[s.clienteId ?? Object.keys(CLIENTES)[0]];
  const assinado = !!c.contrato.assinadoEm;
  const testes = !assinado && !!c.contrato.consideradoAssinadoParaTestes;
  const pontos: [string, string][] = [
    ["Valores", "Preço de referência aprovado com o desconto do contrato, arredondado por unidade. O portal mostra só o preço final, subtotais e total."],
    ["Autorização", "Com o contrato assinado, os valores do catálogo já estão aprovados. A produção começa quando a Propaga aceita o pedido e confirma o cronograma. Itens “a cotar” recebem o valor da Propaga, conforme o contrato, nesse momento."],
    ["Inclusões", "Imagens e vídeos gerados pela Propaga estão incluídos. Filmagem, fotografia presencial, impressão, fabricação, montagem, mídia, locução, tradução e licenças específicas são orçadas à parte."],
    ["Prazo", `${PRAZO_PADRAO_DIAS_UTEIS} dias úteis para a 1ª apresentação em serviços simples, contados do aceite do pedido com briefing completo e materiais acessíveis. Pedidos complexos ou urgentes recebem cronograma individual.`],
    ["Refação", `${REGRA_REFACAO} Reúna os pontos de cada versão numa única solicitação. Aprovação vale só quando registrada no portal.`],
    ["Aprovação", "Só a solicitante aprova ou pede ajustes, sempre pelo portal. A peça aprovada entra nos relatórios como concluída."],
    ["Dados e Drive", "Acesso por função, sem links públicos. Senhas nunca vão em briefing, comentário ou e-mail."],
  ];
  return (
    <Casca titulo="Contrato">
      <div className="grid max-w-6xl gap-5">
        <p className="max-w-[75ch] text-gray-600">Contrato de serviços de comunicação por demanda entre a Propaga e a {c.nome}, com as regras de operação deste portal.</p>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${assinado || testes ? "bg-[#E3F2EA] text-[#1E7047]" : "bg-aviso-100 text-aviso-700"}`}>
          {assinado ? `Contrato assinado em ${brData(c.contrato.assinadoEm!)}` : testes ? "Contrato vigente · considerado assinado no período de testes finais" : "Contrato assinado · registro do documento pendente"} · catálogo v{c.catalogoVersao} vigente
        </span>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Painel titulo="Pontos principais">
            <dl className="grid gap-4 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
              {pontos.map(([a, b]) => <div key={a} className="contents"><dt className="font-semibold">{a}</dt><dd className="leading-relaxed text-gray-600">{t(b)}</dd></div>)}
            </dl>
          </Painel>
          <div className="grid content-start gap-5">
            <Painel titulo="Documento assinado">
              <p className="text-sm text-gray-600">A versão assinada fica preservada aqui, sem edição. Alterações geram nova versão.</p>
              {c.contrato.pdfUrl
                ? <a href={c.contrato.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center rounded border border-ink-900 bg-white px-4 font-semibold">Abrir PDF assinado<span className="sr-only"> (abre em nova aba)</span></a>
                : <p className="rounded bg-aviso-100 px-4 py-3 text-sm text-aviso-700">O PDF assinado será disponibilizado aqui pela Propaga.</p>}
            </Painel>
            <Painel titulo="Versões">
              <ol className="grid gap-3 text-sm">
                <li><b>Versão assinada</b><div className="text-gray-600">{assinado ? brData(c.contrato.assinadoEm!) : testes ? "Considerada assinada nos testes finais" : "Data a registrar"} · vigente</div></li>
                <li><b>Minuta v1.0</b><div className="text-gray-600">Propaga · {brData(c.contrato.minuta)} · base da versão assinada</div></li>
              </ol>
            </Painel>
            <Painel titulo="Catálogo anexo">
              <p className="text-sm text-gray-600">Catálogo v{c.catalogoVersao}, com os preços finais de cada serviço.</p>
              <a href="/valores/" className="inline-flex min-h-11 w-fit items-center rounded border border-ink-900 bg-white px-4 font-semibold">Ver valores</a>
            </Painel>
          </div>
        </div>
      </div>
    </Casca>
  );
}

export default function Contrato() {
  return <Protegido papeis={[...VE_CONTRATO, "criativo"]}><Conteudo /></Protegido>;
}
