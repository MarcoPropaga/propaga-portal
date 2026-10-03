/* Abstração do ambiente Apps Script — permite testar o servidor fora do Google. */
export interface RespostaHttp { status: number; corpo: string }
export interface Plataforma {
  /** Requisição HTTP autenticada com a credencial do dono do script (OAuth). */
  http(url: string, metodo: "get" | "post" | "patch" | "delete", corpo?: unknown): RespostaHttp;
  enviarEmail(msg: { para: string; assunto: string; html: string; texto: string; nomeRemetente: string }): void;
  propriedade(chave: string): string | null;
  agora(): Date;
  log(msg: string): void;
}

export class ErroUsuario extends Error {} // mensagem pode ser mostrada ao usuário

export function json<T>(r: RespostaHttp, contexto: string): T {
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`${contexto}: HTTP ${r.status} ${r.corpo.slice(0, 300)}`);
  }
  return (r.corpo ? JSON.parse(r.corpo) : {}) as T;
}
