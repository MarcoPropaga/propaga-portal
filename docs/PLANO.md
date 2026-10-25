# Plano de construção (um PR por etapa)

O portal está em uso real com a B&M Log desde 05/10/2026. Este plano cobre só as próximas etapas; o plano original de 8 etapas foi substituído por ele.

## Próximas etapas (decisões de 24/10/2026)
1. **Documentação:** `docs/ARQUITETURA.md` e este plano.
2. ✅ **Visibilidade do solicitante e edição devolvida:** cada solicitante vê só os próprios pedidos; edição de itens devolve ao Marketing e bloqueia o aceite; o Atendimento escolhe o solicitante ao criar pedido; `/fila` com lista fechada de tipos por papel.
3. **Profissionais e vínculo com clientes.** ✅ **3a:** vínculo por cliente (admin), um atendimento por cliente, isolamento nas regras e no servidor, incluindo a leitura do criativo. **3b:** ✅ habilidades do criativo (até 2 primárias + secundárias, perfil do criativo e confirmação do admin). Falta nesta etapa: liberação do acesso pelo admin como passo separado do convite e vínculo por tipo de material (usa as habilidades; entra junto da pré-seleção da etapa 6).
4. **Contratos e tabela por criativo, e registro de horas.**
5. **Material novo:** fluxo de precificação (criativo → admin → Atendimento → Marketing), com tabelas atualizadas na aprovação do admin.
6. **Pré-seleção do criativo:** exige classificar os 68 serviços do catálogo por tipo de material.
7. **Resultados por e-mail programado;** painel só depois da integração com as redes.
8. **Assessoria de imprensa (módulo por cliente, decisões de 25/10/2026; ver Fluxo 5):** (a) contrato, plano A/B/C e perfis; (b) nova pauta, aprovação do release (24 h conforme urgência) e envio; (c) porta-vozes, protocolo de crise e botão de acionamento; (d) clipagem no Drive, relatório do mês e orçamento de cobertura de eventos. B&M Log como simulação. Encaixe no plano a definir (sugestão: depois da etapa 4, que cria contratos).
9. **Configuração por cliente** (cadastro, unidades, textos e equipe de cada cliente: 1 atendimento, 1 ou 2 criativos, 1 mídia social, 1 assessor de imprensa; ver "Configuração multicliente" em `docs/ARQUITETURA.md`), para replicar em outras agências.

## Depende do Marco
- PDF do contrato assinado e data de assinatura.
- E-mails definitivos da Débora e da Mariana.
- Respostas da seção "Em aberto" de `docs/ARQUITETURA.md`.
