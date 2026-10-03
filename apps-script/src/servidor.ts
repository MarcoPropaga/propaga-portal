/* Servidor do Portal Propaga (Google Apps Script, conta da Propaga).
   Únicas responsabilidades com credencial de administrador:
   - configurar o login (TOTP, política de senha) e os dados iniciais;
   - convidar usuários (criar conta, definir perfil, enviar e-mail);
   - processar a /fila de ações enviadas pelo navegador, validando tudo de novo aqui. */
import { CLIENTES, NOMES_PAPEIS } from "@/content/clientes";
import { catalogoPublico } from "@/lib/precos";
import { conviteSchema, PAPEIS_PROPAGA, type ConviteInput } from "@/lib/schemas";
import { emailConvite } from "./emails";
import { Firestore, type Doc } from "./firestore";
import { Identidade } from "./identidade";
import { ErroUsuario, type Plataforma } from "./plataforma";

export interface Config { projeto: string; portalUrl: string; remetente: string }

export function lerConfig(p: Plataforma): Config {
  const projeto = p.propriedade("PROJETO_ID") || "propaga-portal";
  const portalUrl = (p.propriedade("PORTAL_URL") || `https://${projeto}.web.app`).replace(/\/$/, "");
  return { projeto, portalUrl, remetente: p.propriedade("REMETENTE_NOME") || "Portal Propaga" };
}

/** Executar uma vez: segurança do login + cadastro dos clientes e catálogos. */
export function configurarProjeto(p: Plataforma) {
  const cfg = lerConfig(p);
  new Identidade(p, cfg.projeto).configurarSeguranca();
  const fs = new Firestore(p, cfg.projeto);
  const agora = p.agora();
  const ops = Object.values(CLIENTES).flatMap((c) => [
    { caminho: `clientes/${c.id}`, dados: { nome: c.nome, nomePortal: c.nomePortal, unidades: c.unidades, publicos: c.publicos, catalogoVigente: c.catalogo.versao, atualizadoEm: agora } },
    { caminho: `clientes/${c.id}/catalogo/${c.catalogo.versao}`, dados: { ...catalogoPublico(c.catalogo), publicadoEm: agora } as unknown as Record<string, unknown> },
    { caminho: `interno/catalogos/versoes/${c.id}-${c.catalogo.versao}`, dados: { ...c.catalogo, publicadoEm: agora } as unknown as Record<string, unknown> },
  ]);
  fs.gravar(ops);
  p.log(`Projeto ${cfg.projeto} configurado: TOTP, política de senha e ${Object.keys(CLIENTES).length} cliente(s).`);
}

const ehPropaga = (papel: string) => (PAPEIS_PROPAGA as readonly string[]).includes(papel);

/** Cria (ou reaproveita) a conta, define o perfil e envia o convite. */
export function convidar(p: Plataforma, dadosBrutos: unknown, convidadoPor: { uid: string; nome: string }) {
  const r = conviteSchema.safeParse(dadosBrutos);
  if (!r.success) throw new ErroUsuario(r.error.issues[0]?.message || "Dados do convite inválidos.");
  const d: ConviteInput = r.data;
  const propaga = ehPropaga(d.papel);
  const clienteId = propaga ? null : d.clienteId!;
  if (clienteId && !CLIENTES[clienteId]) throw new ErroUsuario("Cliente não encontrado.");

  const cfg = lerConfig(p);
  const id = new Identidade(p, cfg.projeto);
  const existente = id.buscarPorEmail(d.email);
  const uid = existente ? existente.localId : id.criar(d.email, d.nome);
  id.definirClaims(uid, propaga ? { papel: d.papel, propaga: true } : { papel: d.papel, clienteId });

  const oob = id.codigoDefinirSenha(d.email);
  const link = `${cfg.portalUrl}/primeiro-acesso/?oobCode=${encodeURIComponent(oob)}`;
  const nomePortal = clienteId ? CLIENTES[clienteId].nomePortal : "Portal Propaga";
  const msg = emailConvite({ nome: d.nome.split(" ")[0], link, cliente: nomePortal, convidadoPor: convidadoPor.nome });
  p.enviarEmail({ para: d.email, assunto: msg.assunto, html: msg.html, texto: msg.texto, nomeRemetente: cfg.remetente });

  new Firestore(p, cfg.projeto).gravar([{
    caminho: `usuarios/${uid}`, mesclar: true,
    dados: {
      nome: d.nome, email: d.email, papel: d.papel, perfil: NOMES_PAPEIS[d.papel], clienteId, propaga,
      status: "convidado", convidadoEm: p.agora(), convidadoPor: convidadoPor.uid,
    },
  }]);
  return { uid, novo: !existente };
}

/** Primeiro administrador (Marco). Executar uma vez, depois de configurarProjeto. */
export function criarAdministrador(p: Plataforma) {
  const email = p.propriedade("ADMIN_EMAIL");
  const nome = p.propriedade("ADMIN_NOME") || "Administrador";
  if (!email) throw new Error("Defina a propriedade ADMIN_EMAIL nas configurações do script.");
  return convidar(p, { nome, email, papel: "admin" }, { uid: "sistema", nome: "Portal Propaga" });
}

/** Processa pedidos pendentes da fila. Seguro para rodar em paralelo: cada item é "travado" por versão. */
export function processarFila(p: Plataforma, limite = 20) {
  const cfg = lerConfig(p);
  const fs = new Firestore(p, cfg.projeto);
  const pendentes = fs.consultar("fila", "status", "pendente", "criadoEm", limite);
  let ok = 0, erro = 0;
  for (const item of pendentes) {
    try {
      fs.gravar([{ caminho: item.caminho, dados: { status: "processando" }, mesclar: true, seAtualizadoEm: item.atualizadoEm }]);
    } catch { continue; } // outro processo já pegou este item
    try {
      const resultado = executar(p, fs, item);
      fs.gravar([{ caminho: item.caminho, mesclar: true, dados: { status: "ok", resultado, concluidoEm: p.agora() } }]);
      ok++;
    } catch (e) {
      const amigavel = e instanceof ErroUsuario;
      if (!amigavel) p.log(`Erro na fila ${item.caminho}: ${(e as Error).message}`);
      fs.gravar([{ caminho: item.caminho, mesclar: true, dados: {
        status: "erro", concluidoEm: p.agora(),
        mensagem: amigavel ? (e as Error).message : "Não foi possível concluir agora. A Propaga foi avisada.",
      } }]);
      erro++;
    }
  }
  return { ok, erro };
}

function executar(p: Plataforma, fs: Firestore, item: Doc): Record<string, unknown> {
  const { tipo, uid, dados } = item.dados as { tipo: string; uid: string; dados: unknown };
  // O perfil vem do cadastro gravado pelo servidor, nunca do pedido.
  const usuario = fs.ler(`usuarios/${uid}`);
  if (!usuario) throw new ErroUsuario("Usuário sem cadastro no portal.");
  const u = usuario.dados as { nome: string; papel: string };

  switch (tipo) {
    case "convidar":
    case "reenviarConvite": {
      if (u.papel !== "admin") throw new ErroUsuario("Somente o administrador convida usuários.");
      const r = convidar(p, dados, { uid, nome: u.nome });
      return { uid: r.uid, novo: r.novo };
    }
    default:
      throw new ErroUsuario("Esta ação ainda não está disponível.");
  }
}
