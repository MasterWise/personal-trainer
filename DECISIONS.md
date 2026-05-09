# DECISIONS.md - personal-trainer

## Decisoes tecnicas

| Decisao | Motivo |
|---|---|
| Firebase backend paralelo por flag | `FIREBASE_BACKEND=true` permite desenvolver Hosting/Functions/Auth/Firestore sem quebrar o runtime SQLite da VPS |
| Firestore recria conceitos, sem importar SQLite automaticamente | Cutover sera tratado como re-onboarding, preservando escolha de nao migrar dados existentes por padrao |
| Response Inbox assincrona via Cloud Tasks | Evita timeout de Hosting/Functions em chamadas longas de IA e preserva recuperacao apos reload |
| Worker Firebase dedicado | Cloud Tasks chama somente a Function `claudeWorker` com timeout longo; a API HTTP curta nao monta rota interna de worker |
| OIDC entre worker e ai-gateway | Worker envia ID token ao gateway e o gateway deve validar service account/audience antes de queimar quota Vertex |
| Firestore state docs para invariantes | Conversa atual e contador de versoes de plano usam documentos determinísticos em transações, em vez de depender de queries concorrentes |
| Reclaim de `in_flight` antigo | PendingResponses em processamento podem ser reclamadas apos `max(CLOUD_TASKS_INFLIGHT_STALE_MS, 1.5 * GATEWAY_TIMEOUT_MS)`, evitando orfaos sem duplicar chamada Vertex ainda viva |
| Timeout do gateway como erro transitorio | Timeout/falha de rede no worker mantem `pendingResponses` em `in_flight` para retry da Cloud Task; apenas erro deterministico vira `failed` |
| Rate limit Firebase via Firestore | `/api/claude` em modo Firebase usa contador transacional compartilhado entre instancias, com TTL em `rateLimits.expiresAt`, nao memoria local da Function |
| Admin via Firebase Auth custom claims | Autorizacao sensivel fica no token validado pelo backend; espelho em perfil serve apenas UI/metadado |
| `AI_MODEL=gemini-3-flash` ou default do gateway | Garante que o personal-trainer use Gemini no gateway Firebase sem depender do default local Claude CLI |
| Inline styles + CSS classes | Compatibilidade com tema dinamico + CSS variables |
| `window.storage` abstraction | Permite fallback localStorage quando offline |
| Backend proxy via ai-gateway | Centralizar chamadas Claude, multi-provider e proteger API key |
| Extended thinking habilitado | Melhor qualidade de resposta para coaching |
| Structured outputs (`json_schema`) | Garante JSON valido sem parsing manual |
| `plano` como fonte canonica do dia | Checkboxes, nutricao e treino realizado passam a nascer do plano; `cal` e `treinos` viram projeções/cache |
| 9 documentos separados | Granularidade de edicao e persistencia |
| `is_current` flag em conversations | Separa conversa ativa de arquivadas |
| Seed defaults no setup | Runtime SQLite mantem contexto inicial da Renata; Firebase bootstrap usa documentos vazios por padrao e so usa seed Renata com `FIREBASE_BOOTSTRAP_SEED=renata` |
| `perfil.treinos_planejados` como agenda semanal | Evita duplicidade de fonte entre Perfil e Saúde |
| `DocsContext` com store central e mutacoes coordenadas | Evita falha silenciosa e centraliza rebuild de projeções derivadas |
| `/api/health` como health operacional unico | Mantem simplicidade da VPS e ainda verifica SQLite + gateway |
| `calorias` e `treinos` removidos do enum do schema | Impede que a IA envie updates diretos para documentos derivados; reforça que saúde nasce do plano |
| Frontend guard para updates derivados | `DocsContext` descarta silenciosamente updates com file=calorias/treinos como safety net |
| Auto-log obrigatório no prompt | Quando o usuario reporta comida/treino, a IA deve registrar no plano imediatamente (append_item/patch_item), sem esperar pedido explícito |
| Data em conversa geral = data do app | Em conversas general, "meu plano" refere-se a data exibida no app (plan_context.date), nao amanha |
| "Plano" = aba Plano, não conceito genérico | Quando usuario fala "atualize o plano", instrução explícita no prompt para gerar update file=plano (replace_all), não confundir com atualizar perfil/memoria |
| Safe JSON parse em `applySingleUpdateToDocs` | 7 `JSON.parse` substituidos por `parseJson(value, null)` com fallback gracioso — previne crash por JSON malformado da IA |
| Error handling em `rebuildHealthCache` | Adicionado try/catch + reload no rebuild de cache de saude — previne state divergence se persist falhar |
| Reply vazia rejeitada no parser | `claudeResponseParser` agora rejeita `reply: ""` como INVALID_SCHEMA |
| Health check usa `response.ok` | Aceita apenas 200-299 do gateway (antes aceitava 4xx/5xx) |
| Senha minima 6 chars | Aumentado de 4 para 6 caracteres minimos no setup/registro |
| CLI retry com backoff 500ms | Delay antes de retry e guard contra retry duplo no 410 CLI_SESSION_EXPIRED |
| Content-Type enforcement em `/api/*` | POST/PUT/DELETE com body devem enviar application/json — protecao CSRF basica |
| Audit logging em auth | Login OK/falho e logout registrados com JSON estruturado no console |
| Validacao `doc_key` e `messages.length` | doc_key regex `/^[a-z0-9_-]{1,50}$/`; messages limitado a 100 por request |
| Redaction expandida em AI logs | Set de chaves redactadas inclui token, api_key, apiKey, cookie |
| `<raw_data>` removido do contexto | calorias_json e treinos_json removidos do prompt — dados ja derivados do plano e presentes em `<nutrition_today>` |
| `planScopeDate` fallback para hoje | Em conversa plan sem planDate, schema usa data de hoje como fallback |
| `maxItems: 30` no schema updates | Limita array de updates a 30 itens por resposta da IA |
| Onboarding usa acoes incrementais | replace_all apenas na consolidacao final; turns intermediarios usam append/patch |
| Validacao nutricional no prompt | IA deve confirmar com usuario se item reportar >1500kcal ou >100g proteina |
| `normalizeGroupName` com accent stripping | Matching de grupo de refeicao insensivel a acentos; fallback para "Outros" |
| Session sliding window | Sessao estendida quando ultrapassar metade do TTL — usuario ativo nao perde sessao |
| Rate limit no ai-gateway | 30 req/min em `/api/chat` via express-rate-limit |
| Validacao de interaction_context | Tipo string enforced e truncado em 10000 chars no gateway |
| Documento `medidas` (10º doc_key) | Time-series estruturado para medições corporais (peso, gordura, TMB, circunferências) — substitui dados numéricos no historico |
| `add_medida` action no schema | Permite IA registrar medições via structured output; historico passa a ser apenas qualitativo |
| Diff automático no save do Perfil | Mudança em peso/gordura/TMB cria entrada em medidas; mudança de metas cria progresso (Mudança de fase) |
| `macros_alvo` exposto na UI | Metas nutricionais diárias visíveis e editáveis no Perfil — antes era dado oculto |
| `preferencias_alimentares` exposto na UI | Preferências alimentares editáveis via TagEditor no Perfil — antes invisível ao usuário |
| `notaCoach` visível no PlanoView | Nota diária do coach expansível (read-only) no rodapé do plano — antes explicitamente oculta |
| Migração bootstrap de medidas | Usuários existentes ganham medidas semeado do perfil no primeiro load via serializeDocsFromResponse |
| Gráfico SVG puro para peso | WeightTrendChart sem dependências externas — linha + faixa de meta + pontos |
| NovaMedicaoForm inline na Saúde | Formulário expansível para registrar medições diretamente na aba Saúde |
| Gatilhos explícitos de progresso no prompt | IA recebe lista concreta de quando criar cada tipo (Conquista, Obstáculo, Dificuldade, Mudança de fase) |
| TagEditor como componente reutilizável | Componente de tags editáveis para arrays de strings — usado em preferências alimentares |
| Range validation em `add_medida` | peso 0-300, gordura 0-80, tmb 0-10000 — previne dados absurdos da IA |
| Tolerância numérica no `diffPerfil` (0.01) | Evita falsos positivos de bodyChanged quando perfil é salvo com arredondamento diferente (string vs number) |
| Dedup de medidas por data+metodo em 3 pontos | Previne entradas duplicadas em savePerfil (perfil), addMedida (form), add_medida (IA) |
| Limite 365 entradas em medidas (FIFO) | Evita crescimento ilimitado; entradas mais antigas descartadas automaticamente |
| `isExternalUpdate` ref no PerfilTab | Previne auto-save cascade quando perfil é atualizado externamente (sync da IA ou formulário da Saúde) |
| Schema `content` aceita string ou object | Handler já suportava ambos; schema atualizado para refletir realidade (`type: ["string", "object"]`) |
| Sanitização de notas em medidas | HTML tags removidas e notas limitadas a 500 chars — defense-in-depth contra XSS |
| `macros_alvo` e `preferencias_alimentares` no contexto da IA | Dados editáveis pelo usuário agora visíveis para a IA no user_profile |
| Number() coercion no WeightTrendChart | Previne NaN em SVG quando peso_kg é string; guard metaMin<=metaMax na banda de meta |
| Erros de API enriquecidos com `statusCode`/`code`/`payload` | `services/api.js` anexa metadados ao Error em todos os 4 verbos; `error.message` continua igual (mudança aditiva). Permite frontend mapear backend errors para mensagens user-friendly específicas sem string matching frágil |
| Códigos estruturados em `auth/auto-register` (`WHITELIST_MISS`, `MISSING_EMAIL`, `INTERNAL`) | Backend distingue tipos de falha em login Google. Mensagem do usuário em `WHITELIST_MISS` revela explicitamente que o email não está autorizado — trade-off de info disclosure aceito porque atacante já consegue testar via UI Firebase Auth, e a mensagem genérica frustra usuários legítimos |
| Log JSON estruturado para `event:"auth.failure"` | `console.log(JSON.stringify({event,reason,uid,email,ts}))` separado do `console.error` legado permite filtrar no Cloud Logging sem perder stack traces. Tipos: `whitelist_miss`, `missing_email`, `internal` |
| Onboarding em 3 telas com save atômico no fim | Tela 1 (nome obrigatório) → Tela 2 (objetivo radio + descrição opcional) → Tela 3 (restrições checkboxes + frequência treino + tipo). `OnboardingFlow.jsx` mantém state, chama `onSave` apenas na conclusão da Tela 3. Botão "Pular" em telas 2 e 3 preserva campos parciais (incluindo `outras` typed mas não-elevado). Reduz drop-off vs flow obrigatório |
| Onboarding NÃO popula `treinos_planejados` direto | Frequência + tipo coletados na Tela 3 viram texto em `meta_descricao` (`"Treina atualmente 3-5x por semana (musculação)."`). `treinos_planejados` mantém shape `{dia,tipo,duracao,horario}` populado pela IA via chat com permissão — evita shape divergente quebrando o prompt |
| `isFirstSession` testa `!(idade && peso_kg)` | Heurística do welcome adaptativo do ChatTab passa a olhar campos que SÓ o chat captura (idade, peso). Mantém welcome "Prazer em te conhecer" pós-onboarding até IA completar descoberta corporal, transitando depois para welcome normal |
