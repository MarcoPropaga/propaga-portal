# Portal Propaga — arquitetura

Portal de clientes da Propaga. Primeiro cliente: **B&M Log**. Prévia validada: artifact "Portal B&M Log" (v5, 02/10/2026).

## Decisões
| Data | Decisão |
|---|---|
| 02/10 | Projeto Firebase **próprio** (`propaga-portal`), separado do Briefing Hub. Integração por função que cria o job. |
| 02/10 | Multi-cliente desde o início: tudo sob `/clientes/{clienteId}`. |
| 02/10 | Valores **não** aparecem na solicitação, na lista nem no detalhe. Só em *Valores* (catálogo) e *Relatórios* (por pedido). |
| 02/10 | Contrato assinado: pedido só com preço de catálogo vai direto para produção após o cronograma. Item *a cotar* exige aceite do Financeiro do cliente. |
| 02/10 | Catálogo B&M Log v1.0: 68 serviços. Post+ e Booth China removidos; Stand ganhou "versão em outro idioma" (a cotar). Item 21 motion 16–60 s = a cotar. |
| 02/10 | Unidades: Matriz Itajaí/SC + 7 filiais. Públicos: empresários importadores/exportadores 40–65 (principal) e colaboradores (secundário). |

## Stack
Next.js 15 + TypeScript + Tailwind 4 · Firebase App Hosting (southamerica-east1) · Firestore · Firebase Auth com Identity Platform (senha + TOTP) · Cloud Functions · Secret Manager.

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
clientes/{c}/rascunhos/{uid}         rascunho automático
usuarios/{uid}                       perfil (escrita só pelo servidor)
interno/catalogos/{c}-{versao}       catálogo com referência (só admin)
```

## Fluxo
`enviada → validacao → (aceite, se houver item a cotar) → producao ⇄ apresentacao → aprovada → entregue → faturada → paga` · `cancelada` com motivo. Regras em `src/lib/fluxo.ts`, testadas em `tests/`.

## Segurança
- Toda gravação de pedido, valor e evento passa por Cloud Function que aplica `fluxo.ts` e `precos.ts`.
- Leitura exige 2FA (`sign_in_second_factor`).
- Referência interna de preço nunca sai do servidor.
- Convite: admin cria o usuário → e-mail com link de uso único (72 h) → criar senha → ativar autenticador.
- Drive: só links + verificação manual nesta fase; sem credenciais no navegador.
