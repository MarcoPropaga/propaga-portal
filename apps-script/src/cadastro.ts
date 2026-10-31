/* Cadastro da empresa do prospect (fila tipo "cadastro"). Texto livre por campo; o servidor só aceita os 42 ids conhecidos. */
import { CLIENTES } from "@/content/clientes";
import { CAMPOS_CADASTRO, MAX_CAMPO_CADASTRO, cadastroCompleto, preenchidos, type ValoresCadastro } from "@/content/cadastro";
import type { Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { atendeCliente, MSG_SEM_VINCULO } from "@/lib/vinculos";

export function executarCadastro(
  p: Plataforma, fs: Firestore,
  u: { uid: string; nome: string; papel: string; email: string; clienteId: string | null },
  clienteId: string, bruto: unknown,
) {
  if (!["solicitante", "atendimento", "admin"].includes(u.papel)) throw new ErroUsuario("Seu perfil não preenche o cadastro da empresa.");
  if (u.papel === "solicitante" && u.clienteId !== clienteId) throw new ErroUsuario("Cliente inválido para o seu acesso.");
  if (u.papel !== "solicitante" && !atendeCliente({ ...u, propaga: true }, clienteId)) throw new ErroUsuario(MSG_SEM_VINCULO);
  if (!CLIENTES[clienteId]?.avaliacao) throw new ErroUsuario("O cadastro da empresa vale para clientes em teste de avaliação.");
  const entrada = ((bruto ?? {}) as { valores?: Record<string, unknown> }).valores;
  if (!entrada || typeof entrada !== "object") throw new ErroUsuario("Nada para salvar.");
  const ids = new Set(CAMPOS_CADASTRO.map((c) => c.id));
  const caminho = `clientes/${clienteId}/cadastro/dados`;
  const valores: ValoresCadastro = { ...((fs.ler(caminho)?.dados as { valores?: ValoresCadastro } | undefined)?.valores ?? {}) };
  for (const [k, v] of Object.entries(entrada)) {
    if (!ids.has(k)) throw new ErroUsuario("Campo desconhecido no cadastro.");
    const t = String(v ?? "").trim();
    if (t.length > MAX_CAMPO_CADASTRO) throw new ErroUsuario(`Cada resposta tem no máximo ${MAX_CAMPO_CADASTRO} caracteres.`);
    if (t) valores[k] = t; else delete valores[k];
  }
  fs.gravar([{ caminho, dados: { valores, atualizadoEm: p.agora(), por: u.nome } }]);
  return { preenchidos: preenchidos(valores), total: CAMPOS_CADASTRO.length, completo: cadastroCompleto(valores) };
}
