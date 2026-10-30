# Molde do portal (decisão de 26/10/2026)

O portal da B&M Log é o **molde oficial**. Cada cliente novo é uma cópia com ajustes de configuração, nunca um portal novo. Corrigir o molde corrige todos os clientes.

## Fixo no molde (igual para todos os clientes)
- **Fluxo do pedido:** cliente solicita → atendimento analisa → criativo cria → cliente aprova ou pede refação → atendimento encaminha para veiculação ou impressão.
- **Material novo:** atendimento → criativo analisa e precifica → admin digita o valor final → atendimento → cliente aprova ou não. Entra nas tabelas assim que o admin aprova.
- **Perfis e permissões:** solicitante (marketing do cliente), financeiro do cliente, atendimento, criativo, mídia social, assessor de imprensa, financeiro Propaga, admin.
- **Isolamento:** um cliente nunca vê outro; cada criativo só vê o que é dele; profissional Propaga só entra nos clientes vinculados pelo admin; um atendimento por cliente.
- **Serviços da Propaga e a tabela Jobs Propaga:** catálogo da agência, o mesmo para todos. O cliente vê a tabela inteira (inclusive o que não contratou) com o preço final dele.
- **Avisos e rotina:** e-mails de aviso, resumo diário, verificação em duas etapas, estrutura de pastas no Drive (01 Briefing a 05 Arquivos abertos), relatórios e relatório mensal do criativo.
- **Relatório do criativo por cliente (30/10/2026):** um relatório por criativo e mês (id `uid_AAAA-MM`), com as peças de todos os clientes vinculados e o cliente em cada linha; a Marisa paga uma vez. A tabela do criativo é a do catálogo-base, igual para todos. Peça de avaliação (teste de 48 h) entra pela tabela normal, marcada como "avaliação". Criativo sem vínculo registrado cai no cliente padrão.
- **DalPet no código (30/10/2026):** cliente `dalpet` (prefixo DPT), catálogo v1.0 sem desconto, selo e cores do site atual. Unidades, públicos e destino de vídeo estão como `[A CONFIRMAR]`; contrato ainda não redigido (`minuta: null`). A marca ganhou o campo opcional `sobreDestaque` (cor do texto sobre o botão; padrão = cor escura): a DalPet usa branco sobre o vermelho #E30818. Falta rodar `configurarProjeto` no Apps Script após o merge.
- **Avaliação de 48 h, parte 3a (30/10/2026):** `Cliente.avaliacao` liga o modo prospect (DalPet). Estado em `clientes/{id}/avaliacao/estado` (iniciadoEm, expiraEm, decisao), gravado só pelo servidor. No teste: relógio, até 3 pedidos de 1 post, só os Jobs 01 e 02, pedido marcado `avaliacao`, sem documento de valores, catálogo publicado sem preços (`semValores`). Aceite (`decisao: aceita`) volta ao modo cliente normal; republicar com `configurarProjeto`. Falta (3b): cadastro da empresa (42 campos) e trava do Baixar; (4): botão Iniciar teste com checklist, que grava o estado.
- **Regra de sigilo:** o que o criativo cobra da Propaga nunca aparece para o cliente nem para o atendimento.

## Configurável por cliente
| Item | Onde fica hoje |
|---|---|
| Marca: cores, logomarca, ícone, nome do portal | `marca` em `src/content/clientes.ts`; `src/lib/tema.ts` aplica as cores e confere contraste AA (teste falha se a marca não passar) |
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
2. Cores, logomarca e nome do portal na configuração do cliente: **feito** (menu e tela de acesso). Textos: **feito** (telas, lib e servidor usam `{cliente}` / `{equipe}` via `aplicarMarca`; o teste `textos-por-cliente` falha se um nome fixo voltar). E-mails: **feito** (27/10/2026: cabeçalho, nome e cores vêm da marca do cliente do pedido; convite da equipe e resumo que mistura clientes usam a marca neutra `MARCA_PROPAGA`; aviso do criativo segue B&M Log). App: título e cor da barra seguem o cliente ativo (`TemaCliente`); o **ícone e o manifest instalável continuam da B&M Log**, porque um site estático tem um manifest só (ícone por cliente exige PNGs reais e manifest por cliente, quando houver um segundo cliente real). Falta: os nomes das pessoas da equipe (Marcelo, Débora, Kauan, Mariane), que ainda estão fixos nos textos e entram no vínculo de equipe por cliente.
3. Textos fixos da B&M Log (perfil "Marketing B&M Log", e-mails, ajuda) passam a usar o nome do portal do cliente.
4. Catálogo por cliente: mesma lista de serviços da Propaga, com pacote e valores próprios (`catalogo(clienteId, versao)` já aceita isso).
5. Cadastro de cliente no admin (etapa 8 do plano) vira a tela que preenche tudo isso.

## Trava de teste
Durante o período de teste ninguém de fora da Propaga entra no portal (decisão de 26/10/2026). Todos os clientes da simulação usam só e-mails da Propaga. A trava é a propriedade `EMAILS_PERMITIDOS` do Apps Script (`apps-script/src/trava.ts`): com a lista preenchida, convite e envio de e-mail fora dela são bloqueados (convite dá erro claro; aviso é descartado e vai para o log). Apague a propriedade só quando o piloto for liberado.

## Clientes de teste (fictícios) e cliente ativo (26/10/2026)

- Decisão de Marco: cadastro **no código, um arquivo por cliente** (revisado por PR). Tela de admin gravando no banco fica para depois, se fizer falta.
- Dois clientes **fictícios** provam o molde sem usar cliente real: **Pet Teste** (`pet`, protocolo PET, desconto 10%) e **Varejo Teste** (`varejo`, protocolo VAR, desconto 5%). Têm marca, selo e catálogo próprios (mesmos serviços do molde; o desconto é o do contrato de cada um). Nomes neutros de propósito, para não se confundir com cliente real.
- Para criar um cliente novo: acrescentar em `src/content/clientes.ts`, criar `src/content/catalogos/<id>-v1.0.ts`, registrar em `catalogos/index.ts`, colocar o selo em `public/brand` e rodar `configurarProjeto` no Apps Script. Os testes `clientes.test.ts` e `tema.test.ts` conferem prefixo único, catálogo, selo e contraste AA.
- **Cliente ativo:** quem é do cliente trabalha sempre no próprio. A equipe Propaga escolhe no menu ("Cliente em atendimento"): admin e Financeiro Propaga veem todos; atendimento, criativo e mídia social só os vinculados (tela Usuários). A marca e as cores acompanham o cliente escolhido. O acesso de verdade continua nas regras do banco e no servidor.
- A migração de vínculos antigos põe os profissionais só na B&M Log; clientes novos são vinculados pelo admin.
- **Pendência:** relatório e pagamento do criativo valem só para a B&M Log (um documento por criativo e mês, sem cliente no id). Por cliente: feito em 30/10/2026.
- **Pendência:** `configurarProjeto` precisa rodar uma vez no Apps Script para publicar os dois clientes e catálogos no banco; depois, vincular a equipe aos clientes de teste em Usuários e convidar usuários de teste (a trava `EMAILS_PERMITIDOS` continua valendo).
