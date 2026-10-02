# Plano de construção (um PR por etapa)

1. **Fundação** (este PR): Next.js + Tailwind com a marca, catálogo tipado, regras de preço e fluxo com testes, regras do Firestore, cabeçalhos de segurança, documentação.
2. **Acesso**: Firebase Auth + Identity Platform, convite por e-mail, criar senha, TOTP, recuperação, sessão no servidor, guarda de rotas por papel.
3. **Nova solicitação**: formulário das 6 seções, rascunho automático, validação (zod) no cliente e na função `enviarSolicitacao`, protocolo, notificações.
4. **Solicitações**: lista, detalhe, linha do tempo, ações por papel via função `executarAcao`.
5. **Valores e Relatórios**: catálogo público, relatórios por período e por pedido, exportação PDF/planilha.
6. **Contrato, Drive, Usuários, Ajuda**.
7. **Integrações**: e-mail (portal@propaga.com), job no Briefing Hub, domínio portal.propaga.com.
8. **Piloto** com a B&M Log e checklist de aceite do contrato (Anexo B3).

## Depende do Marco
- Criar o projeto Firebase `propaga-portal` (conta marco@propaga.com, região São Paulo) e dar acesso.
- Conta de envio portal@propaga.com no Google Workspace.
- Registro do subdomínio portal.propaga.com na HostGator (sem alterar MX).
- PDF do contrato assinado e data de assinatura.
- Confirmar: aceite de orçamento pela Mariana; e-mail de login da Débora.
