/* Clientes do portal. Unidades e públicos aprovados em 02/10/2026. */
import { catalogoBmlogV1 } from "@/content/catalogos/bmlog-v1.0";
import type { Catalogo } from "@/lib/tipos";

export interface Cliente {
  id: string;
  nome: string;
  nomePortal: string;
  unidades: string[];
  publicos: { valor: string; rotulo: string }[];
  catalogo: Catalogo;
}

export const CLIENTES: Record<string, Cliente> = {
  bmlog: {
    id: "bmlog",
    nome: "B&M Log",
    nomePortal: "Portal B&M Log",
    unidades: [
      "Matriz · Itajaí/SC", "Filial · São Bento do Sul/SC", "Filial · São Paulo/SP", "Filial · Santos/SP",
      "Filial · Guarulhos/SP", "Filial · Curitiba/PR", "Filial · São José dos Pinhais/PR", "Filial · Caxias do Sul/RS",
      "Todas as unidades",
    ],
    publicos: [
      { valor: "Empresários importadores e exportadores (40 a 65 anos)", rotulo: "Principal · Empresários importadores e exportadores (40 a 65 anos)" },
      { valor: "Colaboradores da matriz e das filiais", rotulo: "Secundário · Colaboradores da matriz e das filiais" },
      { valor: "Ambos os públicos", rotulo: "Ambos os públicos" },
    ],
    catalogo: catalogoBmlogV1,
  },
};

export const NOMES_PAPEIS: Record<string, string> = {
  solicitante: "Solicitante",
  financeiro_cliente: "Financeiro do cliente",
  atendimento: "Atendimento Propaga",
  financeiro_propaga: "Financeiro Propaga",
  admin: "Administrador",
};
