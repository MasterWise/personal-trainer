# DECISIONS.md - personal-trainer

## Decisoes tecnicas

| Decisao | Motivo |
|---|---|
| Inline styles + CSS classes | Compatibilidade com tema dinamico + CSS variables |
| `window.storage` abstraction | Permite fallback localStorage quando offline |
| Backend proxy via ai-gateway | Centralizar chamadas Claude, multi-provider e proteger API key |
| Extended thinking habilitado | Melhor qualidade de resposta para coaching |
| Structured outputs (`json_schema`) | Garante JSON valido sem parsing manual |
| Plano como JSON interativo | Checkboxes, nutricao e auto-sync de calorias/treinos |
| 9 documentos separados | Granularidade de edicao e persistencia |
| `is_current` flag em conversations | Separa conversa ativa de arquivadas |
| Seed defaults no setup | Primeiro usuario ja nasce com contexto inicial da Renata |
