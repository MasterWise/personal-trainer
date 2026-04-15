# Plano de Implementação: Medidas, Progresso e Dados Ocultos

## Visão Geral

Corrigir 4 gaps arquiteturais identificados na auditoria:

1. **Sem histórico de medições corporais** — peso/gordura são valores únicos sem time-series
2. **Progresso estagnado** — quase zero gatilhos definidos para o documento
3. **Dados ocultos** — `macros_alvo`, `preferencias_alimentares`, `notaCoach` invisíveis ao usuário
4. **Perfil sem diff** — alterações em campos-chave não geram histórico

---

## FASE 1: Novo Documento `medidas` — Camada de Dados

**Dependência:** Nenhuma. Base para todas as outras fases.

**Objetivo:** Adicionar um 10º document key `medidas` (JSON estruturado) para medições corporais.

### 1.1 Seed e constantes

**`src/data/constants.js`** — Adicionar após INIT_PERFIL (~linha 341):
```js
export const INIT_MEDIDAS = JSON.stringify([
  {
    data: "01/02/2026",
    peso_kg: 60.5,
    gordura_pct: 21.4,
    tmb_kcal: 1397,
    circunferencias: {},
    metodo: "balanca",
    notas: "Linha de base — inicio do acompanhamento"
  }
]);
```

Atualizar também: `DEFAULTS`, `TAB_LABELS`, `TAB_ICONS`, `FILE_TO_TAB`, `FILE_TO_STATE`.

**`db/seedDefaults.js`**:
- `seedUserDefaults()`: adicionar `{ key: "medidas", content: INIT_MEDIDAS }`
- `seedEmptyDefaults()`: adicionar `{ key: "medidas", content: "[]" }`
- `clearUserDocuments()`: adicionar `{ key: "medidas", content: "[]" }`

### 1.2 DocsContext — registrar `medidas`

**`src/contexts/DocsContext.jsx`**:

- Linha 10 — adicionar `"medidas"` ao `DOC_KEYS`:
  ```js
  const DOC_KEYS = ["micro", "mem", "hist", "plano", "progresso", "cal", "treinos", "perfil", "macro", "medidas"];
  ```
- Adicionar `medidas: "medidas"` em `FILE_TO_STATE`
- Adicionar `medidas: "[]"` em `emptyDocs()`
- Novo handler `add_medida` (inserir antes do branch `append`, ~linha 161):
  ```js
  } else if (update.file === "medidas" && update.action === "add_medida") {
    const medida = typeof update.content === "string" ? parseJson(update.content, null) : update.content;
    if (!medida || typeof medida !== "object") {
      console.error("[DocsContext] Falha ao parsear update content:", { file: update.file, action: update.action });
      return { nextDocs: docs, revision: null };
    }
    const arr = parseArray(before);
    arr.push({
      data: medida.data || new Date().toLocaleDateString("pt-BR"),
      ...medida,
    });
    newVal = JSON.stringify(arr);
  }
  ```

### 1.3 Schema da IA

**`src/services/claudeSchema.js`**:
- Adicionar `"medidas"` ao enum de `file` (linha 21)
- Adicionar `"add_medida"` ao enum de `action` (linha 27)

### 1.4 Prompt da IA

**`src/data/prompts.js`**:

Na seção `<memory_rules>` (~linha 79), adicionar regra de arquivo:
```
MEDIDAS (file:"medidas") — Registro estruturado de medições corporais. action:"add_medida".
- JSON: {"peso_kg":58.9,"gordura_pct":20.1,"tmb_kcal":1410,"circunferencias":{"cintura_cm":71.5,"quadril_cm":94},"metodo":"balanca + fita","notas":"Em jejum"}
- Use quando o usuário reportar peso, gordura ou medidas de circunferência.
- NÃO registre peso/gordura no HISTORICO — use MEDIDAS para dados numéricos estruturados.
- HISTORICO continua sendo para contexto qualitativo (aderência, visitas médicas, menstruação, etc.).
```

No fluxo de decisão (~linha 98), adicionar:
```
6. Peso, gordura, circunferência? → MEDIDAS
```

Em `buildSystemContext`, adicionar bloco `<document id="medidas">` com resumo:
```xml
<document id="medidas">
Última medição ({data}): {peso_kg}kg, {gordura_pct}% gordura, TMB {tmb_kcal}kcal
Total de medições: {N}
Primeira: {data} ({peso}kg) | Última: {data} ({peso}kg)
</document>
```

