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
