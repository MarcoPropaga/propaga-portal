# Portal Propaga

Portal onde os clientes da Propaga solicitam serviços, acompanham cada etapa e consultam valores e contrato. Primeiro cliente: B&M Log.

## Rodar localmente
```bash
cp .env.example .env.local   # preencha com as chaves do projeto Firebase
npm install
npm run dev                  # http://localhost:3000
npm test                     # regras de preço, fluxo, prazo e validação
npm run typecheck
```

## Estrutura
```
src/app/                  rotas (Next.js App Router)
src/content/catalogos/    catálogos versionados por cliente
src/lib/                  tipos, preços, fluxo, datas, validação
tests/                    testes (Vitest)
firestore.rules           regras multi-cliente
docs/ARQUITETURA.md       decisões, papéis, dados e segurança
docs/PLANO.md             etapas e o que depende da Propaga
```

Nenhuma chave vai para o repositório. Em produção, segredos ficam no Secret Manager.
