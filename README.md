# Personal Trainer

App de coaching pessoal com IA para rotina alimentar, plano diario, historico de conversas e documentos vivos da usuaria.

## Status atual

- Build, lint, testes e start local validados em 2026-04-12.
- Frontend servido em `/pt/`.
- API exposta em `/api/pt/` no proxy e em `/api/` no backend local.
- Integracao de IA feita exclusivamente via `ai-gateway`.
- Chat suporta anexos de imagem/camera e audio por `mediaRef`, sem persistir base64 no historico.
- Modo Firebase em implementacao: `FIREBASE_BACKEND=true` troca SQLite/sessoes locais por Firebase Auth, Firestore e Cloud Tasks, preservando o runtime SQLite como padrao local/VPS.
- Push notifications estao fora do escopo atual.

## O que o app faz hoje

- Setup/login com sessao Bearer persistida em SQLite.
- Chat com historico, arquivamento e reabertura de conversas.
- Anexos de imagem/camera e audio no composer, com upload privado antes de chamar a IA.
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
- Firebase Auth, Firestore, Functions, Hosting, Cloud Storage e Cloud Tasks quando `FIREBASE_BACKEND=true`.
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

Para staging Firebase, use `FIREBASE_BACKEND=true`, configure `VITE_FIREBASE_*`, `BOOTSTRAP_SECRET`, `AI_GATEWAY_URL` para a URL direta do gateway Firebase e `CLOUD_TASKS_*` para a fila/Function dedicada `claudeWorker`. Use `AI_MODEL=gemini-3-flash` ou omita `AI_MODEL` para herdar o default do app no gateway serverless. O worker deve chamar o gateway com OIDC (`AI_GATEWAY_AUTH_AUDIENCE`) e o bootstrap semeia documentos vazios por padrao (`FIREBASE_BOOTSTRAP_SEED=empty`). Mantenha `CLOUD_TASKS_INFLIGHT_STALE_MS` maior que o timeout real do gateway; o codigo aplica no minimo `1.5 * GATEWAY_TIMEOUT_MS`.

### Anexos multimodais

- Configure `PT_MEDIA_BUCKET` ou `FIREBASE_STORAGE_BUCKET` para o bucket privado usado pelo Firebase Admin SDK.
- O cliente envia imagem/camera e audio WAV para `/api/media/uploads`; o backend valida MIME/assinatura, tamanho, duracao WAV verificavel, grava em Cloud Storage e retorna apenas `mediaRef`.
- O historico/pendingResponses guarda metadados e `mediaRef`, nunca base64. O worker resolve `mediaRef` para `gs://...` apenas no payload enviado ao `ai-gateway`.
- `storage.rules` nega leitura/escrita direta do cliente. Remocao no composer chama `DELETE /api/media/uploads/:mediaRef`; a limpeza imediata tambem roda apos sucesso/falha terminal. Aplique `storage.lifecycle.json` no bucket e publique o TTL de `mediaUploads.expiresAt` em `firestore.indexes.json` para remover objetos/metadados antigos como defesa contra orfaos.
- Custos: imagem consome storage/transient e tokens multimodais; audio tambem cresce com duracao. Use `PT_MEDIA_*` para limitar bytes/duracao, quantidade/bytes pendentes por usuario, `TOKEN_BUDGET_*_COST_MICROS` para teto opcional por custo estimado e `COST_*_MICROS_PER_TOKEN` para calibrar a estimativa conforme o modelo/preco vigente.
- Lifecycle recomendado: `gcloud storage buckets update gs://$PT_MEDIA_BUCKET --lifecycle-file=storage.lifecycle.json`.

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