### 1.5 Testes

- **Novo:** `tests/services/medidas-update.test.js` — testar `add_medida` no DocsContext
- **Modificar:** `tests/routes/documents.test.js` — assert `medidas` nos docs padrão
- **Modificar:** `tests/services/claude-schema.test.js` — assert `medidas`/`add_medida` no schema

---

## FASE 2: Engine de Diff do Perfil

**Dependência:** Fase 1 (precisa do documento `medidas` e ação `add_medida`).

**Objetivo:** Ao salvar Perfil, detectar mudanças em campos-chave e auto-criar entradas em `medidas` e `progresso`.

### 2.1 Utilitário de diff

**Novo arquivo: `src/utils/perfilDiff.js`**

```js
const BODY_FIELDS = ["peso_kg", "gordura_pct", "tmb_kcal"];
const META_FIELDS = ["meta_peso_min", "meta_peso_max", "meta_gordura_pct", "meta_ano", "meta_descricao", "objetivo_semanal"];

export function diffPerfil(prevPerfil, nextPerfil) {
  const result = {
    bodyChanged: false,
    bodyDelta: {},      // { peso_kg: { from: 60.5, to: 58.9 } }
    metaChanged: false,
    metaDelta: {},      // { meta_peso_min: { from: 55, to: 53 } }
    limitacoesChanged: false,
    treinosChanged: false,
  };

  for (const field of BODY_FIELDS) {
    if (prevPerfil[field] !== nextPerfil[field] && nextPerfil[field] != null) {
      result.bodyChanged = true;
      result.bodyDelta[field] = { from: prevPerfil[field], to: nextPerfil[field] };
    }
  }

  for (const field of META_FIELDS) {
    if (prevPerfil[field] !== nextPerfil[field] && nextPerfil[field] != null) {
      result.metaChanged = true;
      result.metaDelta[field] = { from: prevPerfil[field], to: nextPerfil[field] };
    }
  }

  result.limitacoesChanged = JSON.stringify(prevPerfil.limitacoes || []) !== JSON.stringify(nextPerfil.limitacoes || []);
  result.treinosChanged = JSON.stringify(prevPerfil.treinos_planejados || []) !== JSON.stringify(nextPerfil.treinos_planejados || []);

  return result;
}

export function buildMedidaFromDiff(nextPerfil, bodyDelta) {
  const medida = { data: new Date().toLocaleDateString("pt-BR") };
  if (bodyDelta.peso_kg) medida.peso_kg = bodyDelta.peso_kg.to;
  if (bodyDelta.gordura_pct) medida.gordura_pct = bodyDelta.gordura_pct.to;
  if (bodyDelta.tmb_kcal) medida.tmb_kcal = bodyDelta.tmb_kcal.to;
  medida.metodo = "perfil";
  medida.notas = "Atualizado via Perfil";
  return medida;
}

export function buildProgressoFromDiff(diff) {
  const entries = [];
  if (diff.metaChanged) {
    const descriptions = Object.entries(diff.metaDelta)
      .map(([k, v]) => `${k}: ${v.from} → ${v.to}`).join(", ");
    entries.push({
      title: "Ajuste de metas",
      type: "Mudança de fase",
      context: descriptions,
      significado: "Metas recalibradas com base em nova avaliação.",
    });
  }
  if (diff.limitacoesChanged) {
    entries.push({
      title: "Limitações atualizadas",
      type: "Dificuldade",
      context: "Limitações físicas ou restrições foram alteradas no perfil.",
      significado: "Plano deve ser ajustado para novas restrições.",
    });
  }
  return entries;
}
```

### 2.2 Integrar no save do Perfil

**`src/App.jsx`** — Substituir `savePerfil` (~linha 746-750):

```js
async function savePerfil(json) {
  await mutateDocs((prevDocs) => {
    const prevPerfil = parseJson(prevDocs.perfil, {});
    const nextPerfil = parseJson(json, {});
    const diff = diffPerfil(prevPerfil, nextPerfil);

    let nextDocs = { ...prevDocs, perfil: json };

    // Auto-criar medida em mudança de dados corporais
    if (diff.bodyChanged) {
      const medida = buildMedidaFromDiff(nextPerfil, diff.bodyDelta);
      const medidasArr = parseArray(prevDocs.medidas);
      medidasArr.push(medida);
      nextDocs.medidas = JSON.stringify(medidasArr);
    }

    // Auto-criar progresso em mudança de meta/limitação
    const progressoEntries = buildProgressoFromDiff(diff);
    if (progressoEntries.length > 0) {
      const progressoArr = parseArray(prevDocs.progresso);
      for (const entry of progressoEntries) {
        progressoArr.push({
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
          emoji: PROGRESSO_EMOJIS[entry.type] || "🔄",
          ...entry,
        });
      }
      nextDocs.progresso = JSON.stringify(progressoArr);
    }

    return nextDocs;
  }, { rebuildHealthCache: true });
}
```

