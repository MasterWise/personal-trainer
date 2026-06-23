# STACK.md - Personal Trainer

Referencia tecnica do projeto Personal Trainer.
Use este arquivo para entender stack, arquitetura, contratos de execucao e limites do escopo atual.

## 1. Visao geral

| Camada | Tecnologia | Observacao |
|---|---|---|
| Runtime | Node.js 24+ | ESM obrigatorio |
| Backend | Express 4 | `app.js` + `server.js` |
| Frontend | React 18 | JSX puro, sem TypeScript |
| Build | Vite 6 + plugin React | base path `/pt/` |
| Banco | SQLite nativo (`node:sqlite`) / Firestore | SQLite e padrao local/VPS; Firestore entra com `FIREBASE_BACKEND=true` |
| Testes | Vitest + Supertest + Testing Library + jsdom | node por padrao, jsdom para UI/contexto |
| IA | `ai-gateway` | Claude via proxy, nunca direto do frontend |

## 2. Topologia da aplicacao

- Backend local: porta `3400` por padrao.
- Frontend no proxy: `/pt/`.
- API no proxy: `/api/pt/`.
- Rewrite interno: `/api/pt/* -> /api/*` em `app.js` para permitir acesso direto sem Caddy.

## 3. Backend

### Entry points

- `server.js`: bootstrap HTTP e `listen(PORT)`.
- `app.js`: factory `createApp(options)` usada por runtime e testes.

### Middleware principal

Ordem atual:

1. `helmet`
2. CORS com allowlist via `CORS_ALLOWED_ORIGINS`
3. `express.json({ limit: "10mb" })`
4. rewrite `/api/pt`
5. rate limit global em `/api`
6. rate limit de login em `/api/auth/login`

### Rotas

- `routes/health.js`
- `routes/auth.js`
- `routes/documents.js`
- `routes/conversations.js`
- `routes/claude.js`

### Integracao com IA

- O frontend envia `system`, `messages`, `output_config` e `interaction_context` para `POST /api/claude`.
- O backend traduz isso para o contrato do `ai-gateway` em `AI_GATEWAY_URL`.
- Structured output usa JSON Schema gerado em `src/services/claudeSchema.js`.
- Sessao de CLI bridge usa `_sessionId` estavel para reduzir custo de contexto nos resumes.

### Banco e persistencia

- SQLite sincronizado por `db/index.js`.
- Migrations numeradas em `db/migrations/*.sql`.
- Documentos por usuario ficam na tabela de docs e sao expostos pelas rotas `/api/documents`.
- `seedDefaults.js` cria o pacote inicial de documentos da Renata no primeiro setup/restore.
- Em modo Firebase, `firebase/repositories.js` recria users, documents, conversations, aiLogs, invites, rateLimits e pendingResponses em Firestore, com seeds vindos de `db/defaultDocuments.js`.
- Em modo Firebase, conversas atuais e versoes de plano usam documentos determinísticos em `users/{uid}/_state` dentro de transações para preservar unicidade sob concorrencia.
- Em modo Firebase, `POST /api/claude` e assincrono: cria `pendingResponses`, enfileira Cloud Tasks para a Function dedicada `claudeWorker` e o worker atualiza o status apos chamar o gateway com OIDC.

### Documentos vivos

Chaves persistidas hoje:

- `micro`
- `mem`
- `hist`
- `plano`
- `progresso`
- `cal`
- `treinos`
- `perfil`
- `macro`

## 4. Frontend

### Provider tree real

```text
ThemeProvider
  AuthProvider
    DocsProvider
      ToastProvider
        App
```

### Principios atuais

- Sem React Router; navegacao por abas em estado local.
- Sem TypeScript.
- Sem biblioteca externa de UI.
- Feature-first em componentes, contexts e views.
- Tokens e temas via CSS variables + objetos JS.

### Views principais

- `Chat`
- `Plano`
- `Saude`
- `Progresso`
- `Caderno`
- `Perfil`
- `Logs`

### Fluxos centrais

- Criacao de conta/login.
- Carregamento de documentos no `DocsContext`.
- Conversa geral e conversa de plano.
- Geracao, edicao e nova versao de plano por data.
- Marcacao de itens do plano com reflexo em calorias/treinos.
- Revisao e reversao de updates aplicados pela IA.

## 5. Modelo de plano e guard rails

### Formato do plano

`plano` e salvo como dicionario por data (`DD/MM/AAAA`). Cada dia contem:

- `date`
- `meta`
- `grupos[]`
- `notaCoach` opcional

### Regras importantes

- Conversas de plano ficam presas a uma data (`planScopeDate`).
- `replace_all` em `plano` so pode ocorrer em geracao automatica (`generate_plan` ou `new_plan`).
- Updates granulares (`append_item`, `patch_item`, `delete_item`) respeitam ownership de itens marcados.
- Mutacao de item marcado pela usuaria pode exigir permissao explicita.
- Cards de revisao agrupam alteracoes repetidas do mesmo arquivo.

Arquivos-chave:

- `src/utils/planUpdateGuard.js`
- `src/utils/planPermissionGuard.js`
- `src/utils/planItemOwnership.js`
- `src/utils/revisionDiff.js`

## 6. Design system

### Tipografia e tema

- Fonte de interface: `DM Sans`.
- Fonte de destaque: `Playfair Display`.
- Tema padrao: `warm`.
- Tema alternativo: `dark`.

