# Portal Propaga — arquitetura (revisão de 24/10/2026)

Portal da Propaga para clientes e profissionais. Primeiro cliente: **B&M Log**, em uso real desde 05/10/2026.
Esta revisão incorpora as decisões do Marco de 24/10/2026. O que ainda não existe no código está marcado em "Estado do código × alvo".

## Decisões
| Data | Decisão |
|---|---|
| 02/10 | Projeto Firebase **próprio** (`propaga-portal`, organização propaga.com, Firestore em São Paulo), separado do Briefing Hub. |
| 02/10 | **Plano gratuito (Spark), sem cartão.** Site estático no Firebase Hosting; "servidor" em **Google Apps Script** na conta da Propaga. |
| 02/10 | Login com e-mail + senha + **verificação em duas etapas (TOTP)** via Identity Platform. |
| 02/10 | Multi-cliente desde o início: tudo sob `/clientes/{clienteId}`. |
| 02/10 | Catálogo B&M Log v1.0: 68 serviços. Unidades: Matriz Itajaí/SC + 7 filiais. |
| 21/10 | Equipe de marketing compartilhada. **Revogada em 24/10.** |
| 24/10 | O aceite de orçamento pelo Financeiro do cliente **deixa de existir**. O Financeiro do cliente não participa de negociações; só vê os materiais novos e os valores no relatório do fim do mês. |
| 24/10 | Cada solicitante vê só os próprios pedidos. O pedido pertence a quem o originou. |
| 24/10 | Profissionais (atendimento, criativo, mídia social) são pessoas cadastradas pelo admin, com dashboard exclusivo e sem interferência de colegas. |
| 24/10 | Material novo: fluxo de precificação (fluxo 2). Tabelas atualizadas na aprovação do admin, independentemente do cliente. |

## Camadas
```
PORTAL PROPAGA
 ├─ Profissionais Propaga (cadastro único feito pelo admin)
 │    atendimento · criativo · mídia social · financeiro Propaga · admin
 └─ Cliente (um por contrato)
      ├─ Solicitantes (marketing) e Financeiro do cliente
      ├─ Contrato: só o pacote mensal (materiais pré-aprovados e valores)
      ├─ Jobs Propaga: todos os materiais e valores atualizados (o cliente vê)
      └─ Vínculos feitos pelo admin com profissionais
```
- **Profissional:** o admin faz o pré-cadastro e libera o acesso. No primeiro acesso, a pessoa refina o próprio perfil (para o criativo, as habilidades de criação de materiais, que são os tipos de material).
- **Vínculo profissional × cliente:** decisão humana do admin, pelo alinhamento com a marca. **Um atendimento por cliente**; o admin escolhe entre os cadastrados e reatribui em troca ou cobertura. Para criativos, o vínculo também considera o tipo de material: digitais para redes sociais, impressos (catálogos, folders, material para feiras), sites, vídeos e outros.
- **Isolamento:** cada profissional tem dashboard exclusivo. Mesmo colegas da mesma função e do mesmo segmento não veem pedidos, tabelas, contratos nem pastas uns dos outros.
- **Menus por função:** contrato, tabela ou horas, relatório, tarefas.

## Papéis
| Papel | Pode |
|---|---|
| solicitante | Cria pedidos, vê só os próprios, aceita a edição devolvida, pede ajuste, aprova peças, pede refação, cancela antes do aceite |
| financeiro_cliente | Consulta pedidos e relatórios. Sem ações no fluxo |
| atendimento | Analisa pedidos, edita itens, troca criativo, aceita e encaminha ao criativo, cria pedido em nome de um solicitante, entrega |
| criativo | Cria peças dos pedidos que são dele, mantém a própria tabela, envia o relatório mensal |
| midia_social | Monta o calendário mensal e registra agendamento e publicação |
| financeiro_propaga | Fatura, registra pagamentos, paga criativos, vê contratos dos profissionais |
| admin | Tudo: cadastro, vínculos, tabelas, valor final de material novo |

## Fluxo 1 — pedido dentro do pacote
**Começa pelo Marketing do cliente**
1. O solicitante envia. O Atendimento analisa.
2. O Atendimento pode editar os itens (incluir e excluir) e trocar o criativo.
3. Toda edição de itens volta ao Marketing pela ação **Devolver**. O pedido não pode ser aceito enquanto o Marketing não aceitar a edição. Se discordar, o Marketing pede ajuste ao Atendimento. **Não há recusa de edição.**
4. Trocar só o criativo não devolve.
5. Depois do aceite, o Atendimento encaminha ao criativo. O pedido já vem pré-selecionado para o criativo do tipo de material que predomina; só o Atendimento troca.

