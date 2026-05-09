# AGENTS.md - personal-trainer

## Proposito
- Este repositorio hospeda o app de coaching pessoal com IA, com backend em `3400`, frontend em `/pt/` e API exposta via `/api/pt/` no proxy.
- O `AGENTS.md` deste escopo deve ser lido como guia operacional e mapa de contexto; detalhes historicos e de decisoes ficam separados.

## Leituras obrigatorias
- Herda as politicas de [AGENTS.md](F:/GitProjects/vps-mw-aiserver/AGENTS.md), [projects/AGENTS.md](F:/GitProjects/vps-mw-aiserver/projects/AGENTS.md) e [projects/github/AGENTS.md](F:/GitProjects/vps-mw-aiserver/projects/github/AGENTS.md).
- Leia [README.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/README.md) antes de alterar escopo funcional, UX principal ou onboarding.
- Leia `STACK.md` antes de mexer em arquitetura, stack, docs model ou distribuicao de responsabilidades entre frontend e backend.
- Leia [DECISIONS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/DECISIONS.md) antes de alterar protocolo da IA, formato do plano, conversas ou persistencia de documentos.
- Leia [HISTORY.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/HISTORY.md) antes de revisitar correcoes de prompt, cache, gateway, plano ou UI do chat.

## Automatizacoes de progresso
- `src/utils/adherenceTriggers.js` — avalia dados de saude/treino e retorna triggers automaticos de progresso (conquistas e dificuldades).
- Regras ativas: adesao semanal >=90% (conquista), adesao <50% (dificuldade), novo menor peso em medidas (conquista).
- Deduplicacao por `date` + `type` + `context` evita entradas repetidas.
- Integrado em `App.jsx` via useEffect com debounce de 3s, dispara apos calculo do healthViewModel.
- Testes em `tests/utils/adherence-triggers.test.js`.

## Response Inbox (persistencia server-side de respostas da IA)
- **Problema resolvido**: Se o usuario saisse da tela enquanto a IA estava gerando resposta (1-5 min), a resposta era perdida e a CLI session ficava dessincronizada.
- **Solucao**: O backend (`routes/claude.js`) salva a resposta na tabela `pending_ai_responses` ANTES de devolver ao frontend. Se o frontend perder a resposta, recupera no proximo load.
- **Tabela**: `pending_ai_responses` (migration 007) — id, user_id, conversation_id, cli_session_id, response_raw, status, expires_at (24h TTL).
- **Modo Firebase**: `routes/firebaseClaude.js` cria `users/{uid}/pendingResponses/{responseId}` com `queued`, enfileira Cloud Task para a Function dedicada `claudeWorker` e retorna `202` rapidamente; `firebase/worker.js` processa a chamada ao gateway com OIDC, troca para `in_flight` e depois `pending`/`failed`.
- **Idempotencia Firebase**: o worker usa `responseId` como chave de task e `claimForProcessing` so chama IA quando o status esta `queued` ou `in_flight` antigo; retries nao devem duplicar chamada quando o item ja foi processado.
- **Endpoints novos**: `GET /api/claude/pending`, `GET /api/claude/pending/:id`, `POST /api/claude/pending/:id/ack`.
- **Frontend**: `src/hooks/usePendingRecovery.js` verifica pendentes no load, aplica mutations via `replayGuard.js` (pre-screening de idempotencia), e envia ack.
- **Session persist**: `conversations.cli_session_id` armazena o _sessionId do CLI bridge. Restaurado no load para manter --resume funcional apos page reloads.
- **Unificacao de sessao**: ChatTab agora recebe `cliSessionId` como prop de App.jsx ao inves de gerar UUID proprio.
- **In-flight state**: Lifecycle de 2 fases — `in_flight` (antes do gateway) → `pending` (apos resposta) → `processed` (apos ack) / `failed` (em caso de erro).
- **Polling**: `usePendingRecovery` faz polling a cada 5s enquanto houver itens `in_flight`. Frontend mostra loading dots e bloqueia input via prop `hasInFlight`.
- **conversationReady gate**: O hook espera `conversationReady` (alem de `docsReady` e `isAuthenticated`) para evitar race condition onde `currentConvoId` ainda e null.
- **Testes**: `tests/routes/claude-pending.test.js`, `tests/utils/replay-guard.test.js`.

