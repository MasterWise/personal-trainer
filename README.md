# Personal Trainer

App de coaching pessoal com IA para rotina alimentar, plano diario, historico de conversas e documentos vivos da usuaria.

## Status atual

- Build, lint, testes e start local validados em 2026-04-12.
- Frontend servido em `/pt/`.
- API exposta em `/api/pt/` no proxy e em `/api/` no backend local.
- Integracao de IA feita exclusivamente via `ai-gateway`.
- Push notifications estao fora do escopo atual.

## O que o app faz hoje

- Setup/login com sessao Bearer persistida em SQLite.
- Chat com historico, arquivamento e reabertura de conversas.
- Conversas de plano com metadata por data, versao e origem da acao.
- Fluxos `Gerar plano`, `Editar plano` e `Novo plano` com versionamento por dia.
- Plano diario interativo com checkbox por item e sincronizacao automatica de calorias e treinos.
- Documentos vivos da usuaria (`micro`, `mem`, `hist`, `plano`, `progresso`, `cal`, `treinos`, `perfil`, `macro`).
- Guard rails para updates da IA: escopo por data, ownership de item marcado e cards de permissao/revisao.
- Tela de logs para inspecao de chamadas da IA.
- PWA basica com manifest e cache de assets estaticos via service worker.

## Fora do escopo atual

- Push notifications.
- Chamadas diretas do frontend para provider de IA.
- React Router, TypeScript ou biblioteca externa de UI.

## Arquitetura resumida

### Backend

- `server.js`: bootstrap HTTP na porta `3400` por padrao.
- `app.js`: factory Express usada em runtime e testes.
- `routes/`: `health`, `auth`, `documents`, `conversations` e `claude`.
- `db/`: SQLite nativo (`node:sqlite`), migrations SQL e statements preparados.
- `middleware/`: auth, CORS/rate limit e seguranca.

### Frontend

- `src/main.jsx`: inicializa `ThemeProvider -> AuthProvider -> DocsProvider -> ToastProvider -> App`.
- `src/App.jsx`: shell principal, tabs e fluxos de conversa/plano.
- `src/views/`: telas de plano, saude, progresso, caderno e logs.
- `src/components/chat/`: chat, drawer de conversas, cards de permissao e revisao.
- `src/contexts/DocsContext.jsx`: leitura, persistencia e aplicacao de updates estruturados.

## Dependencias externas

- Node.js 24+.
- `ai-gateway` acessivel em `AI_GATEWAY_URL`.
- Caddy/reverse proxy apenas quando quiser servir em `/pt/` e `/api/pt/` fora do modo local.

## Setup rapido

```bash
npm install
npm run dev
```

Valores minimos para desenvolvimento:

- copie `.env.example` para `.env`

```env
AI_GATEWAY_URL=http://localhost:3500
PORT=3400
DATABASE_PATH=./data/personal-trainer.sqlite
CORS_ALLOWED_ORIGINS=http://localhost:5174
```

## Scripts

```bash
npm run dev           # Vite frontend
npm run server        # backend Express
npm start             # frontend + backend em paralelo
npm run build         # build do frontend
npm run lint          # ESLint
npm run test:run      # Vitest
npm run test:coverage # Vitest com cobertura
node manage.mjs start|stop|restart|status
```

## Fluxo local recomendado

1. Suba o `ai-gateway`.
2. Rode `npm install` se a arvore de dependencias mudou.
3. Em desenvolvimento, use `npm start` ou rode backend/frontend separadamente.
4. Para validar o caminho operacional da VPS, use `node manage.mjs start`.
5. Confira health em `http://localhost:3400/api/health`.

## Deploy e roteamento

`service.json` ja descreve o contrato esperado pelo manager da VPS:

- app: `http://localhost:3400`
- health: `http://127.0.0.1:3400/api/health`
- proxy app: `/pt* -> http://localhost:3400`
- proxy api: `/api/pt* -> http://localhost:3400/api`

O `manage.mjs start` roda build antes de subir o backend. Se o build falhar, o servico nao sobe.

## Testes

Cobertura atual combina tres niveis:

- rotas HTTP com `Supertest`
- servicos/utilitarios com `Vitest`
- contexto/view criticos com `@testing-library/react` + `jsdom`

Suites relevantes:

- `tests/routes/documents.test.js`
- `tests/routes/conversations.test.js`
- `tests/services/claude-service.test.js`
- `tests/contexts/docs-context.test.jsx`
- `tests/views/plano-view.test.jsx`

## PWA

A implementacao atual cobre apenas:

- `manifest.json`
- registro de `service worker`
- cache de assets estaticos e fallback offline basico

Nao existe fluxo de inscricao/envio de notificacao push no estado atual do repositorio.

## Mapa de documentacao

- `AGENTS.md`: regras operacionais para agentes.
- `STACK.md`: stack, arquitetura e contratos tecnicos.
- `DECISIONS.md`: decisoes estruturais estaveis.
- `HISTORY.md`: mudancas cronologicas relevantes.
- `template/`: materiais base da coach/persona e arquivos vivos iniciais.