**Começa pelo Atendimento da Propaga**
- O Atendimento escolhe o solicitante que recebe. O pedido vai a ele para conhecimento e aceite: aprovar, pedir ajuste ou recusar (encerra sem cobrança).

**Dono do pedido:** quem o originou. O pedido criado pelo Atendimento pertence ao solicitante escolhido e é visível só a ele e ao Atendimento. Se o cliente tiver um único solicitante, a escolha é automática.

**Depois do aceite:** produção, avaliação por peça pelo Marketing, entrega, faturamento e pagamento.
- Ajustes na solicitação, antes das peças, não contam.
- Até 2 refações por peça estão incluídas. A 3ª, com edições novas, acrescenta 30%.
- Cancelamento depois de apresentado cobra 50%.

## Fluxo 2 — material novo (fora do pacote e fora da Jobs Propaga)
1. **Origem:** o Marketing solicita, ou o Atendimento identifica a necessidade.
2. O Atendimento analisa. Se veio do Marketing, pode editar e devolver (regra do fluxo 1).
3. O **criativo** analisa e precifica. Ele não vê o valor do cliente.
4. O **admin** analisa, aprova o valor do criativo e **digita** o valor final da Propaga.
5. **Na aprovação do admin**, o material entra na tabela do criativo (versão e data) e na Jobs Propaga. Isso vale mesmo que o cliente recuse depois.
6. O Atendimento recebe o item com o valor final e envia ao Marketing.
7. O Marketing aprova, pede ajuste ou recusa. Quando a origem é o Atendimento, este é o único passo do Marketing.
8. Aprovado: o pedido segue para produção. Recusado: o pedido é encerrado sem cobrança, e as tabelas permanecem.

**Regras**
- O pedido fica parado até o Marketing aprovar o valor.
- Material que já está na Jobs Propaga e fora do pacote **não** precisa de nova aprovação do valor, porque o cliente já tem acesso a ele. Vale também para o que o cliente já recusou.
- O contrato do cliente só muda se o material passar a fazer parte do pacote mensal.
- Itens "a cotar" do catálogo seguem este mesmo fluxo.
- O Financeiro do cliente não participa. Vê os materiais novos e os valores no relatório do fim do mês.
- O portal não controla saldo da cota do pacote.

## Fluxo 3 — redes sociais
1. O perfil de mídia social monta o calendário do mês (tema, canais, data, horário, legenda) e envia ao Atendimento com pelo menos 7 dias de antecedência.
2. O Atendimento analisa e envia à solicitante, ou devolve.
3. A solicitante aprova item por item ou pede ajuste.
4. O Atendimento pede as artes pelo fluxo de peças e vincula cada peça ao post.
5. Aprovada a arte e entregue o arquivo final, a mídia social agenda no mLabs e registra "Agendada" e "Publicada" (data não futura e link, ou justificativa).
- O portal não publica nem se integra ao mLabs.
- O faturamento não espera a publicação.
- **Relatório de redes:** a fonte e os indicadores são lançados pelo próprio profissional de mídia social. Não há integração com as plataformas.
- Envio ao cliente: proposta de e-mail programado para líderes e diretores, sem login (aguarda resposta).

## Fluxo 4 — remuneração dos profissionais
- **Criativo:** tabela própria acordada com o admin. Envia o relatório mensal das peças concluídas; o Financeiro Propaga confere e paga. Cada tabela guarda versão e data, e meses fechados mantêm o valor da época.
- **Atendimento e mídia social:** contrato de horas (pacote mensal fechado, por exemplo 20 h por R$ 1.500).
  - **Valor da hora:** o valor do pacote dividido pelas horas contratadas (no exemplo, R$ 75). Consta no contrato assinado.
  - **Horas extras:** são a fração das horas do contrato, pagas pelo valor da hora. Uso esperado: raro, em casos urgentes ou em viagem pedida pelo cliente.
  - **Lançamento:** feito pelo próprio profissional, com justificativa.
  - **Aprovação:** o admin aprova as horas extras.
- **Contrato assinado:** visto pelo próprio profissional, pelo admin e pelo Financeiro Propaga.

## Quem vê qual valor
| Quem | Vê |
|---|---|
| criativo | Só a própria tabela e o valor dele |
| solicitante | Jobs Propaga (valores finais do cliente) |
| financeiro_cliente | Jobs Propaga e relatórios do cliente, incluindo materiais novos no fim do mês |
| atendimento | Valores finais da Propaga. Não vê tabelas nem contratos dos criativos |
| financeiro_propaga | Valores finais e relatórios dos criativos e dos contratos de horas |
| admin | Todos |

