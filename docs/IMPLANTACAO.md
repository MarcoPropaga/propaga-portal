# Implantação (passo a passo)

Tudo gratuito: Firebase plano Spark + Google Apps Script na conta marco@propaga.com.

## 1. Servidor (Google Apps Script)
1. `npm run build:servidor` → gera `apps-script/dist/` (Codigo.js, Entrada.gs, appsscript.json).
2. Em script.google.com, com marco@propaga.com: **Novo projeto** → nome "Portal Propaga — servidor".
3. Configurações do projeto → marcar "Mostrar o arquivo de manifesto appsscript.json".
4. Colar o conteúdo dos três arquivos de `dist/` (Codigo.js vira o arquivo `Codigo.gs`).
5. Configurações do projeto → **Propriedades do script**:
   | Propriedade | Valor |
   |---|---|
   | PROJETO_ID | propaga-portal |
   | PORTAL_URL | https://propaga-portal.web.app (depois: https://portal.propaga.com) |
   | ADMIN_EMAIL | marco@propaga.com |
   | ADMIN_NOME | Marco Chaves |
   | REMETENTE_NOME | Portal Propaga |
6. Executar, nesta ordem, autorizando quando pedir: `configurarProjeto` → `criarAdministrador` → `instalarGatilho`.
7. **Implantar → Nova implantação → App da Web**: executar como *eu*, acesso *qualquer pessoa*. Copiar a URL para `NEXT_PUBLIC_SERVIDOR_URL`.

## 2. Firebase
1. `npx firebase login` (conta marco@propaga.com).
2. `npm run publicar` → build estático + regras do Firestore + Hosting.
3. Console → Authentication → **Modelos** → Redefinição de senha: idioma Português; URL de ação = `https://propaga-portal.web.app/primeiro-acesso/`.
4. Authentication → Configurações → Domínios autorizados: incluir `portal.propaga.com` quando o domínio for ligado.

## 3. Domínio (opcional)
Hosting → Adicionar domínio personalizado `portal.propaga.com` → criar na HostGator os registros indicados (sem alterar MX).

## 4. Teste de aceite
- Marco recebe o convite, cria a senha, ativa o autenticador e entra.
- Em /admin/usuarios, convidar os demais (Débora, Mariana, Marcelo, Marisa).
- Cada um entra com senha + código; Débora não vê Relatórios nem valores por pedido.
