/* Catálogo FICTÍCIO de teste do cliente "pet": mesmos serviços e valores de referência do molde (B&M Log v1.0),
   com o desconto do contrato deste cliente (10%). Não é contrato real. */
import type { Catalogo } from "@/lib/tipos";
import { catalogoBmlogV1 } from "./bmlog-v1.0";

export const catalogoPetV1: Catalogo = { ...catalogoBmlogV1, clienteId: "pet", desconto: 0.10 };
