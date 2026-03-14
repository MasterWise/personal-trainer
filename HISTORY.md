# HISTORY.md - personal-trainer

## Como usar
- Este arquivo registra mudancas cronologicas relevantes do projeto.
- Para regras operacionais, consulte [AGENTS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/AGENTS.md).
- Para racional tecnico estavel, consulte [DECISIONS.md](F:/GitProjects/vps-mw-aiserver/projects/github/personal-trainer/DECISIONS.md).

## Linha do tempo
- 2026-02-23 - Parser resiliente de respostas Claude no frontend (`src/services/claudeResponseParser.js`), compartilhado entre chat e geracao de plano. Aceita `content.text` e `output_json`, classifica `NO_TEXT_BLOCK` e diferencia JSON truncado por `stop_reason = max_tokens`.
- 2026-02-23 - Backend passou a logar `stop_reason` e `content_types` das respostas Anthropic; parser de `ai_logs` foi ajustado para entender `output_json`.
- 2026-02-23 - Mitigacao para `claude-sonnet-4-6`: se structured output vier so com bloco `thinking`, o backend faz um retry sem `thinking`.
- 2026-02-23 - `thinking` passou a ficar desabilitado por padrao em chamadas com structured output (`CLAUDE_DISABLE_THINKING_FOR_STRUCTURED_OUTPUT=false` reabilita).
- 2026-02-23 - Timeout explicito para Anthropic (`CLAUDE_REQUEST_TIMEOUT_MS`, padrao 120000ms) com resposta `504` amigavel para `UND_ERR_HEADERS_TIMEOUT`.
- 2026-02-23 - Express passou a configurar `trust proxy = 1` em producao para conviver com `express-rate-limit` sob Caddy/ngrok.
- 2026-02-23 - Frontend passou a enviar `assistant` context message com `<interaction_context>`, `<runtime_context>` e `<memory_context>`, alem de normalizar `messages[*].content` para blocos `{ type: "text" }`.
- 2026-02-23 - Conversas passaram a suportar metadata persistida de tipo (`general`/`plan`) e versionamento por data de plano (`plan_date`, `plan_version`, `plan_thread_key`, `origin_action`).
- 2026-02-23 - Aba Plano ganhou fluxo `Gerar plano` / `Editar plano` / `Novo plano`, com historico de versoes em drawer dedicado.
- 2026-02-23 - Selecionador de plano relevante foi centralizado em `buildRelevantPlanContext()` e depois ampliado para janela historica/futura de ate 30+30.
- 2026-02-23 - Fluxo automatico de `Gerar plano` / `Novo plano` deixou de mostrar o prompt tecnico como mensagem visivel da usuaria.
- 2026-02-23 - Contexto de planos enviado a LLM passou a incluir janela de referencia com ate 30 planos anteriores e 30 futuros.
- 2026-02-23 - Dropdown do splitbutton da aba Plano foi ajustado para nao ser recortado pelo header.
- 2026-02-23 - Acao `Remover plano` passou a excluir apenas a data selecionada dentro do documento `plano`.
- 2026-02-27 - Drawer `Historico de versoes` da aba Plano saiu do fullscreen com backdrop escuro e virou painel flutuante.
- 2026-02-27 - Service worker da PWA rotacionou cache de `pt-coach-v1` para `pt-coach-v2`.
- 2026-02-27 - Menu `Historico` do chat tambem saiu do bottom-sheet fullscreen e virou painel flutuante.
- 2026-02-27 - `ConvoDrawer` passou a ordenar conversas por timestamp decrescente.
- 2026-02-27 - `Gerar plano` sem plano ativo passou a iniciar conversa em modo `new_plan`, sem bloquear por conversa anterior da mesma data.
- 2026-02-27 - `ChatTab` deixou de exibir card de boas-vindas durante geracao automatica de plano e em conversas de plano vazias.
- 2026-02-27 - Foi adicionada trava de escopo por data para updates de `plano` (`src/utils/planUpdateGuard.js`) e criado teste unitario.
- 2026-02-27 - Structured output passou a usar schema dinamico por interacao, exigindo `planScopeDate` e `updates[*].targetDate` em conversas de plano.
- 2026-02-27 - Foi adicionado `append_coach_note` para updates focados na nota diaria do plano, com conversao inteligente de `replace_all`.
- 2026-02-27 - `replace_all` para `file="plano"` foi bloqueado em conversas de chat/edicao e mantido apenas para geracao automatica.
- 2026-02-28 - `routes/claude.js` migrou de chamada direta a Anthropic para proxy via ai-gateway centralizado (`AI_GATEWAY_URL`).
- 2026-02-27 - Cards de revisao do chat passaram a exibir diff real do trecho alterado (`UpdateCard` + `revisionDiff.js`).
- 2026-02-27 - Diff dos cards de revisao foi refinado para JSON com normalizacao e pretty print antes da comparacao.
- 2026-02-27 - Foi implementado controle de ownership de itens marcados no plano; a IA so altera `checked` quando `checked_source="ai"`.
- 2026-02-27 - Mutacoes de IA em itens marcados pelo usuario passaram a exigir aprovacao explicita via card de permissao no chat.
- 2026-02-27 - Cards de revisao consolidam alteracoes repetidas por arquivo em um unico card por mensagem, com reversao agrupada.
- 2026-02-27 - Subtitulos dos cards de revisao deixaram de expor nomes tecnicos de actions internas e passaram a usar rotulos amigaveis em PT-BR.
- 2026-03-02 - System prompt e `interaction_context` foram tornados estaticos para preservar cache de provedores; o ai-gateway passou a injetar `_light_context` dinamico.
- 2026-03-01 - Mecanismo de sessao nativa dos CLI bridges no ai-gateway foi corrigido com `_sessionId` estavel em `useRef`, reduzindo tokens no turno 2+ e preservando o retry de `CLI_SESSION_EXPIRED`.
- 2026-03-02 - Tela de logs (`LogsView.jsx`) foi redesenhada com abas `Transaction Trace`, `Chat History Raw` e `Log Detalhado`, e `ai_logs` ganhou `request_payload`.
