# Portal Propaga

Portal onde os clientes da Propaga solicitam serviços, acompanham cada etapa e consultam valores e contrato. Primeiro cliente: B&M Log.

Plano gratuito: Firebase (Spark) + Google Apps Script. Veja `docs/ARQUITETURA.md` e `docs/IMPLANTACAO.md`.

## Rodar localmente
```bash
cp .env.example .env.local   # preencha com a configuração web do Firebase
npm install
npm run dev                  # http://localhost:3000
npm test                     # regras de preço, fluxo, prazo, validação e servidor
npm run test:regras          # regras do Firestore no emulador (precisa de Java)
npm run build:servidor       # gera o Apps Script em apps-script/dist
npm run publicar             # build + deploy de Hosting e regras
```

## Estrutura
```
src/app/                  páginas (exportação estática)
src/components/           interface, sessão e acesso
src/content/              catálogos e clientes
src/lib/                  regras compartilhadas com o servidor
apps-script/              servidor (Google Apps Script)
tests/                    testes (Vitest)
firestore.rules           regras multi-cliente
docs/                     arquitetura, plano e implantação
```
