"use client";
import { Protegido } from "@/components/auth/protegido";
import { useSessao } from "@/components/auth/sessao";
import { Casca } from "@/components/casca";
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";

const ATALHOS: { href: string; rotulo: string; texto: string; papeis?: string[] }[] = [
  { href: "/solicitacoes/", rotulo: "Solicitações", texto: "Acompanhe etapas, versões e entregas." },
  { href: "/valores/", rotulo: "Valores", texto: "Preços finais do catálogo vigente." },
  { href: "/relatorios/", rotulo: "Relatórios", texto: "Totais por período, unidade e etapa.", papeis: ["financeiro_cliente", "atendimento", "financeiro_propaga", "admin"] },
  { href: "/contrato/", rotulo: "Contrato", texto: "Regras do contrato e documento assinado." },
  { href: "/arquivos/", rotulo: "Arquivos no Drive", texto: "Pastas de cada pedido." },
  { href: "/ajuda/", rotulo: "Ajuda", texto: "Dúvidas frequentes e contato." },
];

function Conteudo() {
  const s = useSessao();
  const nome = (s.usuario?.displayName || "").split(" ")[0];
  const podeSolicitar = s.papel === "solicitante" || s.papel === "admin";
  return (
    <Casca titulo={nome ? `Olá, ${nome}.` : "Olá."}>
      <div className="grid max-w-3xl gap-6">
        <section className="grid gap-2 rounded border border-gray-200 bg-white p-5">
          <h2 className="text-lg">Seu acesso</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-gray-600">Perfil</dt><dd>{s.papel ? NOMES_PAPEIS[s.papel] : "—"}</dd>
            <dt className="text-gray-600">Empresa</dt><dd>{s.propaga ? "Propaga" : (s.clienteId && CLIENTES[s.clienteId]?.nome) || "—"}</dd>
            <dt className="text-gray-600">Segurança</dt><dd className="text-[#1E7047]">Verificação em duas etapas ativa</dd>
          </dl>
        </section>
        {podeSolicitar && (
          <section className="grid gap-3 rounded border border-gray-200 bg-white p-5">
            <h2 className="text-lg">Precisa de uma peça ou campanha?</h2>
            <p className="text-sm text-gray-600">Escolha os serviços do catálogo, organize o briefing e envie para a Propaga.</p>
            <a href="/nova-solicitacao/" className="inline-flex min-h-11 w-fit items-center rounded bg-marca-500 px-5 font-semibold text-ink-900 hover:brightness-105">Nova solicitação</a>
          </section>
        )}
        <nav aria-label="Atalhos" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ATALHOS.filter((x) => !x.papeis || (s.papel && x.papeis.includes(s.papel))).map((x) => (
            <a key={x.href} href={x.href} className="grid gap-0.5 rounded border border-gray-200 bg-white px-4 py-3 hover:border-ink-900">
              <b>{x.rotulo}</b><span className="text-sm text-gray-600">{x.texto}</span>
            </a>
          ))}
        </nav>
      </div>
    </Casca>
  );
}

export default function Inicio() {
  return <Protegido><Conteudo /></Protegido>;
}
