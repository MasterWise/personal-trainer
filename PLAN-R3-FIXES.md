# Plano R3: Correções da Terceira Rodada de Revisão

## Resumo: 14 achados, 13 correções (1 já confirmado limpo)

---

## Batch 1 — Paralelo, sem dependências

### Fix 1+12: WeightTrendChart Number coercion + goal band guard

**Arquivo:** `src/components/saude/WeightTrendChart.jsx`

- Linha 21: `entries.map(e => e.peso_kg)` → `entries.map(e => Number(e.peso_kg))`
- Linha 32: `toY(e.peso_kg)` → `toY(Number(e.peso_kg))`
- Linhas 23-24: `allVals.push(metaMin)` → null check + `Number()`
- Linhas 43-48: Guard `metaMin <= metaMax` antes de renderizar banda

### Fix 5: Schema content type

**Arquivo:** `src/services/claudeSchema.js`

- Linha 39: `content: { type: "string" }` → `content: { type: ["string", "object"] }`

### Fix 4: macros_alvo enviado para IA

**Arquivo:** `src/data/prompts.js`

- Em `buildSystemContext`, após "Meta Nutricional Diaria", adicionar bloco com `perfil.macros_alvo`

### Fix 9+13: SaudeView grid responsivo

**Arquivo:** `src/views/SaudeView.jsx`

- Linha do grid peso/gordura: `1fr 1fr` → `repeat(auto-fit, minmax(130px, 1fr))`

---

## Batch 2 — Sequencial (mesmo arquivo)

### Fix 2: Dedup medidas no DocsContext (AI)

**Arquivo:** `src/contexts/DocsContext.jsx`

No handler `add_medida`, substituir `arr.push()` por:
```js
const entryDate = medida.data || new Date().toLocaleDateString("pt-BR");
const entryMetodo = medida.metodo || "ai";
const existingIdx = arr.findIndex(m => m.data === entryDate && m.metodo === entryMetodo);
if (existingIdx >= 0) {
  arr[existingIdx] = { ...arr[existingIdx], ...medida, data: entryDate };
} else {
  arr.push({ data: entryDate, ...medida });
}
```

### Fix 6: Sanitização de notas (defense-in-depth)

**Arquivo:** `src/contexts/DocsContext.jsx` (mesmo handler)

Após validação de ranges, antes do dedup:
```js
if (medida.notas != null) {
  medida.notas = String(medida.notas).replace(/<[^>]*>/g, "").slice(0, 500);
}
```

### Fix 7: Limite de 365 entradas em medidas

**Arquivos:** `src/contexts/DocsContext.jsx` + `src/App.jsx` + `src/data/constants.js`

```js
export const MAX_MEDIDAS = 365;
```

Aplicar `arr.splice(0, arr.length - MAX_MEDIDAS)` em 3 pontos: DocsContext add_medida, App.jsx addMedida, App.jsx savePerfil.

---

## Batch 3 — Cascade prevention

### Fix 3: PerfilTab auto-save não dispara em mudança externa

**Arquivo:** `src/components/perfil/PerfilTab.jsx`

Adicionar `isExternalUpdate` ref:
```js
const isExternalUpdate = useRef(false);
```

No useEffect([perfil]): `isExternalUpdate.current = true;`

No useEffect([p]) auto-save: skip se `isExternalUpdate.current === true`.

---

## Batch 4 — Novos arquivos

### Fix 8: adherenceTriggers.js

**Novo arquivo:** `src/utils/adherenceTriggers.js`

Detecta marcos automáticos de adesão (treinos completos, streaks de macro).

### Fix 10: DECISIONS.md

Adicionar 5 decisões: validação ranges, tolerância numérica, dedup medidas, limite 365, isExternalUpdate.

---

## Batch 5 — Testes

### Fix 11: 10 test cases

1. add_medida dedup (mesmo dia = merge)
2. add_medida dedup (dias diferentes = 2 entradas)
3. Validação peso_kg > 300 rejeitado
4. Validação gordura_pct < 0 rejeitado
5. Limite 365 entradas (400 → 365)
6. buildSystemContext inclui macros_alvo
7. buildSystemContext sem macros_alvo mostra default
8. Tolerância 0.005 não dispara bodyChanged
9. Tolerância 0.02 dispara bodyChanged
10. WeightTrendChart com string peso_kg

---

## Grafo de Dependências

```
Batch 1 (paralelo): Fix 1+12, Fix 5, Fix 4, Fix 9+13
    ↓
Batch 2 (sequencial): Fix 2 → Fix 6 → Fix 7
    ↓
Batch 3: Fix 3
    ↓
Batch 4: Fix 8, Fix 10
    ↓
Batch 5: Fix 11 (todos os testes)
```
