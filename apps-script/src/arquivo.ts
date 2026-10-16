/* Arquivar a rodada de testes (Marco, 16/10/2026): move pedidos, valores, eventos, relatórios dos criativos e serviços
   incluídos para arquivo/{rodada}, zera a numeração e republica a tabela básica. Nada é destruído: o conteúdo antigo
   fica guardado no arquivo e só o administrador pode pedir a operação. */
import { CLIENTES } from "@/content/clientes";
import { hojeSP } from "@/lib/datas";
import type { Doc, Firestore } from "./firestore";
import { ErroUsuario, type Plataforma } from "./plataforma";
import { publicarTabelaCriativo } from "./criativo";

interface Usuario { uid: string; nome: string; papel: string }
const LOTE = 200;
const chave = (caminho: string) => caminho.replace(/\//g, "~");

export function arquivarRodada(p: Plataforma, fs: Firestore, u: Usuario, bruto: unknown) {
  if (u.papel !== "admin") throw new ErroUsuario("Somente o administrador arquiva a rodada de testes.");
  if ((bruto as { confirmar?: string } | null)?.confirmar !== "ARQUIVAR") throw new ErroUsuario("Digite ARQUIVAR para confirmar.");
  const agora = p.agora();
  const rodada = agora.toISOString().replace(/[-:.]/g, "").slice(0, 15);

  // 1) Reúne o que existe.
  const docs: Doc[] = [];
  const contadores: string[] = [];
  for (const cid of Object.keys(CLIENTES)) {
    for (const sol of fs.listar(`clientes/${cid}/solicitacoes`)) {
      docs.push(sol, ...fs.listar(`${sol.caminho}/eventos`));
    }
    docs.push(...fs.listar(`clientes/${cid}/valores`));
    const ano = hojeSP(agora).slice(0, 4);
    const cont = fs.ler(`interno/contadores/protocolos/${cid}-${ano}`);
    if (cont && Number(cont.dados.n ?? 0) > 0) { docs.push(cont); contadores.push(cont.caminho); }
  }
  docs.push(...fs.listar("relatoriosCriativo"));
  const adicionais = fs.ler("criativo/adicionais");
  if (adicionais) docs.push(adicionais);

  if (!docs.length) return { arquivados: 0, rodada: null as string | null };

  // 2) Copia tudo para o arquivo (e só segue se a cópia der certo).
  const copias = docs.map((d) => ({ caminho: `arquivo/${rodada}/itens/${chave(d.caminho)}`, dados: { caminho: d.caminho, dados: d.dados, arquivadoEm: agora, arquivadoPor: u.nome } as Record<string, unknown> }));
  for (let i = 0; i < copias.length; i += LOTE) fs.gravar(copias.slice(i, i + LOTE).map((c) => ({ ...c, seNaoExiste: true })));
  fs.gravar([{ caminho: `arquivo/${rodada}`, dados: { rodada, em: agora, por: u.nome, itens: docs.length } }]);

  // 3) Remove os originais (menos os contadores, que voltam a zero) e republica a tabela básica.
  const apagar = docs.map((d) => d.caminho).filter((c) => !contadores.includes(c));
  for (let i = 0; i < apagar.length; i += LOTE) fs.remover(apagar.slice(i, i + LOTE));
  for (const c of contadores) fs.gravar([{ caminho: c, dados: { n: 0, atualizadoEm: agora } }]);
  publicarTabelaCriativo(fs, agora);
  return { arquivados: docs.length, rodada };
}
