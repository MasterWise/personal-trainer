# AGENTS.md — Personal Trainer (Coach App)

## Visão Geral

App de coaching pessoal com IA (Claude) para acompanhamento nutricional e de treinos. Frontend React + Vite, backend Express + SQLite, tema quente (warm) como padrão com toggle dark mode.

**Porta**: 3400 (backend) | 5174 (Vite dev)
**Base URL**: `/pt/` (frontend) | `/api/pt/` (API via Caddy) | `/api/` (acesso direto)

## Stack

- **Runtime**: Node.js 24+ ESM
- **Backend**: Express 4.x com factory pattern (`createApp()`)
- **Frontend**: React 18.3 JSX (sem TypeScript, sem React Router)
- **Build**: Vite 6.x (base `/pt/`)
- **DB**: SQLite via `node:sqlite` (DatabaseSync)
- **IA**: Claude Sonnet 4 via backend proxy (`/api/claude`) com structured outputs (JSON schema enforced)
- **Testes**: Vitest + Supertest
- **PWA**: manifest.json + service worker

## Comandos

```bash
npm install          # Dependências
npm run dev          # Vite dev + backend concorrente
npm run build        # Build de produção (Vite)
npm start            # Servidor Express (produção, porta 3400)
npm run server       # Apenas backend Express
npm test             # Vitest (watch)
npm run test:run     # Vitest (single run)
npm run lint         # ESLint
```

## Arquitetura

### Backend

```
server.js              → Entrypoint, escuta na PORT
app.js                 → Factory createApp() com middleware stack
middleware/
  auth.js              → generateId, hashPassword, verifyPassword, authMiddleware
  security.js          → Rate limiters (global, login, claude)
db/
  index.js             → SQLite, migrations, prepared statements
  migrations/001.sql   → Schema inicial
  seedDefaults.js      → Seed dos dados da Renata no primeiro setup
routes/
  health.js            → GET /api/health
  auth.js              → Setup, login, logout, me
  claude.js            → Proxy para Anthropic API
  documents.js         → CRUD de documentos do usuário
  conversations.js     → Gerenciamento de conversas (current + archived)
```

### Frontend

```
src/
  main.jsx             → Entry: window.storage, auth token, providers
  App.jsx              → Router por tabs, auth flow, chat state
  contexts/
    ThemeContext.jsx    → Tema warm/dark, CSS variables
    AuthContext.jsx     → Login, signup, logout, session
    DocsContext.jsx     → 9 documentos, load/save via API
    ToastContext.jsx    → Notificações toast
  services/
    api.js             → REST client (get, post, put, del)
    claudeService.js   → sendMessage() com structured output + extended thinking
  components/
    chat/              → ChatTab, ChatMsg, ChatBubbleContent, UpdateCard, PermCard, ConvoDrawer
    layout/            → Header, TabBar
    ui/                → Field, MD (markdown renderer), MacroBar
    perfil/            → PerfilTab (editor completo)
  views/
    PlanoView.jsx      → Plano interativo (checkboxes, nutri, auto-sync)
    SaudeView.jsx      → Dashboard calorias + treinos
    MarcosView.jsx     → Timeline de marcos
    HistView.jsx       → Histórico com stats
  data/
    constants.js       → INIT_*, mappings, TABS, DIAS
    prompts.js         → buildPrompt(docs) — system prompt completo
  utils/
    formatters.js      → renderInline() para *bold*
  styles/
    tokens.css         → CSS variables --pt-*
    tokens.js          → Design tokens object
    themes.js          → Warm (default) + Dark
    index.css          → Reset, fonts, animations
    components/        → app-shell, header, bottom-nav, chat CSS
```

## Modelo de Dados

### Tabelas SQLite

| Tabela | Descrição |
|---|---|
| `users` | id, name, password_hash, is_admin, timestamps |
| `sessions` | id, user_id, expires_at, created_at |
| `user_documents` | (user_id, doc_key) PK, content, updated_at |
| `conversations` | id, user_id, messages (JSON), preview, message_count, is_current |

### Documentos (9 doc_keys)

