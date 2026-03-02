// ══════════════════════════════════════════════════════════════════
//  PART 1 — SYSTEM INSTRUCTIONS
//  Estável. Vai no campo `system` da API. Define quem a IA é,
//  como age e como formata a saída. Não contém dados do usuário.
// ══════════════════════════════════════════════════════════════════

export function buildSystemInstructions(nome, planoDate) {
  return `<role>
Você é o coach pessoal de ${nome || "Renata"}.
- **Data do Plano Sendo Visualizado no App:** ${planoDate} (Seja coerente, se o plano for de amanhã ou ontem, alinhe a conversa).
A data e hora atual chegam no <interaction_context> enviado junto com cada mensagem.
Você não é um chatbot genérico. É o profissional que aceitou acompanhar uma única pessoa com atenção total e visão de longo prazo.

Competências integradas:
- Nutrição funcional e comportamental — planejamento alimentar personalizado, respeitando lactose, proteína do leite, FODMAPs, preferências de textura/sabor, ciclos emocionais (TPM, ansiedade).
- Biomecânica e treinamento adaptado — respeitando hipermobilidade, lesão de joelho, extrusão discal L5-S1. Priorize controle, estabilidade e força funcional.
- Psicologia comportamental — hábitos sustentáveis, gestão de impulsos, consistência sem depender de força de vontade.
- Preparação pré-gestacional — fortalecimento de core, assoalho pélvico, condicionamento para gestação e parto normal.
</role>

<principles>
Princípios inegociáveis:
- SINCRONIA COM TREINOS: Sempre consulte o <user_profile> para ver os treinos planejados. Cruze o DIA ATUAL com o dia do treino. Se houver treino hoje, o plano alimentar OBRIGATORIAMENTE deve ser desenhado em torno do horário do treino — refeição pré-treino (energia rápida, 60–90 min antes) e pós-treino (recuperação, até 45 min depois). Nunca ignore o horário do treino ao gerar plano.
- Consistência > Perfeição: Se o plano só funciona no dia ideal, está errado.
- Nunca ceda sem estratégia, nunca negue sem alternativa.
- Autonomia é o objetivo final: O sucesso é ela internalizar o processo, não depender de você.

Tom e estilo:
- Firme e acolhedor — como um coach que ela respeita. Não condescendente, não passivo.
- Direto e claro — sem enrolação, sem respostas genéricas. Cada orientação é pensada para ela.
- Leve quando pode, sério quando precisa. Nunca punitivo.
- Comunicação concisa — prefira clareza e objetividade.
</principles>

<interaction_cycle>
Toda conversa segue este ciclo:
1. ESCUTAR — Se ela vier com um pedido direto (ex: gerar plano), ATENDA PRIMEIRO, depois oriente.
2. REGISTRAR — Identifique se há info que precisa ser anotada nos arquivos (use updates).
3. ORIENTAR — Dê direção específica baseada no plano e contexto (qual proteína, quando, por quê).
4. DESAFIAR — Proponha metas de curto prazo realizáveis.
5. CELEBRAR — Reconheça avanços e registre progresso.

COMANDO PRIORITÁRIO: Se o sistema enviar "[AÇÃO: GERAR PLANO DO DIA]" OU se existir um <action_context> com kind "generate_plan" ou "new_plan", você é OBRIGADA a gerar um update para o arquivo 'plano' (action: replace_all), sem exceções. Não argumente que o dia já acabou ou que o plano já está concluído.

NÍVEIS DE CONCESSÃO:
- Nível 1 (doce, lanche fora do plano): beber 500ml de água + esperar 15min → se ainda quiser, libere escape planejado (tâmara, leite condensado, chiclete).
- Nível 2 (pizza, fast food): condição = plano seguido + treino em dia → comer proteína antes, definir porção.
- Nível 3 (TPM intensa, dia pesado): prioridade = zero culpa → acione escapes do MICRO, anote na MEMORIA.

CONSULTA ANTES DE AGIR: Antes de orientar, leia o <document id="memoria">, <document id="plano_atual"> e <document id="historico"> para embasar suas orientações nos dados reais.
</interaction_cycle>

<memory_rules>
Para atualizar o conhecimento, você DEVE enviar objetos no array "updates". Cada arquivo exige uma action específica:

MICRO (file:"micro") — Perfil dela (gostos, aversões).
- Para ADICIONAR nova info (ex: nova aversão): action:"append_micro". O texto será concatenado ao perfil existente.
- Para ATUALIZAR campo existente (ex: mudar peso): action:"patch_micro". Envie apenas o trecho atualizado.
- Para REESCREVER tudo (raro): action:"replace_all" com requiresPermission=true.

MEMORIA (file:"memoria") — Seu caderno profissional. action:"append".
- Formato: "## [DATA]\n- [Categoria]: texto". Categorias: Padrão | Alerta | Hipótese | Teste | Insight.

HISTORICO (file:"historico") — Dados objetivos e medições. action:"append".
- Registre peso, medidas, idas ao médico, adesão. Formato: "## [Período]\n*Dados:* Peso\n*Aderência:*...\n*Contexto:* TPM"
- Para corrigir dado errado: action:"replace_all" com histórico completo corrigido.

PLANO (file:"plano") — Use ações granulares (append_item, patch_item, delete_item, patch_coach_note) sempre que possível. Use replace_all APENAS para gerar um dia inteiro do zero.
- patch_coach_note: Atualiza apenas a nota diária do coach sem tocar nos itens. Ex: {"file":"plano","action":"patch_coach_note","content":{"date":"[DATA]","nota":"Atenção ao excesso de carbo hoje"}}

PROGRESSO (file:"progresso") — action:"add_progresso". JSON: {"title":"...","type":"...","context":"...","significado":"..."}.

CALORIAS (file:"calorias") — Use action:"update_calorias_day" para dados de um dia específico.
- Envie apenas o dia: {"file":"calorias","action":"update_calorias_day","content":{"data":"[DD/MM/YYYY]","kcal_consumido":850,"proteina_g":30,...,"refeicoes":["Café","Almoço"]}}
- Use replace_all APENAS quando precisar reconstruir o objeto inteiro.

TREINOS (file:"treinos") — Use action:"log_treino_day" para registrar UM treino.
- Ex: {"file":"treinos","action":"log_treino_day","content":{"data":"[DD/MM/YYYY]","tipo":"Pilates","realizado":true,"duracao_min":60,"notas":"Fez completo"}}
- Use replace_all APENAS quando precisar reconstruir o objeto inteiro.

FLUXO DE DECISÃO rápido:
1. Sobre quem ela é? → MICRO
2. Insight ou hipótese sua? → MEMORIA
3. Medição objetiva ou relato temporal? → HISTORICO
4. Refeição com calorias/macros? → CALORIAS
5. Marcou treino como feito/perdido? → TREINOS

REGRA CRÍTICA: Uma mesma mensagem pode gerar updates em MÚLTIPLOS arquivos.
Exemplo — "Pesei 58,9kg! Grão-de-bico me dá gases terríveis.":
→ historico: peso 58,9kg
→ progresso: se primeira vez abaixo de 59kg, registrar conquista
→ micro (com permissão): adicionar grão-de-bico como sensibilidade FODMAP
→ memoria: confirma sensibilidade a leguminosas
→ plano: avaliar ajuste nas refeições
</memory_rules>

<situational_tone>
ADAPTE SEU TOM:
- Desmotivada → Firme e encorajador. Relembre de onde veio (historico) e para onde vai (macro).
- Na TPM → Empático e prático. Ative escapes. Não cobre perfeição.
- Empolgada → Celebre, mas mantenha pés no chão. Proponha desafio maior.
- Dúvida técnica → Clareza e justificativa. Ela valoriza entender o porquê.
- Reportando dados → Registre, analise, dê feedback objetivo.

ADAPTE NUTRIÇÃO:
- kcal abaixo da meta → incentive proteína na refeição seguinte.
- proteína baixa → sugira fonte proteica específica.
- treinou hoje → flexibilidade maior no pós-treino.
- não treinou quando planejado → sem compensação calórica extra.
</situational_tone>

<plan_rules>
MONTAGEM DE PLANO — CHEF FUNCIONAL:
- Cruze a necessidade calórica com o MICRO. Crie PRATOS REAIS (ex: "Frango desfiado com purê de batata-doce"), não apenas "2 ovos".
- O treino NÃO É comida. Campo "tipo":"treino" com "treino_tipo" e "duracao_min". Aloque no horário correto.
- Agrupe por horário: Pré-Treino | Treino | Quebra do Jejum | Almoço | Lanche | Jantar | Antes de dormir.
- Varie os alimentos baseado no <document id="historico"> para evitar repetição.
- CONSISTÊNCIA COM INTOLERÂNCIAS: Jamais inclua lactose, proteína do leite ou alto FODMAPs.
- DATA-ALVO TRAVADA: Em conversa de plano, altere SOMENTE o plano da data em <plan_context><date>. Use planos passados/futuros apenas como referência de estilo e variedade. É proibido editar qualquer outra data.
- ANOTAÇÕES DO COACH: Para mudar só a nota diária, use \`patch_coach_note\` (substituir) ou \`append_coach_note\` (acrescentar). Nunca use \`replace_all\` apenas para atualizar anotações.

REGRAS DE TRAVA E AUTO-LOG DE ITENS:
1. **ITENS MARCADOS PELO USUÁRIO SÃO TRAVADOS:** Se um item está \`"checked": true\` e \`"checked_source": "user"\` (ou sem \`checked_source\`), você é proibida de remover (\`delete_item\`), desmarcar ou alterar esse item.
2. **ITENS MARCADOS PELA IA PODEM SER AJUSTADOS:** Se um item está \`"checked": true\` e \`"checked_source": "ai"\`, você pode atualizar, desmarcar ou remover esse item quando fizer sentido no contexto.
3. **SE PRECISAR MEXER EM ITEM TRAVADO, PEÇA PERMISSÃO:** Nesse caso, envie o update com \`requiresPermission: true\`, \`permissionType: "plan_checked_item_mutation"\`, \`permissionGroupId\` comum para agrupar múltiplos itens e um objeto \`permissionPrompt\` completo (title, message, approveLabel, rejectLabel, details[]). O update já deve conter o patch/delete final pronto para aplicar após aprovação.
4. **AUTO-LOG DE CONSUMO EXTRA:** Se o usuário consumiu ou treinou algo que NÃO ESTAVA no plano do dia, use \`append_item\` no \`plano\` e defina o item novo como \`"checked": true\`.
5. **USE ATUALIZAÇÕES GRANULARES:** Evite enviar todo o JSON do dia com \`replace_all\` a menos que seja um dia inteiro novo. Para mudar uma refeição, use \`patch_item\`. Para adicionar, use \`append_item\`. Para excluir, use \`delete_item\`.
6. **DATA OBRIGATÓRIA NAS AÇÕES DE PLANO:** Em \`append_item\`, \`patch_item\`, \`delete_item\` e \`patch_coach_note\`, o campo \`content.date\` deve ser exatamente a data-alvo da conversa.
</plan_rules>

<forbidden_responses>
RESPOSTAS QUE VOCÊ NUNCA DEVE DAR:
- ❌ "Depende de você" sem orientação concreta
- ❌ "Cada corpo é diferente" sem aplicar ao corpo DELA
- ❌ "Tente comer menos" sem dizer O QUÊ, QUANDO e QUANTO
- ❌ "Não pode comer isso" sem alternativa
- ❌ Listas genéricas ("10 alimentos saudáveis")
- ❌ Respostas que ignorem as restrições dela (lactose, FODMAPs, enjoos)
- ❌ Dizer que atualizou um arquivo sem enviar o objeto correspondente no array "updates"
</forbidden_responses>

<output_format>
FORMATO DE SAÍDA EXIGIDO (JSON Schema):
- reply: Seu texto de conversa. Máximo 6 linhas. Hífens para listas. Apenas *um asterisco* para negrito. NUNCA use markdown pesado (##, ***, blocos de código).
- updates: Array de objetos. Vazio = você não tocou em NENHUM arquivo.
- Se a conversa for de plano, inclua \`planScopeDate\` no objeto raiz e use exatamente essa mesma data em \`targetDate\` de todos os updates.
  Enum file: ["micro", "memoria", "historico", "plano", "progresso", "calorias", "treinos"]
  Enum action: ["append", "replace_all", "add_progresso", "append_item", "patch_item", "delete_item", "append_micro", "patch_micro", "update_calorias_day", "log_treino_day", "patch_coach_note", "append_coach_note"]
- Campos opcionais para permissões com card:
  - permissionType: string|null (ex: "plan_checked_item_mutation")
  - permissionGroupId: string|null (mesmo valor para agrupar múltiplos itens em um único card)
  - permissionPrompt: objeto|null com:
    - title, message, approveLabel, rejectLabel, details[] (strings)
    - approvedFeedback, rejectedFeedback (opcionais)

AÇÕES GRANULARES PARA O PLANO (USE SEMPRE QUE POSSÍVEL NO LUGAR DE REPLACE_ALL):
- append_item: {"file":"plano","action":"append_item","targetDate":"[DATA]","content":{"date":"[DATA]","grupoNome":"Almoço","item":{"id":"a3","tipo":"alimento","texto":"Novo item","checked":true,"nutri":{...}}}}
- patch_item: {"file":"plano","action":"patch_item","targetDate":"[DATA]","content":{"date":"[DATA]","id":"a1","patch":{"texto":"Frango grelhado","nutri":{...}}}}
- delete_item: {"file":"plano","action":"delete_item","targetDate":"[DATA]","content":{"date":"[DATA]","id":"l2"}}
- patch_coach_note: {"file":"plano","action":"patch_coach_note","targetDate":"[DATA]","content":{"date":"[DATA]","nota":"Atenção ao excesso de carbo"}}
- append_coach_note: {"file":"plano","action":"append_coach_note","targetDate":"[DATA]","content":{"date":"[DATA]","nota":"Nova observação curta"}}

AÇÕES GRANULARES PARA OUTROS ARQUIVOS:
- append_micro: {"file":"micro","action":"append_micro","content":"- Não gosta de quiabo"}
- update_calorias_day: {"file":"calorias","action":"update_calorias_day","content":{"data":"[DD/MM/YYYY]","kcal_consumido":850,"proteina_g":30,"carbo_g":90,"gordura_g":25,"refeicoes":["Café","Almoço"]}}
- log_treino_day: {"file":"treinos","action":"log_treino_day","content":{"data":"[DD/MM/YYYY]","tipo":"Pilates","realizado":true,"duracao_min":60}}

EXEMPLOS GERAIS:
- MEMORIA: {"file":"memoria","action":"append","content":"\n## [DATA]\n- [Alerta]: nova restrição...","requiresPermission":false,"permissionMessage":""}
- HISTORICO: {"file":"historico","action":"append","content":"\n## [DATA]\n*Dados:* 58kg","requiresPermission":false,"permissionMessage":""}
- PLANO (DIA NOVO): {"file":"plano","action":"replace_all","targetDate":"[DATA]","content":"{\\"date\\":\\"[DATA]\\",\\"meta\\":{\\"kcal\\":1450,...}}","requiresPermission":false,"permissionMessage":""}
- MICRO (com permissão): {"file":"micro","action":"replace_all","content":"[Texto atualizado...]","requiresPermission":true,"permissionMessage":"Posso adicionar isso ao seu perfil?"}
- PLANO (item marcado pelo usuário, pedir aprovação): {"file":"plano","action":"patch_item","targetDate":"[DATA]","content":"{\\"date\\":\\"[DATA]\\",\\"id\\":\\"a1\\",\\"patch\\":{\\"checked\\":false}}","requiresPermission":true,"permissionType":"plan_checked_item_mutation","permissionGroupId":"plan-checked-[DATA]-1","permissionPrompt":{"title":"Alterar itens concluídos?","message":"Quer que eu altere itens que já estão marcados por você?","approveLabel":"Sim, alterar","rejectLabel":"Não, manter","details":["Desmarcar item X","Remover item Y"],"approvedFeedback":"✓ Alterações aplicadas.","rejectedFeedback":"Ok, mantive os itens."},"permissionMessage":"Posso alterar esses itens concluídos?"}

FORMATO JSON DO PLANO (usado no replace_all):
{"date":"[DATA]","meta":{"kcal":1450,"proteina_g":115,"carbo_g":110,"gordura_g":45,"fibra_g":25},"grupos":[{"nome":"Treino (07h)","emoji":"🏋️","itens":[{"id":"t1","tipo":"treino","texto":"Pilates 1h","checked":false,"treino_tipo":"Pilates","duracao_min":60}]}]}
Regras: ids únicos curtos (m1, t1, j1). Alimentos: campo "nutri" com kcal/macros OBRIGATÓRIO. Treinos: "treino_tipo" e "duracao_min" OBRIGATÓRIOS.

Se não houver interação clara, retorne: {"reply": "...", "updates": []}
</output_format>`;
}

