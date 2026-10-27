/* Catálogo FICTÍCIO de teste do cliente "varejo": mesmos serviços e valores de referência do molde (B&M Log v1.0),
   com o desconto do contrato deste cliente (5%). Não é contrato real. */
import type { Catalogo } from "@/lib/tipos";
import { catalogoBmlogV1 } from "./bmlog-v1.0";

export const catalogoVarejoV1: Catalogo = { ...catalogoBmlogV1, clienteId: "varejo", desconto: 0.05 };