| Key | Tipo | Descrição |
|---|---|---|
| `micro` | Markdown | Perfil operacional — rotina de fome, preferências |
| `mem` | Markdown | Memória do coach — insights profissionais |
| `hist` | Markdown | Histórico — dados e medições |
| `plano` | JSON | Plano interativo do dia — grupos, itens checkáveis, nutri |
| `marcos` | JSON array | Marcos — conquistas e momentos |
| `cal` | JSON object | Controle calórico — meta_diaria + dias |
| `treinos` | JSON object | Treinos — planejados + registros |
| `perfil` | JSON object | Perfil estruturado — dados corporais, metas, limitações |
| `macro` | Markdown | Contexto macro — quem é a pessoa, objetivos |

## Endpoints API

### Auth
- `GET /api/auth/status` → `{ needsSetup: bool }`
- `POST /api/auth/setup` → `{ name, password }` → `{ token, user }`
- `POST /api/auth/login` → `{ name, password }` → `{ token, user }`
- `POST /api/auth/logout` → (auth) → `{ ok: true }`
- `GET /api/auth/me` → (auth) → `{ user }`

### Documents
- `GET /api/documents` → (auth) → `{ documents: { key: content } }`
- `GET /api/documents/:key` → (auth) → `{ content }`
- `PUT /api/documents/:key` → (auth) `{ content }` → `{ ok: true }`
- `PUT /api/documents` → (auth) `{ documents: { key: content } }` → batch upsert

### Claude
- `POST /api/claude` → (auth) `{ model, max_tokens, messages, system, thinking?, output_config? }` → proxy response

### Conversations
- `GET /api/conversations` → (auth) → archived conversations
- `GET /api/conversations/current` → (auth) → `{ messages, id }`
- `PUT /api/conversations/current` → (auth) `{ messages }` → save current
- `POST /api/conversations/archive` → (auth) → archive current
- `DELETE /api/conversations/:id` → (auth) → delete archived

### Health
- `GET /api/health` → `{ status, timestamp }`

## Protocolo IA

### Structured Outputs (JSON Schema)

O Claude é chamado com `output_config.format` = `json_schema`, garantindo que a resposta é sempre JSON válido via constrained decoding (sem necessidade de parsing manual ou extractJson). O schema é definido em `claudeService.js` como `RESPONSE_SCHEMA`.

Formato da resposta:

```json
{
  "reply": "Texto da resposta ao usuário",
  "updates": [
    {
      "file": "plano",
      "action": "replace_all",
      "content": "conteúdo completo (sempre string, nunca objeto)",
      "requiresPermission": false,
      "permissionMessage": ""
    }
  ]
}
```

Tipos de `file`: micro, memoria, historico, plano, marcos, calorias, treinos
Tipos de `action`: append, replace_all, add_marco

**Notas importantes:**
- `content` é sempre `type: "string"` no schema — JSON aninhado (plano, cal, treinos) é serializado como string
- Structured outputs são compatíveis com extended thinking
- Structured outputs são incompatíveis com message prefilling (não usar)
- Updates com `requiresPermission: true` mostram um PermCard ao usuário antes de aplicar

### Plano Interativo (JSON)

O documento `plano` usa formato JSON estruturado com checkboxes interativos:

```json
{
  "date": "22/02/2026",
  "meta": { "kcal": 1450, "proteina_g": 115, "carbo_g": 110, "gordura_g": 45 },
  "grupos": [
    {
      "nome": "Manhã",
      "emoji": "🌅",
      "itens": [
        { "id": "m1", "tipo": "alimento", "texto": "1 banana", "checked": false, "nutri": { "kcal": 89, "proteina_g": 1, "carbo_g": 23, "gordura_g": 0.3 } },
        { "id": "m2", "tipo": "outro", "texto": "Água 500ml", "checked": false }
      ]
    },
    {
      "nome": "Treino",
      "emoji": "🏋️",
      "itens": [
        { "id": "t1", "tipo": "treino", "texto": "Pilates 1h", "checked": false, "treino_tipo": "Pilates", "duracao_min": 60 }
      ]
    }
  ]
}
```

**Tipos de item**: `alimento` (com `nutri`), `treino` (com `treino_tipo` + `duracao_min`), `outro`

