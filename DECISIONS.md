# DECISIONS.md - personal-trainer

## Decisoes tecnicas

| Decisao | Motivo |
|---|---|
| Inline styles + CSS classes | Compatibilidade com tema dinamico + CSS variables |
| `window.storage` abstraction | Permite fallback localStorage quando offline |
| Backend proxy via ai-gateway | Centralizar chamadas Claude, multi-provider e proteger API key |
| Extended thinking habilitado | Melhor qualidade de resposta para coaching |
| Structured outputs (`json_schema`) | Garante JSON valido sem parsing manual |
| `plano` como fonte canonica do dia | Checkboxes, nutricao e treino realizado passam a nascer do plano; `cal` e `treinos` viram projeções/cache |
| 9 documentos separados | Granularidade de edicao e persistencia |
| `is_current` flag em conversations | Separa conversa ativa de arquivadas |
| Seed defaults no setup | Primeiro usuario ja nasce com contexto inicial da Renata |
| `perfil.treinos_planejados` como agenda semanal | Evita duplicidade de fonte entre Perfil e Saúde |
| `DocsContext` com store central e mutacoes coordenadas | Evita falha silenciosa e centraliza rebuild de projeções derivadas |
| `/api/health` como health operacional unico | Mantem simplicidade da VPS e ainda verifica SQLite + gateway |