## Token budget per-user (Sprint 3)

- Modulo `firebase/tokenBudget.js` aplica hard cap diario + mensal de tokens (input+output) por usuario. Default: `TOKEN_BUDGET_DAILY=500000` (~$0,05/dia em gemini-3-flash) e `TOKEN_BUDGET_MONTHLY=5000000`. Override por env. `TOKEN_BUDGET_ENABLED=false` desativa.
- Counters em `users/{uid}/tokenBudgets/daily_YYYYMMDD` e `monthly_YYYYMM` com `FieldValue.increment` atomico. TTL `expiresAt` em `firestore.indexes.json` limpa docs velhos (48h daily / 35d monthly).
- Pre-check em `routes/firebaseClaude.js` antes de `enqueueClaudeTask`. Quando estoura, retorna `429 + {code:"TOKEN_BUDGET_EXCEEDED", scope, resetAt, usage}` sem queimar quota Vertex. Fail-open em erro de leitura.
- Debito em `firebase/worker.js` apos `response.ok` do gateway, paralelo ao `firebaseAiLogsRepository.insert`. Inclui `cachedTokens` (cache_creation + cache_read).
- Endpoints:
  - `GET /api/token-budget` — self-service (usuario autenticado ve seu proprio budget).
  - `GET /api/admin/token-budget/:uid` — admin claim, ve qualquer usuario.
  - `POST /api/admin/token-budget/:uid/reset` — admin claim, body `{scope:"daily"|"monthly"}`.

## Pipeline CI/CD (Sprint 3)

- `.github/workflows/deploy.yml` — 4 jobs: `lint` + `test` em paralelo, `build` produz artefato `dist/`, `deploy` so em `main` via `environment: production` (required reviewer).
- Smoke pos-deploy bate `/api/health` validando `firestore && gateway`.
- Deploy seletivo `--only "hosting,firestore,functions:api,functions:claudeWorker"` para nao tocar a Function `gateway` que vive no sub-projeto `ai-gateway` (mesmo Firebase project).
- Setup manual obrigatorio:
  1. `firebase login:ci` localmente -> copiar token -> Settings > Secrets > Actions > criar `FIREBASE_TOKEN`.
  2. Settings > Environments > criar `production` com required reviewer.
  3. Settings > Branches > regra de protection em `main` exigindo checks `lint`, `test`, `build` verdes + 1 reviewer.

## Excecoes locais
- Preserve o acoplamento via ai-gateway para chamadas Claude; nao reintroduza chamadas diretas ao provider sem necessidade validada.
- Mudancas no protocolo de `plano`, docs ou updates da IA devem continuar compativeis com structured outputs e com os guards de permissao/escopo ja adotados.
- O frontend continua sob `/pt/`; ajustes de rota ou base path exigem revisar proxy, PWA e build.

## Operacao rapida
- Instalar dependencias: `npm install`
- Desenvolvimento: `npm run dev`
- Build: `npm run build`
- Servidor combinado: `npm start`
- Backend isolado: `npm run server`
- Lint: `npm run lint`
- Testes: `npm run test:run`
- Lifecycle local: `node manage.mjs start|stop|restart|status`
- Health checks:
  - `curl http://localhost:3400/api/health`
  - `curl http://localhost:8080/api/pt/health`

## Mapa de contexto
- [README.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/README.md): visao funcional e fluxos do produto.
- `STACK.md`: stack, arquitetura e setup tecnico.
- [DECISIONS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/DECISIONS.md): escolhas estruturais estaveis.
- [HISTORY.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/HISTORY.md): trilha cronologica de mudancas.