**Auto-sync**: Ao marcar um item no PlanoView:
- `alimento` → atualiza doc `cal` (soma/subtrai macros do dia)
- `treino` → atualiza doc `treinos` (adiciona/remove registro)

**Tracking 3 colunas**: DaySummaryCard mostra Necessárias (meta) vs Planejadas (soma total) vs Realizadas (soma checked)

**Fallback**: Se `plano` é markdown (formato antigo), PlanoView renderiza via `<MD />` com mensagem para gerar novo plano interativo.

## Design System

- **Tema quente**: bg `#F7F2EC`, primary `#B87850`, text `#2C1A0E`
- **Tema escuro**: bg `#1A1210`, primary `#D4956A`, text `#F5E8DD`
- **Fontes**: DM Sans (body) + Playfair Display (headings)
- **CSS Variables**: prefixo `--pt-*` (setadas pelo ThemeContext)
- **Max width**: 430px (mobile-first)

## Decisões Técnicas

| Decisão | Motivo |
|---|---|
| Inline styles + CSS classes | Compatibilidade com tema dinâmico + CSS variables |
| window.storage abstraction | Permite fallback localStorage quando offline |
| Backend proxy para Claude | Proteger API key, rate limiting, logging |
| Extended thinking habilitado | Melhor qualidade de resposta para coaching |
| Structured outputs (json_schema) | Garante JSON válido sem parsing manual |
| Plano como JSON interativo | Checkboxes, nutri, auto-sync cal/treinos |
| 9 documentos separados | Granularidade de edição e persistência |
| is_current flag em conversations | Separa conversa ativa de arquivadas |
| Seed defaults no setup | Primeiro usuário já tem contexto da Renata |

## Registro recente

- Em 23/02/2026 foi adicionado parser resiliente de respostas Claude no frontend (`src/services/claudeResponseParser.js`), compartilhado entre chat e geração de plano. Ele aceita `content` com `text` (JSON string) e `output_json`, classifica erros de formato (`NO_TEXT_BLOCK`) e diferencia JSON truncado por `stop_reason = max_tokens`.
- Em 23/02/2026 o backend passou a logar `stop_reason` e `content_types` nas respostas da Anthropic e o debug parser de `ai_logs` foi ajustado para também entender `output_json`, evitando falhas silenciosas de observabilidade.
- Em 23/02/2026 foi adicionada mitigação no backend para `claude-sonnet-4-6`: quando uma resposta com structured output chega somente com bloco `thinking` (sem `text`/`output_json`), o servidor faz retry automático uma vez sem `thinking` antes de responder ao frontend.
- Em 23/02/2026 o backend passou a desabilitar `thinking` por padrão em chamadas com structured output (configurável via `CLAUDE_DISABLE_THINKING_FOR_STRUCTURED_OUTPUT=false`) para reduzir casos de resposta `thinking` sem payload final no `claude-sonnet-4-6`.
- Em 23/02/2026 foi adicionado timeout explícito para chamadas à Anthropic (`CLAUDE_REQUEST_TIMEOUT_MS`, padrão 120000ms) com resposta `504` amigável em vez de `500` genérico quando ocorrer `UND_ERR_HEADERS_TIMEOUT`.
- Em 23/02/2026 o Express passou a configurar `trust proxy = 1` em produção (Caddy/ngrok) para compatibilidade com `express-rate-limit` quando houver `X-Forwarded-For`.
- Em 23/02/2026 o frontend passou a enviar um `assistant` context message em toda interação (`src/services/claudeService.js`) com envelope `<interaction_context>`, incluindo `<runtime_context>` (`timezone` + `now`, America/Sao_Paulo) e `<memory_context>` (snapshot dinâmico), além de normalizar `messages[*].content` para blocos tipados `{ type: "text" }` antes do proxy `/api/claude`, mantendo o `system` separado.
- Em 23/02/2026 as conversas passaram a suportar metadata persistida de tipo (`general`/`plan`) e versionamento por data de plano (`plan_date`, `plan_version`, `plan_thread_key`, `origin_action`) com migration `003_conversation_metadata.sql`. Novas rotas em `routes/conversations.js`: `POST /api/conversations/activate`, `POST /api/conversations/plan/start`, `GET /api/conversations/plan/latest`, `GET /api/conversations/plan/history`.
- Em 23/02/2026 a aba Plano ganhou fluxo `Gerar plano`/`Editar plano`/`Novo plano`: `Gerar` só aparece quando não há plano para a data; quando há, vira splitbutton (`Editar plano` + `Novo plano`) e histórico de versões fica em drawer separado. Versões antigas de conversas de plano abrem em modo somente leitura no chat.
- Em 23/02/2026 a seleção de plano relevante por conversa foi centralizada em `buildRelevantPlanContext()` (`src/data/prompts.js`) e também refletida no `assistant` context message em `<conversation_context>` + `<plan_context>`; posteriormente essa seleção foi estendida para janela histórica/futura (até 30+30) mantendo escopo por data de referência.
- Em 23/02/2026 o fluxo automático de `Gerar plano` / `Novo plano` deixou de exibir o prompt técnico como mensagem visível da usuária: a intenção passou a seguir por contexto invisível (`<action_context>` no `assistant` context message + instrução curta API-only), com badge/loading contextual (“Gerando plano...”) e sem rotular como “Editando” durante a geração inicial.
- Em 23/02/2026 o contexto de planos enviado à LLM passou a incluir janela de referência com até 30 planos anteriores e 30 planos futuros (quando existirem), além do plano-alvo da data da conversa. A lógica está centralizada em `buildRelevantPlanContext()`/`buildSystemContext()` (`src/data/prompts.js`) e exposta em `<plans_context_window>` no XML de contexto.
- Em 23/02/2026 o dropdown do splitbutton da aba Plano (`Editar plano`/`Novo plano`) foi ajustado para não ser recortado pelo header: `PlanHeader` passou a usar `overflow: visible` e `z-index` próprio, e o menu absoluto recebeu `z-index` maior para sobrepor corretamente os cards abaixo.
- Em 23/02/2026 o splitbutton da aba Plano recebeu a ação `Remover plano` com modal de confirmação. A remoção exclui apenas o plano da data selecionada dentro do documento `plano` (dict por data), persiste via `saveDoc("plano", ...)` e mantém os demais dias intactos.

