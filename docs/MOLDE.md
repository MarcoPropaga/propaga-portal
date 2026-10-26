# Molde do portal (decisão de 26/10/2026)

O portal da B&M Log é o **molde oficial**. Cada cliente novo é uma cópia com ajustes de configuração, nunca um portal novo. Corrigir o molde corrige todos os clientes.

## Fixo no molde (igual para todos os clientes)
- **Fluxo do pedido:** cliente solicita → atendimento analisa → criativo cria → cliente aprova ou pede refação → atendimento encaminha para veiculação ou impressão.
- **Material novo:** atendimento → criativo analisa e precifica → admin digita o valor final → atendimento → cliente aprova ou não. Entra nas tabelas assim que o admin aprova.
- **Perfis e permissões:** solicitante (marketing do cliente), financeiro do cliente, atendimento, criativo, mídia social, assessor de imprensa, financeiro Propaga, admin.
- **Isolamento:** um cliente nunca vê outro; cada criativo só vê o que é dele; profissional Propaga só entra nos clientes vinculados pelo admin; um atendimento por cliente.
- **Serviços da Propaga e a tabela Jobs Propaga:** catálogo da agência, o mesmo para todos. O cliente vê a tabela inteira (inclusive o que não contratou) com o preço final dele.
- **Avisos e rotina:** e-mails de aviso, resumo diário, verificação em duas etapas, estrutura de pastas no Drive (01 Briefing a 05 Arquivos abertos), relatórios e relatório mensal do criativo.
- **Regra de sigilo:** o que o criativo cobra da Propaga nunca aparece para o cliente nem para o atendimento.

## Configurável por cliente
| Item | Onde fica hoje |
|---|---|
| Marca: cores, logomarca, ícone, nome do portal | `src/content/clientes.ts` + tokens de cor (hoje fixos da B&M Log) |
| Prefixo do protocolo | `clientes.ts` (`prefixo`) |
| Pacote contratado: peças, entregas e valores do contrato | catálogo por cliente (`src/content/catalogos`) |
| **Desconto do cliente** | campo `desconto` do catálogo do cliente (B&M Log: 0,15) |
| Regras comerciais: refações incluídas, cobrança extra, cancelamento | contrato do cliente |
| Unidades, públicos-alvo, canais de vídeo e de redes sociais | `clientes.ts` |
| Equipe do cliente: atendimento, criativos, mídia social, imprensa | vínculos feitos pelo admin (etapa 3a) |
| Assessoria de imprensa contratada ou não (planos A, B ou C) | contrato de imprensa do cliente |
| Contrato assinado: data e PDF | `clientes.ts` (`contrato`) |

## Desconto por cliente
- O desconto é campo do contrato de cada cliente e muda só o **valor que o cliente vê** (Jobs Propaga e relatórios dele).
- O que o criativo cobra da Propaga não muda: vem da tabela própria dele. A margem da Propaga varia por cliente e aparece **só para o admin**.
- **B&M Log: 15%** (real). Os demais clientes ainda serão negociados.

### Simulação (valores fictícios, só para teste)
| Cliente | Desconto |
|---|---|
| B&M Log | 15% |
| DalPet | 10% |
| Rede de varejo (fictícia) | 8% |
| Construtora (fictícia) | 7% |
| Rede de farmácias (fictícia) | 5% |

## O que isso muda na construção
1. ✅ Desconto lido do contrato do cliente: campo `desconto` do catálogo (`src/content/catalogos`, só no servidor), usado por `precos.ts`, Jobs Propaga e testes. Os descontos dos outros clientes não vão para o navegador.
2. Mover cores, logomarca e ícone para a configuração do cliente (hoje fixos da B&M Log).
3. Textos fixos da B&M Log (perfil "Marketing B&M Log", e-mails, ajuda) passam a usar o nome do portal do cliente.
4. Catálogo por cliente: mesma lista de serviços da Propaga, com pacote e valores próprios (`catalogo(clienteId, versao)` já aceita isso).
5. Cadastro de cliente no admin (etapa 8 do plano) vira a tela que preenche tudo isso.

## Trava de teste
Durante o período de teste ninguém de fora da Propaga entra no portal (decisão de 26/10/2026). Todos os clientes da simulação usam só e-mails da Propaga. A trava é a propriedade `EMAILS_PERMITIDOS` do Apps Script (`apps-script/src/trava.ts`): com a lista preenchida, convite e envio de e-mail fora dela são bloqueados (convite dá erro claro; aviso é descartado e vai para o log). Apague a propriedade só quando o piloto for liberado.
