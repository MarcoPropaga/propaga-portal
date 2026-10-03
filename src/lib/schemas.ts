/* Validação da solicitação — a mesma no navegador e no servidor. */
import { z } from "zod";

const driveRegex = /^https:\/\/drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|file\/d\/)[\w-]+/;

export const itemSchema = z.object({
  cod: z.string().min(1),
  variante: z.number().int().min(0),
  qtd: z.number().int().min(1, "Quantidade mínima: 1.").max(99, "Quantidade máxima: 99."),
  opcao: z.string().optional(),
  canal: z.string().optional(),
  audio: z.string().optional(),
  obs: z.string().max(3000).optional(),
});

export const solicitacaoSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título da solicitação.").max(120),
  unidade: z.string().min(1, "Selecione a unidade: matriz, filial ou todas."),
  email: z.string().email("Informe um e-mail de contato válido."),
  objetivo: z.string().trim().min(1, "Descreva o objetivo em uma frase.").max(160),
  publico: z.string().min(1, "Selecione o público da solicitação."),
  itens: z.array(itemSchema).min(1, "Adicione ao menos um serviço.").max(30),
  drive: z.object({
    link: z.string().regex(driveRegex, "Cole o link de uma pasta do Google Drive (drive.google.com/drive/folders/…)."),
    conferido: z.literal(true, { message: "Confirme que conferiu os arquivos e as permissões no Drive." }),
  }),
  obs: z.string().max(30000, "As observações aceitam até 30.000 caracteres."),
  prazo: z.object({
    desejada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data desejada."),
    urgente: z.boolean(),
  }),
  conferido: z.literal(true, { message: "Confirme que conferiu serviços, materiais e informações." }),
});

export type SolicitacaoInput = z.infer<typeof solicitacaoSchema>;

/* Convite de usuário (somente admin). */
export const PAPEIS_CLIENTE = ["solicitante", "financeiro_cliente"] as const;
export const PAPEIS_PROPAGA = ["atendimento", "financeiro_propaga", "admin"] as const;

export const conviteSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome.").max(80),
    email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
    papel: z.enum([...PAPEIS_CLIENTE, ...PAPEIS_PROPAGA], { message: "Escolha o perfil." }),
    clienteId: z.string().trim().optional(),
  })
  .refine((d) => !(PAPEIS_CLIENTE as readonly string[]).includes(d.papel) || !!d.clienteId, {
    message: "Perfis de cliente precisam de um cliente vinculado.",
    path: ["clienteId"],
  });

export type ConviteInput = z.infer<typeof conviteSchema>;

/* Regras de senha (iguais à política configurada no Firebase). */
export const REGRAS_SENHA: { texto: string; ok: (s: string) => boolean }[] = [
  { texto: "8 caracteres ou mais", ok: (s) => s.length >= 8 },
  { texto: "Uma letra maiúscula", ok: (s) => /[A-Z]/.test(s) },
  { texto: "Um número", ok: (s) => /\d/.test(s) },
  { texto: "Um símbolo", ok: (s) => /[^A-Za-z0-9]/.test(s) },
];

/* Ações sobre um pedido (fila tipo "acao"). Exigências por ação ficam no servidor (acoes.ts). */
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
export const ACOES = ["aceitarPedido", "disponibilizarVersao", "pedirAjustes", "aprovar", "entregar",
  "confirmarRecebimento", "faturar", "registrarPagamento", "cancelar"] as const;
export const acaoSchema = z.object({
  protocolo: z.string().regex(/^[A-Z]{2,5}-\d{4}-\d{4}$/, "Protocolo inválido."),
  acao: z.enum(ACOES),
  nota: z.string().trim().max(3000, "A nota aceita até 3.000 caracteres.").optional(),
  link: z.string().trim().regex(driveRegex, "Cole um link do Google Drive.").optional(),
  cronograma: z.object({ inicio: data, primeira: data, final: data })
    .refine((c) => c.inicio <= c.primeira && c.primeira <= c.final, { message: "As datas devem seguir a ordem: início, 1ª apresentação, entrega final." })
    .optional(),
  valores: z.array(z.object({ indice: z.number().int().min(0), valor: z.number().positive("Informe um valor maior que zero.").max(1_000_000) })).max(30).optional(),
  driveVerificado: z.boolean().optional(),
});
export type AcaoInput = z.infer<typeof acaoSchema>;