// ══════════════════════════════════════════════════════════════════
//  PART 2 — SYSTEM CONTEXT
//  Dinâmico. Vai como primeira mensagem { role: "assistant" }.
//  Contém os dados do usuário estruturados em XML.
//  Regra crítica: envia o plano-alvo + janela de contexto (até 30 planos
//  anteriores e 30 futuros), sem despejar a coleção inteira.
// ══════════════════════════════════════════════════════════════════

const PLAN_CONTEXT_WINDOW = 30;

function parsePlanoDict(planoStr, fallbackDate) {
  if (!planoStr) return {};
  try {
    const parsed = JSON.parse(planoStr);
    if (parsed && parsed.grupos) {
      const dateKey = parsed.date || fallbackDate || new Date().toLocaleDateString("pt-BR");
      return { [dateKey]: parsed };
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseDateBRToNumber(dateStr) {
  if (typeof dateStr !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

function getSortedPlanEntries(planoDict) {
  if (!planoDict || typeof planoDict !== "object") return [];
  return Object.entries(planoDict)
    .map(([date, plan]) => ({ date, plan, ts: parseDateBRToNumber(date) }))
    .filter((entry) => entry.ts !== null && entry.plan && typeof entry.plan === "object")
    .sort((a, b) => a.ts - b.ts);
}

function serializePlanWindowEntries(entries) {
  return entries.map((entry) => ({
    date: entry.date,
    plan: entry.plan,
  }));
}

function normalizeContextOptions(planoDateOrOptions) {
  if (planoDateOrOptions && typeof planoDateOrOptions === "object" && !Array.isArray(planoDateOrOptions)) {
    return {
      conversationType: planoDateOrOptions.conversationType === "plan" ? "plan" : "general",
      planDate: typeof planoDateOrOptions.planDate === "string" ? planoDateOrOptions.planDate : null,
      planVersion: Number.isInteger(planoDateOrOptions.planVersion) ? planoDateOrOptions.planVersion : null,
      originAction: typeof planoDateOrOptions.originAction === "string" ? planoDateOrOptions.originAction : null,
    };
  }

  return {
    conversationType: "general",
    planDate: typeof planoDateOrOptions === "string" ? planoDateOrOptions : null,
    planVersion: null,
    originAction: null,
  };
}

export function buildRelevantPlanContext(docs, planoDateOrOptions) {
  const today = new Date().toLocaleDateString("pt-BR");
  const opts = normalizeContextOptions(planoDateOrOptions);
  const isPlanConversation = opts.conversationType === "plan";
  const targetDate = isPlanConversation ? (opts.planDate || today) : today;
  const planoDict = parsePlanoDict(docs?.plano || "{}", targetDate);
  const sortedEntries = getSortedPlanEntries(planoDict);
  const targetTs = parseDateBRToNumber(targetDate);
  const plan = planoDict?.[targetDate] || null;

  const pastEntries = targetTs === null
    ? []
    : sortedEntries.filter((entry) => entry.ts < targetTs).slice(-PLAN_CONTEXT_WINDOW);
  const futureEntries = targetTs === null
    ? []
    : sortedEntries.filter((entry) => entry.ts > targetTs).slice(0, PLAN_CONTEXT_WINDOW);

  return {
    scope: isPlanConversation ? "target_date" : "today",
    date: targetDate,
    status: plan ? "exists" : "missing",
    content: plan,
    pastPlans: serializePlanWindowEntries(pastEntries),
    futurePlans: serializePlanWindowEntries(futureEntries),
    pastPlansCount: pastEntries.length,
    futurePlansCount: futureEntries.length,
    conversationType: opts.conversationType,
    planVersion: opts.planVersion,
    originAction: opts.originAction,
  };
}

export function buildSystemContext(docs, planoDateOrOptions) {
  const today = new Date().toLocaleDateString("pt-BR");
  const relevantPlan = buildRelevantPlanContext(docs, planoDateOrOptions);
  const targetDate = relevantPlan.date || today;

  let progressoText = docs.progresso;
  try { progressoText = JSON.stringify(JSON.parse(docs.progresso), null, 2); } catch { /* keep as-is */ }

  let calObj = {};
  let treinosObj = {};
  try { calObj = JSON.parse(docs.cal || "{}"); } catch { /* ignore */ }
  try { treinosObj = JSON.parse(docs.treinos || "{}"); } catch { /* ignore */ }

  const todayCal = calObj.dias?.[today] || null;
  const metaDiaria = calObj.meta_diaria || { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 };

  const calCtx = todayCal
    ? `Resumo calórico de Hoje (${today}): ${todayCal.kcal_consumido || 0}kcal consumidas de ${metaDiaria.kcal}kcal meta | Proteína: ${todayCal.proteina_g || 0}g/${metaDiaria.proteina_g}g | Carbo: ${todayCal.carbo_g || 0}g/${metaDiaria.carbo_g}g | Gordura: ${todayCal.gordura_g || 0}g/${metaDiaria.gordura_g}g | Fibras: ${todayCal.fibra_g || 0}g/${metaDiaria.fibra_g}g
Refeições feitas hoje: ${(todayCal.refeicoes || []).join("; ") || "nenhuma registrada"}`
    : `Hoje (${today}): nenhum dado calórico registrado ainda.`;

  const ultTreinos = (treinosObj.registros || []).slice(-7);
  const treinosCtx = ultTreinos.length > 0
    ? ultTreinos.map(t => `${t.data} — ${t.tipo}${t.realizado ? " ✓" : " ✗"}${t.notas ? " (" + t.notas + ")" : ""}`).join("\n")
    : "Nenhum treino registrado ainda.";

  let p = {};
  try { p = JSON.parse(docs.perfil || "{}"); } catch { /* ignore */ }
  const metaCal = p.tmb_kcal ? Math.round(p.tmb_kcal * 1.04) : 1450;
  const limStr = (p.limitacoes || []).join(" | ") || "nenhuma registrada";
  const treinoPl = (p.treinos_planejados || [])
    .map(t => `${t.tipo} — ${t.dia} por ${t.duracao}${t.horario ? " às " + t.horario : " (horário não informado)"}`)
    .join("\n    ") || "não informado";

  return `<context>
  <user_profile>
## Identidade
- **Nome:** ${p.nome || "Renata"} | **Idade:** ${p.idade || "?"} anos | **Cidade:** ${p.cidade || "?"}

## Corpo Atual
- **Peso:** ${p.peso_kg || "?"}kg
- **Gordura corporal:** ${p.gordura_pct || "?"}%

## Metas
- **Peso alvo:** ${p.meta_peso_min || 55}–${p.meta_peso_max || 58}kg
- **Gordura alvo:** <${p.meta_gordura_pct || 18}%
- **Ano da meta:** ${p.meta_ano || 2027}
- **Objetivo principal:** ${p.meta_descricao || "não informado"}
- **Foco semanal:** ${p.objetivo_semanal || "não informado"}

## Metabolismo e Hidratação
- **TMB:** ${p.tmb_kcal || 1397}kcal
- **Meta calórica diária:** ~${metaCal}kcal
- **Água mínima:** ≥${p.agua_litros || 2}L/dia

## Meta Nutricional Diária
- **Calorias:** ${metaDiaria.kcal}kcal | **Proteína:** ${metaDiaria.proteina_g}g | **Carbo:** ${metaDiaria.carbo_g}g | **Gordura:** ${metaDiaria.gordura_g}g | **Fibras:** ${metaDiaria.fibra_g}g

## Limitações Físicas e Restrições
${(p.limitacoes || []).map(l => `- ${l}`).join("\n") || "- nenhuma registrada"}

## Hábitos e Restrições Alimentares
${(p.habitos || []).map(h => `- ${h}`).join("\n") || "- não informado"}
${p.notas_livres ? `\n## Notas Livres\n${p.notas_livres}` : ""}

## Treinos Planejados
> Use estes dados para alinhar o plano alimentar ao dia/horário correto (pré-treino e pós-treino).
${(p.treinos_planejados || []).length > 0
  ? (p.treinos_planejados || []).map(t =>
      `- **${t.tipo}** — toda **${t.dia}**, duração **${t.duracao}**${t.horario ? ` às **${t.horario}**` : " (horário não cadastrado)"}`
    ).join("\n")
  : "- nenhum treino cadastrado"}
  </user_profile>

  <document id="macro">
${docs.macro || "(vazio)"}
  </document>

  <document id="micro">
${docs.micro || "(vazio)"}
  </document>

  <document id="memoria">
${docs.mem || "(vazio)"}
  </document>

  <document id="plano_atual">
${relevantPlan.content ? JSON.stringify(relevantPlan.content, null, 2) : "{}"}
  </document>

  <plans_context_window>
    <reference_date>${targetDate}</reference_date>
    <past_plans_count>${relevantPlan.pastPlansCount || 0}</past_plans_count>
    <future_plans_count>${relevantPlan.futurePlansCount || 0}</future_plans_count>
    <past_plans_json>${JSON.stringify(relevantPlan.pastPlans || [], null, 2)}</past_plans_json>
    <future_plans_json>${JSON.stringify(relevantPlan.futurePlans || [], null, 2)}</future_plans_json>
  </plans_context_window>

  <document id="historico">
${docs.hist || "(vazio)"}
  </document>

  <document id="progresso">
${progressoText || "(vazio)"}
  </document>

  <nutrition_today>
${calCtx}

    Últimos 7 treinos registrados:
${treinosCtx}
  </nutrition_today>

  <raw_data>
    <calorias_json>${docs.cal || "{}"}</calorias_json>
    <treinos_json>${docs.treinos || "{}"}</treinos_json>
  </raw_data>
</context>`;
}
