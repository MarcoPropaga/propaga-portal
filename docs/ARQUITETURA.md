# Portal Propaga — arquitetura

Portal de clientes da Propaga. Primeiro cliente: **B&M Log**. Prévia validada: artifact "Portal B&M Log" (v5, 02/10/2026).

## Decisões
| Data | Decisão |
|---|---|
| 02/10 | Projeto Firebase **próprio** (`propaga-portal`, organização propaga.com, Firestore em São Paulo), separado do Briefing Hub. |
| 02/10 | **Plano gratuito (Spark), sem cartão.** Site estático no Firebase Hosting; "servidor" em **Google Apps Script** na conta da Propaga. |
| 02/10 | Login com e-mail + senha + **verificação em duas etapas (TOTP)** via Identity Platform (limite de 3.000 usuários ativos/dia). |
| 02/10 | Multi-cliente desde o início: tudo sob `/clientes/{clienteId}`. |
| 02/10 | Valores **não** aparecem na solicitação, na lista nem no detalhe. Só em *Valores* (catálogo) e *Relatórios*. |
| 02/10 | Contrato assinado: pedido só com preço de catálogo vai direto para produção após o cronograma. Item *a cotar* exige aceite do Financeiro do cliente. |
| 02/10 | Catálogo B&M Log v1.0: 68 serviços. Unidades: Matriz Itajaí/SC + 7 filiais. Públicos: empresários importadores/exportadores 40–65 (principal) e colaboradores (secundário). |

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

## Papéis (claims `papel`, `clienteId` ou `propaga`)
| Papel | Pessoa (B&M Log) | Pode |
|---|---|---|
| solicitante | Débora | Criar e acompanhar os próprios pedidos, pedir ajustes (2 rodadas), aprovar, confirmar recebimento, cancelar antes da produção |
| financeiro_cliente | Mariana | Ver pedidos e Relatórios, aceitar orçamento de itens a cotar |
| atendimento | Marcelo (Propaga) | Receber, verificar Drive, orçar, confirmar cronograma, entregar versões e arquivos |
| financeiro_propaga | Marisa (Propaga) | Relatórios, faturamento, pagamento |
| admin | Marco (Propaga) | Tudo, catálogo, usuários; cancelar em qualquer etapa |

## Dados
```
clientes/{c}                         nome, unidades[], publicos[], catalogoVigente
clientes/{c}/catalogo/{versao}       somente preço final (catalogoPublico)
clientes/{c}/solicitacoes/{prot}     pedido (sem valores)
clientes/{c}/solicitacoes/{prot}/eventos/{id}   histórico permanente
clientes/{c}/valores/{prot}          valores do pedido (só Relatórios)
clientes/{c}/rascunhos/{uid}         rascunho automático (único dado gravado direto pelo navegador)
fila/{id}                            pedidos de ação do navegador → processados pelo Apps Script
usuarios/{uid}                       cadastro (escrita só pelo servidor)
interno/catalogos/versoes/{c}-{v}    catálogo com referência interna (ninguém lê pelo navegador)
```

## Segurança
- Regras testadas no emulador (`npm run test:regras`): 2FA obrigatório, isolamento por cliente, solicitante só vê os próprios pedidos, valores só para Relatórios, nenhuma gravação de pedido pelo navegador, referência interna inacessível.
- O servidor nunca confia no perfil enviado pelo navegador: lê `usuarios/{uid}` gravado por ele mesmo.
- Convite: link de senha de uso único (validade de 1 hora, limite do Firebase); se expirar, a própria página gera outro.
- Política de senha: 8+ caracteres, maiúscula, número e símbolo. Proteção contra enumeração de e-mails ligada.
- Drive: só links + verificação manual nesta fase.
