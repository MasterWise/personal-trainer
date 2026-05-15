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
- **Intent persistido (hotfix 2026-05-15)**: o doc do pending grava `autoAction`/`conversationType`/`planDate` como campos top-level (gravados em `firebasePendingRepository.createQueued`, expostos em `list`/`get` como `auto_action`/`conversation_type`/`plan_date`). Frontend envia esses 3 campos no POST `/claude` (`src/services/claudeService.js`). `usePendingRecovery.processPendingItem` deriva `planDateLock`/`allowPlanReplaceAll` desses metadados — sem isso, o caminho async perde a intent do "Novo plano"/"Gerar plano" entre o POST e o polling e drops `replace_all` legítimo.
- **Idempotencia Firebase**: o worker usa `responseId` como chave de task e `claimForProcessing` so chama IA quando o status esta `queued` ou `in_flight` antigo; retries nao devem duplicar chamada quando o item ja foi processado.
- **Endpoints novos**: `GET /api/claude/pending`, `GET /api/claude/pending/:id`, `POST /api/claude/pending/:id/ack`.
- **Frontend**: `src/hooks/usePendingRecovery.js` verifica pendentes no load, aplica mutations via `replayGuard.js` (pre-screening de idempotencia), e envia ack.
- **Session persist**: `conversations.cli_session_id` armazena o _sessionId do CLI bridge. Restaurado no load para manter --resume funcional apos page reloads.
- **Unificacao de sessao**: ChatTab agora recebe `cliSessionId` como prop de App.jsx ao inves de gerar UUID proprio.
- **In-flight state**: Lifecycle de 2 fases — `in_flight` (antes do gateway) → `pending` (apos resposta) → `processed` (apos ack) / `failed` (em caso de erro).
- **Polling**: `usePendingRecovery` faz polling a cada 5s enquanto houver itens `in_flight`. Frontend mostra loading dots e bloqueia input via prop `hasInFlight`.
- **conversationReady gate**: O hook espera `conversationReady` (alem de `docsReady` e `isAuthenticated`) para evitar race condition onde `currentConvoId` ainda e null.
- **Normalizacao de plano (hotfix 2026-05-15)**: `src/utils/planNormalize.js` expoe `normalizePlanDay(planDay)` (snake `nota_coach` -> camel `notaCoach`) e `normalizeNotePayload(noteData)` (alias `nota`/`note`/`nota_coach`). Aplicado em `DocsContext.applySingleUpdateToDocs` (replace_all + patch/append coach_note) e em `planUpdateGuard.lockPlanUpdateToDate` (antes de comparar e de retornar). Drops do guard agora passam por `dropUpdate(reason, update)` com `console.warn` estruturado (razões: `replace_all_payload_invalid_or_date_mismatch`, `replace_all_not_authorized`, `granular_payload_invalid`).
- **Testes**: `tests/routes/claude-pending.test.js`, `tests/utils/replay-guard.test.js`, `tests/hooks/use-pending-recovery.test.jsx`, `tests/utils/plan-normalize.test.js`.

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

## PWA (Sprint A - splendid-pinwheel)

- App instalavel em Chrome Android (botao "Instalar app") e Safari iOS (instrucao Compartilhar -> Adicionar a Tela de Inicio).
- **Manifest**: `public/manifest.json` com `id:"pt-coach"` estavel, `lang:"pt-BR"`, `dir:"ltr"`, `categories:[health,fitness,lifestyle]`, 4 entries de icones (SVG `any`, PNG-192 `any`, PNG-512 `any`, PNG-512 `maskable`). Paths usam placeholder `__BASE__` substituido em build pelo plugin Vite `pwaBaseTransform`.
- **Icones**: 4 PNGs gerados via Sharp a partir de `public/icons/icon.svg`. Rodar manualmente quando o SVG mudar:
  ```bash
  npm run icons:generate   # gera icon-192, icon-512, icon-512-maskable (safe-zone 80%), apple-touch-icon (180x180)
  ```
  Nao roda em prebuild para nao atrasar `npm run build` em todo CI run.
- **Service Worker v5** (`public/sw.js`): network-first com `clients.claim`, `APP_SHELL` inclui icones novos, `message` handler para `SKIP_WAITING`, broadcast `SW_UPDATED` em `activate` (so em upgrade — `oldCaches.length > 0`).
- **Registro do SW** (`index.html`): `register(..., { updateViaCache: "none" })` evita cache HTTP de 24h do proprio sw.js. Listener `message` dispara CustomEvent `pt:sw-updated` no window.
- **UpdateBanner** (`src/components/ui/UpdateBanner.jsx`): exibe "Nova versao disponivel — Atualizar" quando o evento dispara; clique chama `registration.waiting?.postMessage({type:"SKIP_WAITING"})` + `location.reload()`.
- **InstallButton** (`src/components/ui/InstallButton.jsx`): card discreto, renderizado em `SetupForm`/`LoginForm`/`RegisterForm` (telas antes do app denso). Hook `useInstallPrompt` captura `beforeinstallprompt`, detecta iOS/standalone, dismissa por 7 dias em `localStorage`.
- **Cache headers** (`firebase.json`): `/`, `/index.html`, `/manifest.json`, `/sw.js` com `no-cache`; `/icons/**` e `/assets/**` com `max-age=31536000, immutable` (bundle Vite tem hash no filename, eh seguro).
- **Revalidacao online (`index.html`)**: `registration.update()` eh chamado em 4 gatilhos enquanto a aba esta online — `window.focus`, `document.visibilitychange` voltando a visivel, evento `online`, e `setInterval` de 5 min. Garante que aba aberta por horas/dias detecta nova versao sem reload manual. `updatefound` + `statechange === "installed"` no client dispara `pt:sw-updated` assim que o novo SW entra em `waiting`, sem esperar `activate`.
- **Limitacoes em dev**: `vite dev` nao roda o plugin `pwaBaseTransform` (so em `build`). Por isso o manifest em dev serve com placeholder `__BASE__` literal e icones falham. PWA validation completa so faz sentido contra `vite build` + `vite preview` ou contra prod.
- **Push notifications: FORA DO ESCOPO** (DECISIONS 2026-04-12). Nao adicionar `web-push`/VAPID sem reabrir decisao.
- **Arquivos criticos**: `public/manifest.json`, `public/sw.js`, `public/icons/`, `scripts/generate-icons.mjs`, `vite.config.js` (plugin `pwaBaseTransform`), `index.html` (meta iOS + register), `src/hooks/useInstallPrompt.js`, `src/components/ui/InstallButton.jsx`, `src/components/ui/UpdateBanner.jsx`, `firebase.json` (headers).
- **Testes**: `tests/hooks/use-install-prompt.test.jsx`, `tests/components/install-button.test.jsx` (jsdom via `// @vitest-environment jsdom`).

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
