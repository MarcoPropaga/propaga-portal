/* Teste de 48 h do prospect, lado do admin: checklist, "Iniciar teste" (entrega o acesso) e decisão (aceitar ou encerrar).
   Regras do teste em src/lib/avaliacao.ts. Só o administrador chama estas ações (fila tipo "avaliacao"). */
import { catalogoVigente } from "@/content/catalogos";
import { CLIENTES, type Cliente } from "@/content/clientes";
import { catalogoPublico } from "@/lib/precos";
import { expiraEmDe, faseAvaliacao, ITENS_PRONTO, type EstadoAvaliacao, type ItemPronto, type ItemProntoId } from "@/lib/avaliacao";
import { validarMarca } from "@/lib/tema";
import { emailConvite, MARCA_PROPAGA } from "./emails";
import type { Firestore } from "./firestore";
import { Identidade } from "./identidade";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { lerConfig } from "./servidor";

interface Usuario { uid: string; nome: string; papel: string; email: string }
type Pessoa = { uid: string; nome: string; email: string; papel: string; clienteId?: string | null; clientes?: string[]; status?: string };

const pessoas = (fs: Firestore): Pessoa[] => fs.listar("usuarios").map((d) => ({ uid: d.caminho.split("/").pop()!, ...(d.dados as Omit<Pessoa, "uid">) }));
const caminhoManual = (id: string) => `interno/avaliacoes/${id}`;
const temPendente = (xs: string[]) => xs.some((x) => x.includes("[A CONFIRMAR]"));

/** Os 7 itens do checklist do cliente, com o que o servidor confere sozinho e o que o admin marcou. */
export function prontidao(fs: Firestore, c: Cliente): ItemPronto[] {
  const manual = (fs.ler(caminhoManual(c.id))?.dados as { manual?: Record<string, boolean> } | undefined)?.manual ?? {};
  const gente = pessoas(fs).filter((x) => x.status !== "desativado");
  const vinculado = (papel: string) => gente.some((x) => x.papel === papel && (x.clientes ?? []).includes(c.id));
  const auto: Record<string, boolean> = {
    marca: validarMarca(c.marca).length === 0,
    configuracao: !temPendente([...c.unidades, ...c.publicos.map((p) => p.valor), ...c.canaisVideo]),
    equipe: vinculado("atendimento") && vinculado("criativo"),
    contato: gente.some((x) => x.clienteId === c.id && !!x.email),
  };
  return ITENS_PRONTO.map((i) => ({ ...i, ok: i.auto ? !!auto[i.id] : !!manual[i.id] }));
}

/** Convida os usuários pré-cadastrados (status "preparado"): é a entrega do acesso, no Iniciar teste. */
function entregarAcesso(p: Plataforma, fs: Firestore, clienteId: string, por: Usuario): number {
  const cfg = lerConfig(p), id = new Identidade(p, cfg.projeto), c = CLIENTES[clienteId];
  let n = 0;
  for (const x of pessoas(fs).filter((y) => y.clienteId === clienteId && y.status === "preparado")) {
    const oob = id.codigoDefinirSenha(x.email);
    const msg = emailConvite({ nome: x.nome.split(" ")[0], link: `${cfg.portalUrl}/primeiro-acesso/?oobCode=${encodeURIComponent(oob)}`, cliente: c.nomePortal, convidadoPor: por.nome, marca: c.marca ?? MARCA_PROPAGA });
    p.enviarEmail({ para: x.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente });
    fs.gravar([{ caminho: `usuarios/${x.uid}`, mesclar: true, dados: { status: "convidado", convidadoEm: p.agora(), convidadoPor: por.uid } }]);
    n++;
  }
  return n;
}

export function executarAvaliacao(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  if (u.papel !== "admin") throw new ErroUsuario("Só o administrador cuida do teste de avaliação.");
  const d = (bruto ?? {}) as { acao?: string; clienteId?: string; item?: string; ok?: boolean; decisao?: string };
  const c = d.clienteId ? CLIENTES[d.clienteId] : undefined;
  if (!c?.avaliacao) throw new ErroUsuario("Este cliente não está em teste de avaliação.");
  const agora = p.agora();
  const caminhoEstado = `clientes/${c.id}/avaliacao/estado`;
  const est = fs.ler(caminhoEstado);
  const estado = (est?.dados ?? null) as EstadoAvaliacao | null;
  const resumo = () => ({
    fase: faseAvaliacao(c.avaliacao, estado), itens: prontidao(fs, c), estado,
    pedidos: fs.listar(`clientes/${c.id}/solicitacoes`).filter((x) => (x.dados as { avaliacao?: boolean }).avaliacao).length,
    preparados: pessoas(fs).filter((x) => x.clienteId === c.id && x.status === "preparado").length,
  });

  switch (d.acao) {
    case "estado": return resumo();
    case "marcar": {
      const item = ITENS_PRONTO.find((i) => i.id === d.item);
      if (!item || item.auto) throw new ErroUsuario("Este item é conferido pelo portal; não dá para marcar à mão.");
      const atual = fs.ler(caminhoManual(c.id));
      const manual = { ...((atual?.dados as { manual?: Record<string, boolean> } | undefined)?.manual ?? {}), [item.id as ItemProntoId]: d.ok === true };
      fs.gravar([{ caminho: caminhoManual(c.id), dados: { manual, atualizadoEm: agora, por: u.nome } }]);
      return resumo();
    }
    case "iniciar": {
      if (estado) throw new ErroUsuario("O teste já foi iniciado.");
      const faltam = prontidao(fs, c).filter((i) => !i.ok).map((i) => i.rotulo);
      if (faltam.length) throw new ErroUsuario(`Ainda falta: ${faltam.join(", ")}.`);
      fs.gravar([{ caminho: caminhoEstado, seNaoExiste: true, dados: { iniciadoEm: agora.toISOString(), expiraEm: expiraEmDe(agora, c.avaliacao.horas).toISOString(), iniciadoPor: u.nome } }]);
      const entregues = entregarAcesso(p, fs, c.id, u);
      return { entregues, expiraEm: expiraEmDe(agora, c.avaliacao.horas).toISOString() };
    }
    case "decidir": {
      if (!est || !estado) throw new ErroUsuario("O teste ainda não foi iniciado.");
      if (estado.decisao) throw new ErroUsuario("O teste já tem decisão.");
      if (d.decisao !== "aceita" && d.decisao !== "recusada") throw new ErroUsuario("Escolha aceitar ou encerrar.");
      fs.gravar([{ caminho: caminhoEstado, mesclar: true, seAtualizadoEm: est.atualizadoEm, dados: { decisao: d.decisao, decididoEm: agora.toISOString(), decididoPor: u.nome } }]);
      // Aceite: o cliente passa a ver o catálogo completo, com preços (o desconto e o Bônus 15% são do passo 5).
      if (d.decisao === "aceita") {
        const cat = catalogoVigente(c.id);
        fs.gravar([{ caminho: `clientes/${c.id}/catalogo/${cat.versao}`, dados: { ...catalogoPublico(cat), publicadoEm: agora } as unknown as Record<string, unknown> }]);
      }
      return { decisao: d.decisao };
    }
    default: throw new ErroUsuario("Ação inválida.");
  }
}