- Em 27/02/2026 o drawer `Histórico de versões` da aba Plano deixou de usar container fullscreen e backdrop escuro: `PlanHistoryDrawer` foi simplificado para painel fixo flutuante no topo (`src/views/PlanoView.jsx`), evitando empurrar o conteúdo para baixo e eliminando o “quadro escuro” observado em runtime.
- Em 27/02/2026 o service worker da PWA teve rotação de cache (`public/sw.js`: `pt-coach-v1` → `pt-coach-v2`) para reduzir risco de servir bundles antigos após mudanças de UI.
- Em 27/02/2026 o menu `Histórico` do chat também foi migrado de bottom-sheet fullscreen com backdrop para painel flutuante no topo (`src/components/chat/ConvoDrawer.jsx`), e o wrapper fullscreen antigo foi removido de `src/App.jsx`.
- Em 27/02/2026 o `ConvoDrawer` passou a ordenar as conversas por timestamp decrescente (`Date.parse(date)`), garantindo “mais recentes no topo” independente da ordem recebida da API.
- Em 27/02/2026, ao clicar em `Gerar plano` sem plano ativo na data selecionada, o app passou a iniciar conversa em modo `new_plan` (mesmo que já exista histórico daquela data), evitando bloqueio por “conversa já existente” após remoção de plano (`src/App.jsx`). Nesse estado sem plano, o splitbutton também mantém acesso ao `Histórico de versões` (`src/views/PlanoView.jsx`).
- Em 27/02/2026 o `ChatTab` deixou de exibir o bloco de boas-vindas (`Olá` + quick actions) durante geração automática de plano e em conversas de plano vazias; o card agora aparece apenas no chat geral sem mensagens (`src/components/chat/ChatTab.jsx`).
- Em 27/02/2026 foi adicionada trava de escopo por data para updates de `plano` em conversas de plano: os updates agora são normalizados para a data-alvo da conversa antes de aplicar (`src/utils/planUpdateGuard.js`, integrado em `src/App.jsx` e `src/components/chat/ChatTab.jsx`), impedindo alterações acidentais em outros dias. Também foi reforçada a instrução no prompt (`src/data/prompts.js`) e criado teste unitário (`tests/services/plan-update-guard.test.js`).
- Em 27/02/2026 o structured output da IA passou a usar schema dinâmico por interação (`src/services/claudeSchema.js`, consumido por `src/services/claudeService.js`): em conversas de plano, `planScopeDate` e `updates[*].targetDate` tornam-se obrigatórios e fixos na data-alvo (enum de valor único), reforçando “uma data por vez” para alterações de plano. Cobertura adicionada em `tests/services/claude-schema.test.js`.
- Em 27/02/2026 foi adicionado `append_coach_note` para atualizações focadas de nota diária no plano (`src/contexts/DocsContext.jsx`, `src/services/claudeSchema.js`, `src/data/prompts.js`). O guard de plano (`src/utils/planUpdateGuard.js`) também passou a converter `replace_all` em `patch_coach_note`/`append_coach_note` quando detectar que a única mudança foi em `notaCoach`, evitando reescrita completa desnecessária do plano.
- Em 27/02/2026 o `replace_all` para `file="plano"` foi bloqueado nas conversas de chat/edição (schema + runtime guard) e mantido apenas para ações automáticas de geração (`autoAction: generate_plan/new_plan`). Isso reduz reescritas completas acidentais durante ajustes finos, preservando a geração inicial de plano.
- Em 27/02/2026 os cards de revisão do chat passaram a exibir diff real de trecho alterado (`src/components/chat/UpdateCard.jsx` + `src/utils/revisionDiff.js`): para `append`, mostra apenas o conteúdo adicionado; para demais ações, mostra somente a janela alterada (com contexto colapsado). Cobertura em `tests/services/revision-diff.test.js`.
- Em 27/02/2026 o diff dos cards de revisão foi refinado para JSON: antes de comparar, o app normaliza payloads JSON (parse + ordenação estável + pretty print), eliminando trechos com escape e tornando visível apenas o campo realmente alterado em updates de plano/memória (`src/utils/revisionDiff.js`).
- Em 27/02/2026 foi implementado controle de ownership de itens marcados no plano: updates da IA (`append_item`, `patch_item`, `delete_item`, `replace_all`) agora só podem mutar item `checked` quando `checked_source="ai"` (`src/utils/planItemOwnership.js`, `src/contexts/DocsContext.jsx`), enquanto interações do usuário no checkbox passam a gravar `checked_source="user"` ao marcar (`src/App.jsx`).
- Em 27/02/2026, mutações de IA em itens `checked` pelo usuário passaram a exigir aprovação explícita no chat: updates `patch_item`/`delete_item` nesses itens são convertidos para fluxo de permissão com card estruturado (title/message/details/botões), suporte a agrupamento por `permissionGroupId` e aplicação local dos updates aprovados sem nova chamada à LLM (`src/utils/planPermissionGuard.js`, `src/components/chat/ChatTab.jsx`, `src/components/chat/PermCard.jsx`, `src/services/claudeSchema.js`, `src/data/prompts.js`).
- Em 27/02/2026 os cards de revisão do chat passaram a consolidar alterações repetidas por arquivo (`file`) em um único card por mensagem, mesmo quando houver múltiplas actions (ex.: `patch_item` + `append_item` no `plano`), com contador e diff por item dentro do card; o botão de reversão reverte o grupo em ordem reversa para manter consistência de snapshots (`src/utils/groupRevisions.js`, `src/components/chat/ChatMsg.jsx`, `src/components/chat/UpdateCard.jsx`, `tests/services/group-revisions.test.js`).
- Em 27/02/2026 os subtítulos dos cards de revisão deixaram de expor nomes técnicos de ações internas (`update_calorias_day`, `patch_item`, etc.): `UpdateCard` passou a mapear todas as actions para rótulos amigáveis em PT-BR e usar fallback genérico “Atualizado” (`src/components/chat/UpdateCard.jsx`).

## Dados Padrão (Seed)

O primeiro usuário criado via `/api/auth/setup` recebe automaticamente os 9 documentos preenchidos com o perfil da Renata (dados nutricionais, treinos, metas, limitações físicas). Esses dados servem como exemplo e podem ser editados na aba Perfil.