## Como as peças conversam
```
Navegador (Next.js estático, Firebase Hosting)
  ├─ Firebase Auth: senha + TOTP  ──────────────► claims {papel, clienteId | propaga}
  ├─ Firestore: lê dados permitidos pelas regras
  └─ Firestore: cria item em /fila  ─┐  (único tipo de escrita do navegador, além do rascunho)
                                     │  + aviso opcional ao Web App (doPost)
Google Apps Script (conta Propaga)   ▼
  ├─ processarFila (gatilho de 1 min + aviso imediato)
  │    valida de novo com src/lib (fluxo, preços, zod) e grava pedidos, valores, eventos
  ├─ convidar: cria conta, define perfil (claims), gera link de senha, envia e-mail
  └─ configurarProjeto: TOTP, política de senha, catálogos
```
O código de regras (`src/lib`) é o mesmo no navegador e no Apps Script: `apps-script/build.mjs` empacota tudo em um arquivo.

## Dados
```
clientes/{c}                         nome, unidades[], publicos[], catalogoVigente
clientes/{c}/catalogo/{versao}       Jobs Propaga: valor final (catalogoPublico)
clientes/{c}/solicitacoes/{prot}     pedido (sem valores)
clientes/{c}/solicitacoes/{prot}/eventos/{id}   histórico permanente
clientes/{c}/valores/{prot}          valores do pedido
clientes/{c}/rascunhos/{uid}         rascunho automático
fila/{id}                            pedidos de ação do navegador → processados pelo Apps Script
usuarios/{uid}                       cadastro (escrita só pelo servidor)
interno/catalogos/versoes/{c}-{v}    catálogo com referência interna (só servidor)
criativo/tabela, criativo/adicionais tabela do criativo (hoje documento único; alvo: um por criativo)
relatoriosCriativo/{uid}_{AAAA-MM}   relatório mensal de cada criativo (já isolado por criativo)
```

## Estado do código × alvo (conferência de 24/10/2026)
| Tema | Hoje | Alvo |
|---|---|---|
| Visibilidade do solicitante | `solicitacoes` e `valores` legíveis por todo o cliente (PR #50) | Só os próprios pedidos; regras, servidor, listas e testes |
| Edição de itens | Em `enviada`, o pedido continua `enviada` e o aceite fica liberado | Edição devolve ao Marketing e bloqueia `aceitarPedido` |
| Pedido criado pelo Atendimento | O titular é o primeiro solicitante por ordem alfabética | O Atendimento escolhe o solicitante |
| Aceite de orçamento | Não existe; o Atendimento valora itens a cotar no aceite | Fluxo 2 (material novo) |
| Profissionais Propaga | Equipe Propaga lê todos os clientes | Vínculo por cliente, com isolamento nas regras |
| Isolamento do criativo | Só na tela (`usePedidos`); as regras deixam ler todos os pedidos | Regras e servidor |
| Tabela do criativo | Documento único, legível por qualquer criativo | Uma por criativo, com versão e data |
| `/fila` | Papel fora da lista cai numa lista padrão | Lista fechada por papel |
| Contratos e horas de profissionais | Não existem | Fluxo 4; retenção e acesso a definir |
| Um atendimento por cliente | Todo atendimento atua em todos os clientes | Vínculo único por cliente, reatribuído pelo admin |

## Segurança
- Regras testadas no emulador (`npm run test:regras`): 2FA obrigatório, isolamento entre clientes, nenhuma gravação de pedido pelo navegador, referência interna inacessível. Os testes de visibilidade por solicitante e por criativo serão reescritos junto com as regras.
- O servidor nunca confia no perfil enviado pelo navegador: lê `usuarios/{uid}` gravado por ele mesmo.
- Convite: link de senha de uso único (validade de 1 hora); se expirar, a página gera outro.
- Política de senha: 8+ caracteres, maiúscula, número e símbolo. Proteção contra enumeração de e-mails ligada.
- Dados pessoais (contratos, horas e perfis dos profissionais): retenção e acesso a definir antes de gravar.
- Drive: só links + verificação manual nesta fase.

## Em aberto
- Campos do lançamento de horas extras (data, horas, justificativa e, se houver, cliente ou pedido) e a lista final de habilidades do criativo.
- Envio do relatório de redes ao cliente: e-mail programado a líderes e diretores, sem login (proposta sem resposta).
- Como o plano mensal se encaixa no catálogo por serviço; "anexo" do deck B&M Log × tabela Jobs Propaga.
- Relatório de resultados do cliente: fica na arquitetura, construído depois.
