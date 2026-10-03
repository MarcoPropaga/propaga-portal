/* SOMENTE SERVIDOR. Catálogos completos, com valor de referência interno.
   Nunca importe este arquivo em src/app ou src/components: o teste tests/sigilo.test.ts falha se isso acontecer. */
import type { Catalogo } from "@/lib/tipos";
import { CLIENTES } from "@/content/clientes";
import { catalogoBmlogV1 } from "./bmlog-v1.0";

export const CATALOGOS: Record<string, Catalogo> = {
  "bmlog-1.0": catalogoBmlogV1,
};

export function catalogo(clienteId: string, versao: string): Catalogo {
  const c = CATALOGOS[`${clienteId}-${versao}`];
  if (!c) throw new Error(`Catálogo ${clienteId} v${versao} não encontrado.`);
  return c;
}

export const catalogoVigente = (clienteId: string) => catalogo(clienteId, CLIENTES[clienteId].catalogoVersao);