### Tokens

- CSS vars em `src/styles/tokens.css`
- Objetos JS em `src/styles/tokens.js`
- Temas em `src/styles/themes.js`

### Layout

- Mobile-first.
- Header fixo.
- Bottom nav fixa.
- Largura maxima controlada por `--pt-app-max-width`.

## 7. PWA

Escopo implementado hoje:

- `public/manifest.json`
- registro de `service worker` em `index.html`
- cache de assets estaticos em `public/sw.js`
- API sempre network-only

Fora do escopo atual:

- push notifications
- subscriptions
- VAPID
- envio server-side de notificacoes

## 8. Testes

### Ferramentas

- `Vitest`: runner principal
- `Supertest`: testes HTTP
- `@testing-library/react`: testes de view/contexto
- `@testing-library/user-event`: interacoes de UI
- `jsdom`: ambiente browser para testes `.jsx`
- `@vitest/coverage-v8`: cobertura

### Configuracao

`vitest.config.js`:

- plugin React habilitado
- alias `sqlite -> node:sqlite`
- `environment: "node"` por padrao
- suites `.jsx` usando `// @vitest-environment jsdom`
- `setupFiles: ["tests/setup/test-env.js"]`
- `fileParallelism: false`

### Cobertura critica recomendada

- rotas: auth, documents, conversations, health, claude
- servicos: parser/schema/claude-service/guards/diffs
- contexto: `DocsContext`
- views: `PlanoView`

## 9. Dependencias atuais

### Producao

| Pacote | Uso |
|---|---|
| `express` | servidor HTTP |
| `cors` | CORS |
| `helmet` | headers de seguranca |
| `express-rate-limit` | rate limiting |
| `dotenv` | env vars |
| `react` | UI |
| `react-dom` | renderizacao |

### Desenvolvimento

| Pacote | Uso |
|---|---|
| `vite` | build e dev server |
| `@vitejs/plugin-react` | transform JSX |
| `vitest` | testes |
| `@vitest/coverage-v8` | cobertura |
| `supertest` | testes HTTP |
| `@testing-library/react` | testes de componentes/contexto |
| `@testing-library/user-event` | eventos de UI |
| `jsdom` | ambiente DOM para testes |
| `eslint` | lint |
| `concurrently` | frontend + backend em paralelo |

## 10. Scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "server": "node server.js",
  "start": "concurrently \"npm run server\" \"npm run dev\"",
  "lint": "eslint . --max-warnings=0",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

## 11. Configuracao e ambiente

### Variaveis de ambiente suportadas

```env
AI_GATEWAY_URL=http://localhost:3500
GATEWAY_TIMEOUT_MS=500000
REASONING_EFFORT=low
MAX_INPUT_TOKENS=200000
MAX_OUTPUT_TOKENS=64000
PORT=3400
DATABASE_PATH=./data/personal-trainer.sqlite
FIREBASE_BACKEND=false
FIREBASE_FUNCTIONS_REGION=southamerica-east1
FUNCTIONS_API_SERVICE_ACCOUNT=
FUNCTIONS_CLAUDE_WORKER_SERVICE_ACCOUNT=
AI_MODEL=
VITE_API_BASE_URL=/api/pt
BOOTSTRAP_SECRET=
FIREBASE_BOOTSTRAP_SEED=empty
CLOUD_TASKS_INFLIGHT_STALE_MS=600000
AI_GATEWAY_AUTH_AUDIENCE=
AI_GATEWAY_AUTH_DISABLED=false
CORS_ALLOWED_ORIGINS=http://localhost:5174
CSP_REPORT_ONLY=false
RATE_LIMIT_GLOBAL_MAX=60
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_CLAUDE_MAX=10
RATE_LIMIT_CLAUDE_WINDOW_MS=300000
```

No modo Firebase, `CLOUD_TASKS_INFLIGHT_STALE_MS` e tratado como piso configuravel: o repository aplica no minimo `1.5 * GATEWAY_TIMEOUT_MS` antes de reprocessar um item `in_flight`. A colecao top-level `rateLimits` usa `expiresAt` como `Date` e tem TTL declarada em `firestore.indexes.json`.

### Vite

- `base: "/pt/"`
- proxy de `/api/pt` para `http://localhost:3400`
- `build.outDir = "dist"`
- sourcemap habilitado

### Service manager

`service.json` define:

- build obrigatorio antes do start
- `healthUrl` em `http://127.0.0.1:3400/api/health`
- rotas Caddy para `/pt*` e `/api/pt*`

`manage.mjs` oferece:

- `start`
- `stop`
- `restart`
- `status`
- menu interativo quando executado em TTY

## 12. Estrutura relevante

```text
personal-trainer/
├── app.js
├── server.js
├── manage.mjs
├── service.json
├── db/
├── middleware/
├── routes/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   ├── contexts/
│   ├── data/
│   ├── services/
│   ├── styles/
│   ├── utils/
│   └── views/
├── public/
├── template/
└── tests/
```

## 13. Convencoes de implementacao

- Modulos ESM.
- Indentacao de 2 espacos.
- Aspas duplas.
- Feature-first.
- Structured output com JSON Schema para respostas da IA.
- Segredos fora do repositorio; `.env.example` so como template.
- Mudancas em `/pt/` precisam considerar frontend, build, proxy e service worker.