### 2.3 Testes

**Novo:** `tests/services/perfil-diff.test.js`
- Diff com mudança de peso (bodyChanged = true)
- Diff com mudança de meta (metaChanged = true)
- Diff com mudança de limitações
- Diff sem mudanças (tudo false)
- `buildMedidaFromDiff` gera medida correta
- `buildProgressoFromDiff` gera progresso correto para meta e limitação

---

## FASE 3: Visualização na Aba Saúde — "Composição Corporal"

**Dependência:** Fase 1 (precisa de `medidas` populado).

**Objetivo:** Nova seção no SaudeView com dados atuais, gráfico de peso e formulário de nova medição.

### 3.1 Gráfico de tendência de peso (SVG puro)

**Novo: `src/components/saude/WeightTrendChart.jsx`**

Componente SVG responsivo, sem bibliotecas externas:
- Eixo X: datas (abreviadas)
- Eixo Y: faixa de peso (min-5 a max+5 dos dados)
- Linha conectando pontos de dados
- Faixa horizontal sombreada = meta (meta_peso_min a meta_peso_max)
- Ponto atual destacado
- Props: `entries`, `metaMin`, `metaMax`, `theme`

### 3.2 Card de circunferências

**Novo: `src/components/saude/CircunferenciasCard.jsx`**

Exibe circunferências da última medição com delta vs anterior:
- Cada medida com seta ↑/↓ e valor do delta
- "Sem dados" se nenhuma circunferência registrada
- Props: `latest`, `previous`, `theme`

### 3.3 Formulário de nova medição

**Novo: `src/components/saude/NovaMedicaoForm.jsx`**

Formulário inline expansível (botão "📏 Registrar nova medição"):
- `peso_kg` (number, obrigatório)
- `gordura_pct` (number, opcional)
- `tmb_kcal` (number, opcional)
- Seção expansível de circunferências: `cintura_cm`, `quadril_cm`, `braco_cm`, `coxa_cm`
- `metodo` (select: "balança", "balança + fita", "bioimpedância", "DEXA")
- `notas` (text, opcional)
- Botão "Salvar"

Ao salvar, chama `onAddMedida(medidaObj)` passado via props.

### 3.4 Integrar no SaudeView

**`src/views/SaudeView.jsx`** — Nova seção "Composição Corporal" entre calorias e treinos:

1. Header: "📊 Composição Corporal"
2. Stats atuais: peso + gordura vs metas (do perfil), com delta da última medida
3. `<WeightTrendChart />` com dados de medidas
4. `<CircunferenciasCard />` com última vs anterior
5. `<NovaMedicaoForm />` no rodapé da seção

Novas props: `medidas`, `perfil`, `onAddMedida`

**`src/App.jsx`** — Adicionar função `addMedida` e passar props:

```js
async function addMedida(medidaObj) {
  await mutateDocs((prevDocs) => {
    const arr = JSON.parse(prevDocs.medidas || "[]");
    arr.push({ data: new Date().toLocaleDateString("pt-BR"), ...medidaObj });
    // Também atualizar perfil com valores atuais
    const perfil = JSON.parse(prevDocs.perfil || "{}");
    if (medidaObj.peso_kg) perfil.peso_kg = medidaObj.peso_kg;
    if (medidaObj.gordura_pct) perfil.gordura_pct = medidaObj.gordura_pct;
    if (medidaObj.tmb_kcal) perfil.tmb_kcal = medidaObj.tmb_kcal;
    return { ...prevDocs, medidas: JSON.stringify(arr), perfil: JSON.stringify(perfil) };
  }, { rebuildHealthCache: true });
}
```

### 3.5 Fonte da meta na Saúde

Ao lado de "de {meta.kcal} kcal", adicionar:
```jsx
<span style={{ fontSize: "9px", color: c.textMuted, fontStyle: "italic" }}>
  baseado no seu perfil
</span>
```

---

