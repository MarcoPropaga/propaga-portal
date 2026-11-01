/* Áreas do portal. "propaga" = Portal Propaga do admin (marca e menu da Propaga, sem cliente escolhido);
   "cliente" = portal de um cliente (marca e menu do cliente). Só o admin entra na área Propaga (menu v3, 30/10/2026). */
const CAMINHOS_PROPAGA = ["/admin/", "/propaga", "/criativo/pagamentos", "/criativo/visao", "/criativo/tabela"];

export type Area = "propaga" | "cliente";

export function areaDe(papel: string | null | undefined, caminho: string): Area {
  return papel === "admin" && CAMINHOS_PROPAGA.some((p) => caminho.startsWith(p)) ? "propaga" : "cliente";
}
