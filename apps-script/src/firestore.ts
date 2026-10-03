/* Firestore via REST, com a credencial de administrador do dono do script.
   Converte objetos JS <-> formato de valores do Firestore. */
import { json, type Plataforma } from "./plataforma";

type Valor = Record<string, unknown>;

export function paraValor(v: unknown): Valor {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValor) } };
  if (typeof v === "object") return { mapValue: { fields: paraCampos(v as Record<string, unknown>) } };
  throw new Error(`Tipo não suportado: ${typeof v}`);
}

export function paraCampos(o: Record<string, unknown>): Record<string, Valor> {
  const f: Record<string, Valor> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = paraValor(v);
  return f;
}

export function deValor(v: Valor): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Valor[] }).values || []).map(deValor);
  if ("mapValue" in v) return deCampos(((v.mapValue as { fields?: Record<string, Valor> }).fields) || {});
  return null;
}

export function deCampos(f: Record<string, Valor>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) o[k] = deValor(v);
  return o;
}

export interface Doc { nome: string; caminho: string; dados: Record<string, unknown>; atualizadoEm: string }

export class Firestore {
  constructor(private p: Plataforma, private projeto: string) {}
  private get raiz() { return `projects/${this.projeto}/databases/(default)/documents`; }
  private get base() { return `https://firestore.googleapis.com/v1/${this.raiz}`; }

  ler(caminho: string): Doc | null {
    const r = this.p.http(`${this.base}/${caminho}`, "get");
    if (r.status === 404) return null;
    const d = json<{ name: string; fields?: Record<string, Valor>; updateTime: string }>(r, `ler ${caminho}`);
    return { nome: d.name, caminho, dados: deCampos(d.fields || {}), atualizadoEm: d.updateTime };
  }

  /** Grava várias operações atomicamente. `seAtualizadoEm` evita processar o mesmo item duas vezes. */
  gravar(ops: { caminho: string; dados: Record<string, unknown>; mesclar?: boolean; seAtualizadoEm?: string; seNaoExiste?: boolean }[]) {
    const writes = ops.map((o) => {
      const w: Record<string, unknown> = { update: { name: `${this.raiz}/${o.caminho}`, fields: paraCampos(o.dados) } };
      if (o.mesclar) w.updateMask = { fieldPaths: Object.keys(o.dados).map((k) => `\`${k}\``) };
      if (o.seAtualizadoEm) w.currentDocument = { updateTime: o.seAtualizadoEm };
      if (o.seNaoExiste) w.currentDocument = { exists: false };
      return w;
    });
    return json(this.p.http(`${this.base}:commit`, "post", { writes }), "gravar");
  }

  /** Lista todos os documentos de uma coleção pequena (ex.: usuarios). */
  listar(colecao: string): Doc[] {
    const docs: Doc[] = [];
    let token = "";
    do {
      const d = json<{ documents?: { name: string; fields?: Record<string, Valor>; updateTime: string }[]; nextPageToken?: string }>(
        this.p.http(`${this.base}/${colecao}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`, "get"), `listar ${colecao}`);
      for (const x of d.documents || []) {
        docs.push({ nome: x.name, caminho: x.name.split("/documents/")[1], dados: deCampos(x.fields || {}), atualizadoEm: x.updateTime });
      }
      token = d.nextPageToken || "";
    } while (token);
    return docs;
  }

  /** Consulta simples em uma coleção de nível superior: campo == valor, ordenado. */
  consultar(colecao: string, campo: string, igual: unknown, ordenarPor: string, limite = 20): Doc[] {
    const corpo = {
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: { fieldFilter: { field: { fieldPath: campo }, op: "EQUAL", value: paraValor(igual) } },
        orderBy: [{ field: { fieldPath: ordenarPor }, direction: "ASCENDING" }],
        limit: limite,
      },
    };
    const linhas = json<{ document?: { name: string; fields?: Record<string, Valor>; updateTime: string } }[]>(
      this.p.http(`${this.base}:runQuery`, "post", corpo), `consultar ${colecao}`);
    return linhas.filter((l) => l.document).map((l) => {
      const d = l.document!;
      const caminho = d.name.split("/documents/")[1];
      return { nome: d.name, caminho, dados: deCampos(d.fields || {}), atualizadoEm: d.updateTime };
    });
  }
}