## FASE 4: Expor Dados Ocultos na UI

**Dependência:** Nenhuma (independente, pode rodar em paralelo após Fase 1).

**Objetivo:** Tornar `macros_alvo`, `preferencias_alimentares` editáveis no Perfil; mostrar `notaCoach` no Plano.

### 4.1 Seção "Metas nutricionais" no Perfil

**`src/components/perfil/PerfilTab.jsx`** — Nova seção após "Dados corporais" (~linha 244):

Campos:
- Calorias (kcal) — number
- Proteína (g) — text (aceita range "110-120")
- Carboidrato (g) — text (aceita range)
- Gordura (g) — text (aceita range)
- Fibras (g) — number

Hint: "Alvos diários de calorias e macronutrientes. O coach usa para montar seu plano."

### 4.2 Seção "Preferências alimentares" no Perfil

Nova seção após "Hábitos e restrições" (~linha 305):

Usa componente `TagEditor` (tags editáveis com add/remove) para:
- Texturas favoritas
- Pratos favoritos
- Doces gatilho (TPM)
- Escapes aprovados

**Novo: `src/components/ui/TagEditor.jsx`**

Componente simples: renderiza array de strings como tags removíveis + input para adicionar.

### 4.3 Nota do coach no PlanoView

**`src/views/PlanoView.jsx`** — Após lista de grupos (~linha 286):

Componente `CoachNoteExpander` (expandir/colapsar):
```jsx
{planoObj?.notaCoach && (
  <CoachNoteExpander note={planoObj.notaCoach} theme={theme} />
)}
```

Removido da exclusão em `planUpdateGuard.js` — manter no objeto mas renderizar como read-only expansível.

### 4.4 Testes

- Testar que `macros_alvo` é preservado no auto-save do Perfil
- Testar que `preferencias_alimentares` é preservado
- Testar que `notaCoach` renderiza quando presente

---

## FASE 5: Gatilhos Explícitos de Progresso

**Dependência:** Fase 2 (diff do Perfil cria alguns gatilhos; esta fase adiciona gatilhos de adesão).

**Objetivo:** Gatilhos automáticos via código + instruções claras no prompt para a IA.

### 5.1 Detector de adesão

**Novo: `src/utils/adherenceTriggers.js`**

```js
export function detectAdherenceMilestones(healthViewModel, existingProgresso) {
  const triggers = [];

  // Adesão semanal > 90% em treinos
  if (treinosPlanejados > 0 && (treinosFeitos / treinosPlanejados) >= 0.9) {
    // Deduplicar: verificar se já existe conquista similar no mesmo mês
    if (!alreadyExists) {
      triggers.push({ title: "Semana com alta adesão!", type: "Conquista", ... });
    }
  }

  // Adesão semanal < 50%
  if (treinosPlanejados > 0 && (treinosFeitos / treinosPlanejados) < 0.5) {
    triggers.push({ title: "Semana com baixa adesão", type: "Dificuldade", ... });
  }

  return triggers;
}
```

### 5.2 Integrar verificação no App.jsx

`useEffect` que roda quando `mutationSeq` muda (debounce 2s) para checar gatilhos de adesão e auto-criar progresso.

### 5.3 Instruções no prompt

**`src/data/prompts.js`** — Na seção `<memory_rules>` após PROGRESSO:

```
GATILHOS DE PROGRESSO — registre proativamente:
- CONQUISTA: Novo menor peso em medidas | Meta atingida | Semana TPM sem compulsão
- OBSTÁCULO SUPERADO: Retorno após >3 dias sem interação | Superou gatilho emocional
- DIFICULDADE: Ganho >1kg vs menor peso | Sinais de frustração/desistência
- MUDANÇA DE FASE: Transição cutting→manutenção | Mudança estratégica
```

### 5.4 Testes

**Novo:** `tests/services/adherence-triggers.test.js`
- Alta adesão detectada (>90%)
- Baixa adesão detectada (<50%)
- Deduplicação funciona (não duplicar trigger no mesmo período)

---

## FASE 6: Migração de Dados Existentes

**Dependência:** Fase 1 completa.

**Objetivo:** Usuários existentes ganham `medidas` semeado a partir de `perfil.peso_kg` e `perfil.gordura_pct`.

### 6.1 Bootstrap no carregamento

**`src/contexts/DocsContext.jsx`** — Em `serializeDocsFromResponse` (~linha 88-98):

```js
// Migração: bootstrap medidas do perfil se ausente
if (!loaded.medidas || loaded.medidas === "[]") {
  try {
    const perfil = JSON.parse(loaded.perfil || "{}");
    if (perfil.peso_kg || perfil.gordura_pct) {
      const seed = [{
        data: new Date().toLocaleDateString("pt-BR"),
        peso_kg: perfil.peso_kg || null,
        gordura_pct: perfil.gordura_pct || null,
        tmb_kcal: perfil.tmb_kcal || null,
        circunferencias: {},
        metodo: "perfil",
        notas: "Migrado do perfil existente",
      }];
      loaded.medidas = JSON.stringify(seed);
    }
  } catch { /* ignore */ }
}
```

Persistir na primeira mutação subsequente.

---

## Grafo de Dependências

```
FASE 1 (medidas doc) ──────┬──── FASE 2 (perfil diff)
                            │         │
                            │         └──── FASE 5 (gatilhos progresso)
                            │
                            ├──── FASE 3 (visualização saúde)
                            │
                            └──── FASE 6 (migração)

FASE 4 (dados ocultos) ──── Independente, paralelo com qualquer fase
```

### Ordem recomendada

```
1. FASE 1 ── base para tudo
2. FASE 4 ── paralelo (independente)
3. FASE 2 ── depende de Fase 1
4. FASE 3 ── depende de Fase 1
5. FASE 5 ── depende de Fase 2
6. FASE 6 ── depende de Fase 1
```

---

## Arquivos a Criar (9)

| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `src/utils/perfilDiff.js` | 2 | Engine de diff do perfil |
| `src/utils/adherenceTriggers.js` | 5 | Detecção de marcos de adesão |
| `src/components/saude/WeightTrendChart.jsx` | 3 | Gráfico SVG de tendência de peso |
| `src/components/saude/CircunferenciasCard.jsx` | 3 | Card de circunferências com delta |
| `src/components/saude/NovaMedicaoForm.jsx` | 3 | Formulário inline de nova medição |
| `src/components/ui/TagEditor.jsx` | 4 | Editor de tags (array de strings) |
| `tests/services/medidas-update.test.js` | 1 | Testes do add_medida |
| `tests/services/perfil-diff.test.js` | 2 | Testes do diff engine |
| `tests/services/adherence-triggers.test.js` | 5 | Testes dos gatilhos |

## Arquivos a Modificar (11)

| Arquivo | Fases | Mudanças |
|---------|-------|----------|
| `src/contexts/DocsContext.jsx` | 1, 6 | DOC_KEYS, FILE_TO_STATE, emptyDocs, handler add_medida, migração |
| `src/data/constants.js` | 1 | INIT_MEDIDAS, DEFAULTS, TAB_LABELS, TAB_ICONS, FILE_TO_TAB, FILE_TO_STATE |
| `src/data/prompts.js` | 1, 5 | Regras medidas, gatilhos progresso, contexto XML |
| `src/services/claudeSchema.js` | 1 | file enum + action enum |
| `src/views/SaudeView.jsx` | 3 | Seção composição corporal, fonte da meta |
| `src/views/PlanoView.jsx` | 4 | CoachNoteExpander |
| `src/components/perfil/PerfilTab.jsx` | 4 | Seções macros_alvo e preferências |
| `src/App.jsx` | 2, 3, 5 | savePerfil com diff, addMedida, props SaudeView, useEffect adesão |
| `db/seedDefaults.js` | 1 | Seed medidas nas 3 funções |
| `tests/routes/documents.test.js` | 1 | Assert medidas nos docs |
| `tests/services/claude-schema.test.js` | 1 | Assert medidas/add_medida |

## Verificação Final

- `npm run test:run` — todos os testes passando (78+ existentes + ~15 novos)
- Restart do servidor (`node manage.mjs restart`)
- Health check: `curl http://localhost:3400/api/health`
- Teste funcional:
  - Alterar peso no Perfil → verificar entrada em `medidas` e gráfico na Saúde
  - Alterar meta no Perfil → verificar entrada no Progresso
  - Chat "Pesei 57,8kg" → verificar add_medida (não append em historico)
  - Registrar medição via formulário na Saúde
  - Verificar notaCoach expansível no Plano
  - Verificar macros_alvo editável no Perfil

## Documentação

- Atualizar `DECISIONS.md` com decisões de cada fase
- Atualizar `AGENTS.md` com novo documento `medidas`, novos componentes, novos gatilhos
