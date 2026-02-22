import { useState, useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   THEME
══════════════════════════════════════════════════════════════════════════ */
const C = {
  p:"#B87850", pl:"#D4956A", pbg:"#FDF5EE",
  w:"#FFFFFF", bg:"#F7F2EC",
  t:"#2C1A0E", m:"#6B4C35", l:"#9E7F68",
  b:"rgba(184,120,80,0.18)",
  ok:"#5A9A5A", okbg:"#EEF5EE",
};

const TAB_LABELS = { plano:"Plano", marcos:"Marcos", historico:"Histórico", micro:"Perfil", memoria:"Anotações", calorias:"Saúde", treinos:"Saúde" };
const TAB_ICONS  = { plano:"📋", marcos:"🏆", historico:"📊", micro:"👤", memoria:"📝", calorias:"🍎", treinos:"🏋️" };
const FILE_TO_TAB = { plano:"plano", marcos:"marcos", historico:"historico", micro:"plano", memoria:"plano", calorias:"saude", treinos:"saude" };

/* ══════════════════════════════════════════════════════════════════════════
   STORAGE
══════════════════════════════════════════════════════════════════════════ */
const SK = { micro:"cr_micro", mem:"cr_mem", hist:"cr_hist", plano:"cr_plano", marcos:"cr_marcos", chat:"cr_chat", convos:"cr_convos", cal:"cr_cal", treinos:"cr_treinos", perfil:"cr_perfil", macro:"cr_macro" };
async function sget(k) { try { const r = await window.storage.get(k); return r.value; } catch { return null; } }
async function sset(k, v) { try { await window.storage.set(k, v); } catch(e) { console.error("sset",k,e); } }

/* ══════════════════════════════════════════════════════════════════════════
   INITIAL DOCS
══════════════════════════════════════════════════════════════════════════ */
const INIT_MICRO = `# MICRO — Perfil Operacional da Renata

## Rotina de Fome

### Manhã
- Acorda enjoada, com leve fome mas sem apetite real
- Funciona com: 1 banana antes do treino
- Difícil: whey de manhã (enjoo)

### Almoço (período mais fácil)
- Base: ~4 col. arroz integral + proteína + salada + legumes
- Enjoa de carne relativamente rápido

### 16h–16h30 (PONTO CRÍTICO)
- Fome + vulnerabilidade ao belisco
- Funciona: pão integral + iogurte vegetal + castanhas + fruta
- Água em quantidade reduz fome

### Noite
- Jantar ideal: ~19h + aperitivo pequeno antes de dormir
- Prefere: proteínas + massas, sabor salgado
- Difícil: salada e fibras pesadas à noite

## Preferências

### Texturas favoritas
- Pastosas, úmidas, cremosas, ensopadas
- Carne ensopada, frango ensopado, polenta, sopas, cremes

### Massas
- Macarrão à bolonhesa (favorito) | Molho branco (gosta)

### Saladas
- Folhas: alface, rúcula, espinafre
- Adicionais: pepino, tomate-cereja, cenoura, beterraba
- Temperos: azeite + sal ou vinagre de maçã

### Legumes
- Chuchu, cenoura (prefere refogada), beterraba (suco ou cozida), mandioca ralada, repolho

### Frutas
- Banana, maçã, pera, mamão

### Doces (gatilho TPM)
- Leite condensado, chocolate branco, Prestígio, Rafaello, Nutella

### Bebidas
- Café: às vezes enjoo | Máx 2 canecas/dia
- Leite quente: vontade quando bate frio à tarde
- Chá: só se sabor intenso

### Suplemento de soja
- Melhor: tarde ou antes de dormir | Só com água

## Restrições
- Intolerância à lactose | Sensibilidade proteína do leite
- Sensibilidade a FODMAPs | Café: máx 2 canecas/dia | Álcool: raramente

## Gatilhos Emocionais
- TPM: muita vontade de doce cremoso
- Escapes aprovados: tâmara, 1 col. leite condensado, chiclete, pirulito, balas de funcho
- Rotina corrida → belisco → solução: marmitas prontas`;

const INIT_MEM = `# Memória do Coach — Anotações Profissionais

## Início do acompanhamento — Fev 2026

- **Insight:** Renata tem autoconhecimento alto. Aceita estratégias quando entende o porquê.
- **Alerta:** Enjoo matinal é padrão forte. Não forçar volume na manhã.
- **Padrão:** A fome das 16h é o ponto de fragilidade principal.
- **Lembrete:** Gosta de checklists e ferramentas de controle.`;

const INIT_HIST = `# Histórico — Registro de Dados e Acompanhamento

## Linha de base — Fev 2026

**Dados:**
- Peso: ~60,5 kg | Gordura: ~21,4%
- Referência anterior: 65,4 kg / ~23,1%
- TMB: 1.397 kcal

**Treinos:**
- Pilates: segunda e quarta (1h)
- Poledance: terça e sexta (1h)

**Meta 2027:** 55–58 kg / <18% gordura`;

const INIT_PLANO = `# Meu Plano — Renata

> Seu guia diário. Consulte sempre que precisar de direção.

## 🌅 Manhã
- 1 banana antes do treino
- Água ao acordar

## 🍽️ Almoço
- 4 col. arroz integral
- Frango ou carne cozida/ensopada
- Salada variada + legumes

## ⚡ Lanche das 16h — CRÍTICO
- Pão integral + iogurte vegetal + castanhas + 1 fruta
- ≥ 500ml de água

## 🌙 Jantar ~19h
- Proteína + massa ou cozido úmido
- Evitar salada pesada e fibras

## ✨ Antes de dormir
- Aperitivo leve se necessário
- Suplemento de soja com água

## 🚨 Estratégias de Escape (TPM & dias difíceis)
1. Beber 500ml água + esperar 15min
2. Tâmara, 1 col. leite condensado, chiclete, pirulito ou bala de funcho

## 💧 Hidratação
- Meta: ≥ 2 litros/dia`;

const INIT_MARCOS = JSON.stringify([{
  id:1, date:"Fev 2026", title:"Início do acompanhamento estruturado",
  type:"Mudança de fase", emoji:"🚀",
  context:"Renata veio de 65,4 → 60,5 kg por conta própria. Inicia acompanhamento integrado.",
  significado:"Ponto de partida oficial.",
}]);

const DEFAULTS = { micro:INIT_MICRO, mem:INIT_MEM, hist:INIT_HIST, plano:INIT_PLANO, marcos:INIT_MARCOS };

const INIT_MACRO = `# MACRO — Quem é a Renata

Meu nome é Renata, tenho 36 anos, moro em Criciúma/SC, e estou numa fase em que eu quero fortalecer meu core para uma futura gestação fim do ano. Moldar meu corpo nesse período seria fantástico — preciso estar forte para um parto normal. Não quero só "fazer dieta e treino", mas construir um jeito de viver que me deixe mais forte, mais definida, com mais energia, e não ser apenas mais uma mãe cansada com a rotina de um recém-nascido.

## Minha evolução

Já estive por volta de 65,4 kg com ~23,1% de gordura, e depois cheguei em ~60,5 kg com ~21,4% de gordura (com boa massa magra). Meu objetivo agora é atualizar minhas medidas e usar isso pra recalibrar o plano, sem achismo.

## O que eu quero de verdade

Tenho uma meta estética bem honesta: quero ficar mais definida, com aparência "gostosa", principalmente melhorando pernas, glúteos e abdômen, mas sem sacrificar a saúde. A intenção por trás disso é maior: eu quero me sentir segura no meu corpo, com energia estável, e sem viver refém de impulso, TPM e belisco. E claro, manter tudo isso com constância durante e após a gestação.

A meta que faz sentido é: ficar entre 55–58 kg e chegar em menos de 18% de gordura, mas do jeito certo — com treino inteligente e alimentação sustentável. Prazo: 2027.

## Meu corpo, minhas limitações

- **Hipermobilidade articular**: vou longe demais na amplitude. Preciso de treino que priorize controle, estabilidade e força de base.
- **Joelho esquerdo**: já tive lesão, fiz fisioterapia, ainda sinto ele "fraco". Cuidado com agachamentos e movimentos que irritem o joelho.
- **Coluna lombar**: extrusão discal em L5-S1 com compressão de raízes de S1. Não posso brincar com exercícios que aumentam pressão nos discos. Foco total em core, glúteos, estabilidade pélvica e mobilidade controlada. Sem ego-lift.
- Histórico de hipotireoidismo (controlado).
- Sonolência e indisposição pós-almoço.

## Minha cabeça

Não quero viver na "perfeição" nem na culpa. Quero um plano que eu consiga seguir mesmo quando estiver cansada, na TPM, ansiosa, com vontade de doce, ou com preguiça. Quero consistência, e valorizo suporte e estrutura no dia a dia — gosto de acompanhar hábitos e rituais com ferramentas e checklists.

No fim, minha intenção é simples e muito séria: quero construir um corpo e uma rotina que eu não perca quando a vida aperta. Quero que meu padrão seja fazer o certo no automático — e que a versão de mim que aparece no espelho em 2027 seja uma mulher mais forte, mais definida, mais segura, e pronta para ser lar de mais um lindo bebê.`;



const INIT_CAL = JSON.stringify({
  meta_diaria: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45 },
  dias: {}
});

const INIT_TREINOS = JSON.stringify({
  planejados: { "seg": "Pilates 1h", "qua": "Pilates 1h", "ter": "Poledance 1h", "sex": "Poledance 1h" },
  registros: []
});

const INIT_PERFIL = JSON.stringify({
  nome: "Renata Detros",
  idade: 36,
  cidade: "Criciúma/SC",
  peso_kg: 60.5,
  gordura_pct: 21.4,
  meta_peso_min: 55,
  meta_peso_max: 58,
  meta_gordura_pct: 18,
  meta_ano: 2027,
  meta_descricao: "Fortalecer core, preparar para gestação fim do ano. Parto normal, não ser mãe cansada.",
  tmb_kcal: 1397,
  agua_litros: 2,
  objetivo_semanal: "Definição corporal — foco em pernas, glúteos e abdômen",
  limitacoes: [
    "Hipermobilidade articular — priorizar controle e estabilidade",
    "Joelho esquerdo — cuidado com agachamentos",
    "Extrusão discal L5-S1 — SEM ego-lift, foco em core/glúteos/estabilidade pélvica",
    "Hipotireoidismo controlado",
    "Intolerância à lactose + sensibilidade à proteína do leite",
    "Sensibilidade a FODMAPs"
  ],
  treinos_planejados: [
    { dia: "seg", tipo: "Pilates", duracao: "1h" },
    { dia: "qua", tipo: "Pilates", duracao: "1h" },
    { dia: "ter", tipo: "Poledance", duracao: "1h" },
    { dia: "sex", tipo: "Poledance", duracao: "1h" }
  ],
  habitos: [
    "Café: máximo 2 canecas por dia (enjoo se passar)",
    "Álcool: raramente",
    "Intolerância à lactose",
    "Sensibilidade à proteína do leite",
    "Sensibilidade a FODMAPs"
  ],
  notas_livres: ""
});



/* ══════════════════════════════════════════════════════════════════════════
   SYSTEM PROMPT
══════════════════════════════════════════════════════════════════════════ */
function buildPrompt(docs) {
  const today = new Date().toLocaleDateString("pt-BR");
  const weekday = new Date().toLocaleDateString("pt-BR", { weekday:"long" });
  let marcosText = docs.marcos;
  try { marcosText = JSON.stringify(JSON.parse(docs.marcos), null, 2); } catch {}

  // Parse caloric and workout data for context
  let calObj = {}; let treinosObj = {};
  try { calObj = JSON.parse(docs.cal || "{}"); } catch {}
  try { treinosObj = JSON.parse(docs.treinos || "{}"); } catch {}
  const todayCal = calObj.dias?.[today] || null;
  const metaDiaria = calObj.meta_diaria || { kcal:1450, proteina_g:115, carbo_g:110, gordura_g:45 };
  const calCtx = todayCal
    ? `Hoje (${today}): ${todayCal.kcal_consumido||0}kcal consumidas de ${metaDiaria.kcal}kcal meta | Proteína: ${todayCal.proteina_g||0}g/${metaDiaria.proteina_g}g | Carbo: ${todayCal.carbo_g||0}g/${metaDiaria.carbo_g}g | Gordura: ${todayCal.gordura_g||0}g/${metaDiaria.gordura_g}g\nRefeições hoje: ${(todayCal.refeicoes||[]).join("; ") || "nenhuma registrada"}`
    : `Hoje (${today}): nenhum dado calórico registrado ainda.`;

  const ultTreinos = (treinosObj.registros||[]).slice(-7);
  const treinosCtx = ultTreinos.length > 0
    ? ultTreinos.map(t => `${t.data} — ${t.tipo}${t.realizado ? " ✓" : " ✗"}${t.notas ? " ("+t.notas+")" : ""}`).join("\n")
    : "Nenhum treino registrado ainda.";

  // Parse user profile
  let p = {};
  try { p = JSON.parse(docs.perfil || "{}"); } catch {}
  const metaCal = p.tmb_kcal ? Math.round(p.tmb_kcal * 1.04) : 1450;
  const limStr  = (p.limitacoes || []).join(" | ") || "nenhuma registrada";
  const treinoPl = (p.treinos_planejados || []).map(t => `${t.tipo} ${t.dia}/${t.duracao}`).join(", ") || "não informado";

  return `Você é o coach pessoal de ${p.nome || "Renata"}. Data: ${today} (${weekday}).

━━━ PERFIL DO USUÁRIO ━━━
Nome: ${p.nome || "Renata"} | Idade: ${p.idade || "?"} anos | Cidade: ${p.cidade || "?"}
Peso atual: ${p.peso_kg || "?"}kg / ${p.gordura_pct || "?"}% gordura
Meta: ${p.meta_peso_min || 55}–${p.meta_peso_max || 58}kg / <${p.meta_gordura_pct || 18}% gordura até ${p.meta_ano || 2027}
Objetivo: ${p.meta_descricao || "não informado"}
TMB: ${p.tmb_kcal || 1397}kcal | Meta calórica: ~${metaCal}kcal/dia | Água: ≥${p.agua_litros || 2}L/dia
Limitações físicas: ${limStr}
Treinos planejados: ${treinoPl}
Hábitos e restrições: ${(p.habitos||[]).join(" | ") || "não informado"}
${p.notas_livres ? "Notas: " + p.notas_livres : ""}

━━━ MACRO — Contexto geral ━━━
${docs.macro}

━━━ ARQUIVOS VIVOS ━━━

MICRO_Renata.md:
${docs.micro}

Memoria_Coach.md:
${docs.mem}

Plano_Renata.md:
${docs.plano}

Historico.md:
${docs.hist}

Marcos:
${marcosText}

━━━ CONTROLE CALÓRICO E TREINOS ━━━

Meta diária: ${metaDiaria.kcal}kcal | Proteína ${metaDiaria.proteina_g}g | Carbo ${metaDiaria.carbo_g}g | Gordura ${metaDiaria.gordura_g}g

${calCtx}

Últimos 7 treinos:
${treinosCtx}

Calorias_completo (JSON para edição):
${docs.cal}

Treinos_completo (JSON para edição):
${docs.treinos}

━━━ REGRAS DE CONDUTA (OBRIGATÓRIAS) ━━━

1. RESPOSTAS CURTAS. Máximo 6 linhas de texto. Sem parágrafos longos. Sem introduções. Vá direto ao ponto.

2. FORMATAÇÃO SIMPLES. Use apenas:
   - Quebras de linha (\n) para separar itens
   - Hífen (-) para listas
   - *texto* para negrito (UM asterisco de cada lado, não dois)
   NUNCA use **texto** com dois asteriscos — não renderiza. NUNCA use headers (##). NUNCA use blocos longos.

3. PROTOCOLO DE DOCE (INEGOCIÁVEL):
   Se Renata pede doce ou parece ansiosa, NUNCA ofereça doce diretamente.
   Primeiro: "Bebe 500ml de água agora e espera 15 min. Se ainda quiser, aí sim."
   Só após confirmação ou no Nível 3 (TPM intensa + dia pesado) ofereça opção planejada.

4. ATUALIZAR PLANO. Se Renata pedir explicitamente para alterar o plano (ex: "altere meu plano", "muda meu plano"), você DEVE incluir um update com file:"plano", action:"replace_all" com o plano COMPLETO atualizado. NÃO pergunte se quer atualizar — atualize diretamente e informe.

5. GESTÃO DE MEMÓRIA (SKILL gestao-memoria):
   Após cada interação, avalie:
   - Info sobre quem ela é/gosta/funciona → file:"micro" (sem permissão: info nova; com permissão: contradição/remoção)
   - Insight/padrão seu como profissional → file:"memoria", action:"append"
   - Dado objetivo/medição/relato → file:"historico", veja regra abaixo
   - Mudança no que ela faz no dia a dia → file:"plano", action:"replace_all" (plano completo)
   - Conquista/marco relevante → file:"marcos", action:"add_marco"
   - Refeição/alimento consumido com kcal ou macros → file:"calorias", action:"replace_all" (JSON completo atualizado)
   - Treino realizado ou perdido → file:"treinos", action:"replace_all" (JSON completo atualizado)

   REGRA CALORIAS — Como atualizar o JSON de calorias:
   Ao receber relato de refeição (ex: "comi X com Y kcal"), atualize o JSON de Calorias_completo:
   - Some a kcal, proteína, carbo e gordura ao dia atual (${today})
   - Adicione a refeição na lista refeicoes[] do dia
   - Se correção: substitua o dado errado no mesmo dia (replace_all sem duplicar)
   - Estime macros se não informados (baseie-se em valores médios conhecidos)
   - Sempre devolva o JSON COMPLETO no content do update

   REGRA TREINOS — Como atualizar o JSON de treinos:
   Ao receber relato de treino (ex: "fiz pilates hoje", "perdi o pole hoje"):
   - Adicione/atualize registro em registros[] com: data, tipo, duracao_min, realizado (true/false), notas
   - Se já existe registro do mesmo dia e tipo: substitua (replace_all, não duplique)
   - Sempre devolva o JSON COMPLETO no content do update

   USE ESSAS INFORMAÇÕES PARA ORIENTAR:
   - Se kcal abaixo da meta → incentive proteína na próxima refeição
   - Se proteína baixa → sugira fonte proteica específica
   - Se treinou hoje → pode ser mais flexível na refeição pós-treino
   - Se não treinou dia planejado → sem compensação calórica extra

   REGRA CRÍTICA — HISTÓRICO (evitar ruído e consumo desnecessário de contexto):
   - Dado NOVO (primeiro relato) → action:"append" (adiciona ao histórico)
   - CORREÇÃO de dado já registrado na mesma sessão (ex: "errei, eram 50g não 80g") → action:"replace_all" com o histórico COMPLETO corrigido, substituindo a entrada errada.
   NUNCA crie um novo registro para uma correção. Corrija o registro existente.
   Exemplo: se registrou "3 coxinhas 80g = 730kcal" e ela corrige para 50g, use replace_all com o histórico inteiro onde aquela entrada aparece corrigida para "3 coxinhas 50g = 460kcal". Remova o registro errado completamente.

━━━ FORMATO DE SAÍDA ━━━

Sua resposta é validada por JSON Schema. Campos obrigatórios: reply (string) e updates (array).

Para updates:
- file: "micro" | "memoria" | "historico" | "plano" | "marcos" | "calorias" | "treinos"
- action: "append" | "replace_all" | "add_marco"
- content: string com o conteúdo a registrar
- requiresPermission: false (maioria) | true (contradição/remoção no MICRO)
- permissionMessage: "" vazio ou "Percebi que [X]. Posso atualizar seu perfil?" se requiresPermission=true

Para add_marco, content é JSON serializado: {"title":"...","type":"Conquista","context":"...","significado":"..."}
Tipos de marco: "Conquista" | "Obstáculo superado" | "Mudança de fase" | "Dificuldade"

Se não há nada a registrar: updates: []`;
}



/* ══════════════════════════════════════════════════════════════════════════
   APPLY UPDATE
══════════════════════════════════════════════════════════════════════════ */
const FILE_TO_STATE = { micro:"micro", memoria:"mem", historico:"hist", plano:"plano", marcos:"marcos", calorias:"cal", treinos:"treinos" };
const STATE_TO_SK   = { micro:SK.micro, mem:SK.mem, hist:SK.hist, plano:SK.plano, marcos:SK.marcos, cal:SK.cal, treinos:SK.treinos };
const MARCO_EMOJIS  = { "Conquista":"🏆", "Obstáculo superado":"💪", "Mudança de fase":"🔄", "Dificuldade":"📌" };

async function applyUpdate(update, docs) {
  const stateKey = FILE_TO_STATE[update.file];
  if (!stateKey) return docs;
  const nd = { ...docs };
  try {
    if (update.file === "marcos" && update.action === "add_marco") {
      const marco = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
      const arr = JSON.parse(docs.marcos || "[]");
      arr.push({ id:Date.now(), date:new Date().toLocaleDateString("pt-BR",{month:"short",year:"numeric"}), emoji:MARCO_EMOJIS[marco.type]||"🏆", ...marco });
      nd.marcos = JSON.stringify(arr);
      await sset(SK.marcos, nd.marcos);
    } else if (update.action === "append") {
      nd[stateKey] = (docs[stateKey] || "") + "\n\n" + update.content;
      await sset(STATE_TO_SK[stateKey], nd[stateKey]);
    } else if (update.action === "replace_all") {
      nd[stateKey] = update.content;
      await sset(STATE_TO_SK[stateKey], update.content);
    }
  } catch(e) { console.error("applyUpdate:", e); }
  return nd;
}

/* ══════════════════════════════════════════════════════════════════════════
   INLINE TEXT RENDERER — handles *bold*, line breaks, - lists
══════════════════════════════════════════════════════════════════════════ */
function renderInline(text) {
  const parts = text.split(/\*(.*?)\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight:"700" }}>{p}</strong>
      : p
  );
}

function ChatBubbleContent({ text }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        const isList = line.trim().startsWith("- ");
        const content = isList ? line.trim().slice(2) : line;
        if (!content.trim() && i < lines.length - 1) return <div key={i} style={{ height:"6px" }} />;
        return (
          <div key={i} style={{ display:"flex", gap: isList ? "7px" : "0", marginBottom: isList ? "3px" : "0" }}>
            {isList && <span style={{ opacity:0.6, flexShrink:0, marginTop:"1px" }}>–</span>}
            <span style={{ lineHeight:"1.6" }}>{renderInline(content)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   UPDATE SHORTCUT CARD — shown in chat after memory updates
══════════════════════════════════════════════════════════════════════════ */
function UpdateCard({ file, onGo }) {
  const tab = FILE_TO_TAB[file] || "plano";
  const label = TAB_LABELS[file] || file;
  const icon  = TAB_ICONS[file]  || "📄";
  const descriptions = {
    plano:"Plano atualizado com a mudança solicitada.",
    marcos:"Novo marco registrado na sua jornada.",
    historico:"Dado registrado no seu histórico.",
    micro:"Perfil atualizado com nova informação.",
    memoria:"Anotação registrada pelo coach.",
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 13px", background:C.pbg, border:`1.5px solid ${C.b}`, borderRadius:"12px", margin:"4px 0 6px" }}>
      <span style={{ fontSize:"18px" }}>{icon}</span>
      <div style={{ flex:1 }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12.5px", lineHeight:"1.4" }}>
          {descriptions[file] || `${label} atualizado.`}
        </p>
      </div>
      <button onClick={onGo} style={{ padding:"6px 13px", background:C.p, color:"#FFF", border:"none", borderRadius:"8px", fontFamily:"'DM Sans',sans-serif", fontSize:"12px", fontWeight:"700", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
        Ver {label} →
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PERMISSION CARD
══════════════════════════════════════════════════════════════════════════ */
function PermCard({ msg, onYes, onNo }) {
  return (
    <div style={{ background:"#FFF9F5", border:`1.5px solid ${C.p}`, borderRadius:"14px", padding:"13px 15px", margin:"8px 0" }}>
      <div style={{ display:"flex", gap:"9px", marginBottom:"11px", alignItems:"flex-start" }}>
        <span style={{ fontSize:"18px", flexShrink:0 }}>🔔</span>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.t, fontSize:"13.5px", lineHeight:"1.6" }}>{msg}</p>
      </div>
      <div style={{ display:"flex", gap:"8px" }}>
        <button onClick={onYes} style={{ flex:1, padding:"9px", background:C.p, color:"#FFF", border:"none", borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", fontWeight:"600", cursor:"pointer" }}>✓ Sim, atualizar</button>
        <button onClick={onNo}  style={{ padding:"9px 16px", background:"transparent", color:C.l, border:`1px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", cursor:"pointer" }}>Não</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHAT MESSAGE
══════════════════════════════════════════════════════════════════════════ */
function ChatMsg({ msg }) {
  const u = msg.role === "user";
  return (
    <div style={{ display:"flex", justifyContent:u?"flex-end":"flex-start", marginBottom:"13px", gap:"9px", alignItems:"flex-end" }}>
      {!u && <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>🌿</div>}
      <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:u?"18px 18px 4px 18px":"18px 18px 18px 4px", background:u?`linear-gradient(135deg,${C.p},#9A6040)`:C.w, color:u?"#FDF5EE":C.t, fontSize:"14px", fontFamily:"'DM Sans',sans-serif", boxShadow:u?`0 2px 10px ${C.p}30`:"0 1px 8px rgba(0,0,0,0.07)", wordBreak:"break-word" }}>
        <ChatBubbleContent text={msg.content} />
      </div>
      {u && <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"linear-gradient(135deg,#C4956A,#A07050)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>🌸</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHAT TAB
══════════════════════════════════════════════════════════════════════════ */
function ChatTab({ docs, setDocs, messages, setMessages, docsReady, setTab, onNewConvo, onHistory, onGeneratePlan, generating }) {
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [pendingPerms, setPPerms] = useState([]);
  // Each item: { file, onGo }
  const [updateCards, setCards]   = useState([]);
  const bottomRef = useRef(null);
  const taRef     = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading, pendingPerms, updateCards]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !docsReady) return;
    const userMsg = { role:"user", content:text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    setCards([]);

    try {
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role:m.role, content:m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          thinking: { type: "enabled", budget_tokens: 5000 },
          system: buildPrompt(docs),
          messages: [...apiMsgs, { role: "assistant", content: "{" }],
        }),
      });
      const data = await res.json();

      // Surface API errors clearly
      if (!res.ok || data.error) {
        const errMsg = data.error?.message || `Erro ${res.status}: ${res.statusText}`;
        console.error("Anthropic API error:", data);
        setMessages(prev => [...prev, { role:"assistant", content:`⚠️ Erro da API: ${errMsg}` }]);
        setLoading(false);
        return;
      }

      const textBlock = data.content?.find(b => b.type === "text")?.text;
      if (!textBlock) {
        console.error("No text block in response:", data);
        setMessages(prev => [...prev, { role:"assistant", content:"⚠️ Resposta inesperada da API. Tente novamente." }]);
        setLoading(false);
        return;
      }

      // Prefill adds "{" — reconstruct full JSON and strip any markdown fences
      const rawJson = ("{" + textBlock)
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      const parsed = JSON.parse(rawJson);

      const aiMsg  = { role:"assistant", content:parsed.reply || "..." };
      const updates = parsed.updates || [];

      const direct = updates.filter(u => !u.requiresPermission);
      const perms  = updates.filter(u =>  u.requiresPermission);

      // Apply direct updates
      let newDocs = docs;
      const cards = [];
      for (const u of direct) {
        newDocs = await applyUpdate(u, newDocs);
        const tab = FILE_TO_TAB[u.file];
        // Only show card for visible tabs
        if (["plano","marcos","historico"].includes(tab)) {
          cards.push({ file:u.file, tab });
        }
      }
      setDocs(newDocs);
      setCards(cards);

      if (perms.length > 0) {
        setPPerms(prev => [...prev, ...perms.map(u => ({ id:Date.now()+Math.random(), update:u }))]);
      }

      const finalMsgs = [...newMsgs, aiMsg];
      setMessages(finalMsgs);
      await sset(SK.chat, JSON.stringify(finalMsgs.slice(-60)));
    } catch(e) {
      console.error("send() exception:", e);
      setMessages(prev => [...prev, { role:"assistant", content:`⚠️ Erro: ${e?.message || String(e)}` }]);
    }
    setLoading(false);
  }

  async function handlePerm(permId, approved) {
    const perm = pendingPerms.find(p => p.id===permId);
    if (!perm) return;
    setPPerms(prev => prev.filter(p => p.id!==permId));
    if (approved) {
      const newDocs = await applyUpdate(perm.update, docs);
      setDocs(newDocs);
      const tab = FILE_TO_TAB[perm.update.file];
      if (["plano","marcos","historico"].includes(tab)) {
        setCards(prev => [...prev, { file:perm.update.file, tab }]);
      }
    }
    const note = approved ? "✓ Perfil atualizado." : "Ok, mantive como estava.";
    const noteMsgs = [...messages, { role:"assistant", content:note }];
    setMessages(noteMsgs);
    await sset(SK.chat, JSON.stringify(noteMsgs.slice(-60)));
  }

  const quickActions = ["Como foi minha semana?","Lanche da tarde ideal 🍎","Estou na TPM 😩","O que jantar hoje?"];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0, background:C.bg }}>
      <div style={{ flex:1, overflowY:"auto", padding:"18px 15px 8px", display:"flex", flexDirection:"column" }}>
        {!docsReady && <div style={{ textAlign:"center", marginTop:"40px", color:C.l, fontFamily:"'DM Sans',sans-serif", fontSize:"14px" }}>Carregando memória...</div>}

        {docsReady && messages.length === 0 && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"16px 10px" }}>
            <div style={{ width:"76px", height:"76px", borderRadius:"24px", background:`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"34px", marginBottom:"18px", boxShadow:`0 8px 28px ${C.p}40` }}>🌿</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"23px", fontWeight:"700", marginBottom:"9px" }}>Olá, Renata!</h3>
            <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"14px", lineHeight:"1.7", maxWidth:"270px" }}>Estou aqui para te acompanhar. Como você está hoje?</p>
            {/* Primary CTA */}
            <button onClick={onGeneratePlan} disabled={generating}
              style={{ marginTop:"22px", width:"100%", maxWidth:"310px", padding:"14px 20px", background:generating?"#D4956A80":`linear-gradient(135deg,${C.pl},${C.p})`, color:"#FFF", border:"none", borderRadius:"16px", fontFamily:"'DM Sans',sans-serif", fontSize:"15px", fontWeight:"700", cursor:generating?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", boxShadow:`0 4px 16px ${C.p}40` }}>
              {generating ? "🌿 Gerando plano..." : "✨ Gerar plano do dia"}
            </button>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginTop:"12px", width:"100%", maxWidth:"310px" }}>
              {quickActions.map(s => (
                <button key={s} onClick={() => { setInput(s); taRef.current?.focus(); }} style={{ padding:"11px 12px", background:C.w, border:`1.5px solid ${C.b}`, borderRadius:"14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", textAlign:"left", lineHeight:"1.4" }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <ChatMsg key={i} msg={m} />)}

        {loading && (
          <div style={{ display:"flex", alignItems:"flex-end", gap:"9px", marginBottom:"13px" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px" }}>🌿</div>
            <div style={{ padding:"10px 15px", background:C.w, borderRadius:"18px 18px 18px 4px", boxShadow:"0 1px 8px rgba(0,0,0,0.07)", display:"flex", gap:"5px", alignItems:"center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:C.p, animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}

        {/* Update shortcut cards */}
        {updateCards.map((card, i) => (
          <UpdateCard key={i} file={card.file} onGo={() => { setCards([]); setTab(card.tab); }} />
        ))}

        {/* Permission cards */}
        {pendingPerms.map(p => (
          <PermCard key={p.id} msg={p.update.permissionMessage} onYes={() => handlePerm(p.id, true)} onNo={() => handlePerm(p.id, false)} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"10px 14px 14px", background:C.w, borderTop:`1px solid ${C.b}`, display:"flex", gap:"9px", alignItems:"flex-end" }}>
        <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={docsReady ? "Escreva aqui... (Enter envia)" : "Carregando..."}
          disabled={!docsReady} rows={1}
          style={{ flex:1, padding:"11px 15px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"22px", fontFamily:"'DM Sans',sans-serif", fontSize:"14px", color:C.t, outline:"none", resize:"none", lineHeight:"1.5", maxHeight:"88px", overflowY:"auto" }} />
        <button onClick={send} disabled={!input.trim()||loading||!docsReady}
          style={{ width:"40px", height:"40px", borderRadius:"50%", border:"none", cursor:(!input.trim()||loading||!docsReady)?"not-allowed":"pointer", background:(!input.trim()||loading||!docsReady)?"#E0D4C8":`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", flexShrink:0, transition:"all 0.2s", color:(!input.trim()||loading||!docsReady)?"#A09080":"#FFF", boxShadow:(!input.trim()||loading||!docsReady)?"none":`0 2px 10px ${C.p}50` }}>➤</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIMPLE MARKDOWN RENDERER — for Plano / Histórico
══════════════════════════════════════════════════════════════════════════ */
function MD({ content }) {
  if (!content) return <p style={{ color:C.l, fontFamily:"'DM Sans',sans-serif", fontSize:"14px" }}>Carregando...</p>;
  return (
    <div>
      {content.split("\n").map((line, i) => {
        const trim = line.trim();
        if (!trim || trim==="---") return <div key={i} style={{ height:"8px" }} />;
        if (line.startsWith("# "))   return <h1 key={i} style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"20px", fontWeight:"700", marginBottom:"2px", marginTop:"4px" }}>{line.slice(2)}</h1>;
        if (line.startsWith("## "))  return <h2 key={i} style={{ fontFamily:"'Playfair Display',serif", color:C.m, fontSize:"16px", fontWeight:"700", marginTop:"18px", marginBottom:"4px", paddingBottom:"4px", borderBottom:`1px solid ${C.b}` }}>{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12px", fontWeight:"700", marginTop:"12px", marginBottom:"4px", textTransform:"uppercase", letterSpacing:"0.07em" }}>{line.slice(4)}</h3>;
        if (line.startsWith("> "))   return <div key={i} style={{ background:C.pbg, borderLeft:`3px solid ${C.p}`, padding:"8px 12px", borderRadius:"0 8px 8px 0", fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13px", fontStyle:"italic", margin:"4px 0" }}>{line.slice(2)}</div>;
        if (line.match(/^[-*] /)) {
          return (
            <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"5px" }}>
              <span style={{ color:C.p, flexShrink:0, marginTop:"2px" }}>•</span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13.5px", lineHeight:"1.55" }}>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (trim.match(/^\d+\. /)) {
          const num = trim.match(/^(\d+)\. /)[1];
          return (
            <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"5px" }}>
              <span style={{ color:C.p, flexShrink:0, fontWeight:"700", fontSize:"13px", minWidth:"16px" }}>{num}.</span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13.5px", lineHeight:"1.55" }}>{renderInline(trim.replace(/^\d+\. /,""))}</span>
            </div>
          );
        }
        return <p key={i} style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13.5px", lineHeight:"1.6", marginBottom:"2px" }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PLANO TAB
══════════════════════════════════════════════════════════════════════════ */
function PlanoTab({ plano, onGeneratePlan, generating }) {
  const today = new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long" });
  return (
    <div style={{ overflowY:"auto", height:"100%", background:C.bg }}>
      <div style={{ padding:"14px 16px 28px" }}>

        {/* Generate plan banner */}
        <div style={{ background:`linear-gradient(135deg,${C.pl}22,${C.p}18)`, border:`1.5px solid ${C.p}40`, borderRadius:"18px", padding:"16px", marginBottom:"14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px" }}>
            <div>
              <p style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"15px", fontWeight:"700", marginBottom:"4px" }}>📅 Plano de hoje</p>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12px", lineHeight:"1.5", textTransform:"capitalize" }}>{today}</p>
            </div>
            <button onClick={onGeneratePlan} disabled={generating}
              style={{ padding:"10px 16px", background:generating?"#D4956A80":C.p, color:"#FFF", border:"none", borderRadius:"12px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", fontWeight:"700", cursor:generating?"not-allowed":"pointer", whiteSpace:"nowrap", flexShrink:0, display:"flex", alignItems:"center", gap:"6px", boxShadow:`0 3px 12px ${C.p}35` }}>
              {generating ? <><span style={{ display:"inline-block", animation:"bounce 1s infinite", fontSize:"14px" }}>🌿</span> Gerando...</> : "✨ Gerar plano"}
            </button>
          </div>
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11.5px", lineHeight:"1.6", marginTop:"10px", borderTop:`1px solid ${C.b}`, paddingTop:"10px" }}>
            O coach analisa seu histórico, metas e preferências para montar um plano variado e adaptado ao seu dia.
          </p>
        </div>

        <div style={{ background:C.w, borderRadius:"16px", padding:"18px", border:`1px solid ${C.b}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
          <MD content={plano} />
        </div>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", textAlign:"center", marginTop:"14px" }}>
          ✏️ Este plano é atualizado automaticamente pelo coach.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MARCOS TAB
══════════════════════════════════════════════════════════════════════════ */
const TYPE_COLORS = { "Conquista":"#6A9E5A","Mudança de fase":"#B87850","Obstáculo superado":"#5A7EA3","Dificuldade":"#A35A5A" };

function MarcosTab({ marcos }) {
  let arr = [];
  try { arr = JSON.parse(marcos || "[]"); } catch {}
  return (
    <div style={{ overflowY:"auto", height:"100%", background:C.bg }}>
      <div style={{ padding:"14px 15px 28px" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"13px", marginBottom:"14px" }}>
          Conquistas e momentos da sua jornada.
          <br/><span style={{ fontSize:"11px" }}>💡 O coach registra marcos automaticamente nas conversas.</span>
        </p>
        {arr.length === 0 && (
          <div style={{ textAlign:"center", marginTop:"40px" }}>
            <div style={{ fontSize:"40px", marginBottom:"12px" }}>🌱</div>
            <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"14px" }}>Ainda sem marcos. Sua jornada está apenas começando!</p>
          </div>
        )}
        <div style={{ position:"relative" }}>
          {arr.length > 0 && <div style={{ position:"absolute", left:"19px", top:"20px", bottom:"0", width:"2px", background:`linear-gradient(to bottom,${C.p},${C.p}10)` }} />}
          {[...arr].reverse().map(m => (
            <div key={m.id} style={{ display:"flex", gap:"13px", marginBottom:"14px" }}>
              <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0, zIndex:1, position:"relative", boxShadow:`0 2px 8px ${C.p}30` }}>{m.emoji||"🏆"}</div>
              <div style={{ flex:1, background:C.w, borderRadius:"14px", padding:"12px 14px", boxShadow:"0 1px 5px rgba(0,0,0,0.05)", border:`1px solid ${C.b}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"8px", marginBottom:"4px" }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"14px", fontWeight:"700" }}>{m.title}</span>
                  <span style={{ padding:"2px 8px", borderRadius:"8px", fontSize:"10px", background:`${TYPE_COLORS[m.type]||C.p}20`, color:TYPE_COLORS[m.type]||C.p, fontFamily:"'DM Sans',sans-serif", fontWeight:"600", whiteSpace:"nowrap", flexShrink:0 }}>{m.type}</span>
                </div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px", marginBottom:"6px" }}>{m.date}</div>
                {m.context     && <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"13px", lineHeight:"1.6", marginBottom:"4px" }}>{m.context}</p>}
                {m.significado && <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", fontStyle:"italic", lineHeight:"1.5" }}>✨ {m.significado}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTÓRICO TAB
══════════════════════════════════════════════════════════════════════════ */
function HistTab({ hist }) {
  return (
    <div style={{ overflowY:"auto", height:"100%", background:C.bg }}>
      <div style={{ padding:"14px 16px 28px" }}>
        <div style={{ background:C.p, borderRadius:"18px", padding:"16px", marginBottom:"14px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:"-30px", right:"-30px", width:"130px", height:"130px", borderRadius:"50%", background:"rgba(255,255,255,0.07)" }} />
          <div style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.7)", fontSize:"11px", fontWeight:"600", marginBottom:"12px", textTransform:"uppercase", letterSpacing:"0.08em", position:"relative" }}>📈 Evolução Geral</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", position:"relative" }}>
            {[{l:"Peso perdido",v:"−4,9 kg",s:"65,4 → 60,5 kg"},{l:"Gordura −",v:"−1,7%",s:"23,1% → 21,4%"},{l:"Meta peso",v:"55–58 kg",s:"até 2027"},{l:"Meta gordura",v:"<18%",s:"até 2027"}].map((x,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.14)", borderRadius:"12px", padding:"10px 12px" }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.6)", fontSize:"10px", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:"2px" }}>{x.l}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", color:"#FFF", fontSize:"20px", fontWeight:"700" }}>{x.v}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.5)", fontSize:"10px" }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:C.w, borderRadius:"16px", padding:"18px", border:`1px solid ${C.b}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
          <MD content={hist} />
        </div>
        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", textAlign:"center", marginTop:"14px" }}>
          ✏️ O histórico é atualizado automaticamente pelo coach quando você relata dados.
        </p>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   PERFIL TAB — Configurações do usuário
══════════════════════════════════════════════════════════════════════════ */
function Field({ label, value, onChange, type="text", hint, multiline }) {
  return (
    <div style={{ marginBottom:"14px" }}>
      <label style={{ display:"block", fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"11.5px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>{label}</label>
      {hint && <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px", marginBottom:"5px", lineHeight:"1.4" }}>{hint}</p>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            style={{ width:"100%", padding:"9px 12px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13.5px", color:C.t, outline:"none", resize:"vertical", lineHeight:"1.5" }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)}
            style={{ width:"100%", padding:"9px 12px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13.5px", color:C.t, outline:"none" }} />
      }
    </div>
  );
}

function PerfilTab({ perfil, onSave, macro, micro, onSaveMacro, onSaveMicro }) {
  const [p, setP]         = useState({});
  const [saved, setSaved]   = useState(false);
  const [modal, setModal]   = useState(null); // null | "macro" | "micro"
  const [modalText, setModalText] = useState("");
  const [modalSaved, setModalSaved] = useState(false);

  function openModal(type) {
    setModalText(type === "macro" ? macro : micro);
    setModal(type);
    setModalSaved(false);
  }
  async function saveModal() {
    if (modal === "macro") await onSaveMacro(modalText);
    else await onSaveMicro(modalText);
    setModalSaved(true);
    setTimeout(() => { setModalSaved(false); setModal(null); }, 1200);
  }

  useEffect(() => {
    try { setP(JSON.parse(perfil || "{}")); } catch { setP({}); }
  }, [perfil]);

  function set(key, val) { setP(prev => ({ ...prev, [key]: val })); }

  function setLimitacao(i, val) {
    const arr = [...(p.limitacoes || [])];
    arr[i] = val;
    set("limitacoes", arr);
  }
  function addLimitacao()    { set("limitacoes", [...(p.limitacoes || []), ""]); }
  function removeLimitacao(i){ set("limitacoes", (p.limitacoes||[]).filter((_,j) => j!==i)); }

  function setTreino(i, key, val) {
    const arr = [...(p.treinos_planejados || [])];
    arr[i] = { ...arr[i], [key]: val };
    set("treinos_planejados", arr);
  }
  function addTreino()    { set("treinos_planejados", [...(p.treinos_planejados||[]), { dia:"seg", tipo:"", duracao:"1h" }]); }
  function removeTreino(i){ set("treinos_planejados", (p.treinos_planejados||[]).filter((_,j) => j!==i)); }

  async function save() {
    await onSave(JSON.stringify(p, null, 2));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const DIAS = ["seg","ter","qua","qui","sex","sab","dom"];

  const sectionStyle = { background:C.w, borderRadius:"16px", padding:"18px", marginBottom:"12px", border:`1px solid ${C.b}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" };
  const secTitle = (icon, title) => (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px", paddingBottom:"10px", borderBottom:`1px solid ${C.b}` }}>
      <span style={{ fontSize:"18px" }}>{icon}</span>
      <h3 style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"16px", fontWeight:"700" }}>{title}</h3>
    </div>
  );

  return (
    <div style={{ overflowY:"auto", height:"100%", background:C.bg }}>
      <div style={{ padding:"14px 15px 90px" }}>

        {/* ── IDENTIDADE ── */}
        <div style={sectionStyle}>
          {secTitle("👤", "Identidade")}
          <Field label="Nome completo" value={p.nome||""} onChange={v => set("nome",v)} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            <Field label="Idade" value={p.idade||""} type="number" onChange={v => set("idade", Number(v))} />
            <Field label="Cidade" value={p.cidade||""} onChange={v => set("cidade",v)} />
          </div>
        </div>

        {/* ── DADOS CORPORAIS ── */}
        <div style={sectionStyle}>
          {secTitle("⚖️", "Dados corporais")}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            <Field label="Peso atual (kg)" value={p.peso_kg||""} type="number" onChange={v => set("peso_kg", Number(v))} />
            <Field label="Gordura atual (%)" value={p.gordura_pct||""} type="number" onChange={v => set("gordura_pct", Number(v))} />
            <Field label="Meta peso mín (kg)" value={p.meta_peso_min||""} type="number" onChange={v => set("meta_peso_min", Number(v))} />
            <Field label="Meta peso máx (kg)" value={p.meta_peso_max||""} type="number" onChange={v => set("meta_peso_max", Number(v))} />
            <Field label="Meta gordura (%)" value={p.meta_gordura_pct||""} type="number" onChange={v => set("meta_gordura_pct", Number(v))} />
            <Field label="Ano da meta" value={p.meta_ano||""} type="number" onChange={v => set("meta_ano", Number(v))} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginTop:"4px" }}>
            <Field label="TMB (kcal)" value={p.tmb_kcal||""} type="number" onChange={v => set("tmb_kcal", Number(v))} hint="Taxa Metabólica Basal" />
            <Field label="Água mínima (L/dia)" value={p.agua_litros||""} type="number" onChange={v => set("agua_litros", Number(v))} />
          </div>
        </div>

        {/* ── OBJETIVO ── */}
        <div style={sectionStyle}>
          {secTitle("🎯", "Objetivo e contexto")}
          <Field label="Objetivo principal" value={p.meta_descricao||""} onChange={v => set("meta_descricao",v)} multiline hint="Descreva seu objetivo, motivação e contexto de vida atual." />
          <Field label="Foco semanal" value={p.objetivo_semanal||""} onChange={v => set("objetivo_semanal",v)} />
        </div>

        {/* ── LIMITAÇÕES FÍSICAS ── */}
        <div style={sectionStyle}>
          {secTitle("⚠️", "Limitações físicas e restrições")}
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", marginBottom:"12px", lineHeight:"1.5" }}>O coach usa isso para evitar exercícios/alimentos que possam te prejudicar.</p>
          {(p.limitacoes||[]).map((lim, i) => (
            <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
              <input value={lim} onChange={e => setLimitacao(i, e.target.value)}
                style={{ flex:1, padding:"8px 12px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", color:C.t, outline:"none" }} />
              <button onClick={() => removeLimitacao(i)}
                style={{ width:"34px", height:"34px", borderRadius:"8px", border:`1px solid ${C.b}`, background:C.w, cursor:"pointer", color:C.l, fontSize:"14px", flexShrink:0 }}>✕</button>
            </div>
          ))}
          <button onClick={addLimitacao}
            style={{ padding:"8px 14px", background:"transparent", border:`1.5px dashed ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"13px", cursor:"pointer", width:"100%", marginTop:"4px" }}>
            + Adicionar limitação
          </button>
        </div>

        {/* ── TREINOS PLANEJADOS ── */}
        <div style={sectionStyle}>
          {secTitle("🏋️", "Treinos planejados")}
          {(p.treinos_planejados||[]).map((t, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 60px 34px", gap:"8px", marginBottom:"8px", alignItems:"center" }}>
              <select value={t.dia} onChange={e => setTreino(i,"dia",e.target.value)}
                style={{ padding:"8px 6px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", color:C.t, outline:"none" }}>
                {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
              </select>
              <input value={t.tipo} onChange={e => setTreino(i,"tipo",e.target.value)} placeholder="Ex: Pilates"
                style={{ padding:"8px 12px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", color:C.t, outline:"none" }} />
              <input value={t.duracao} onChange={e => setTreino(i,"duracao",e.target.value)} placeholder="1h"
                style={{ padding:"8px 8px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", color:C.t, outline:"none" }} />
              <button onClick={() => removeTreino(i)}
                style={{ width:"34px", height:"34px", borderRadius:"8px", border:`1px solid ${C.b}`, background:C.w, cursor:"pointer", color:C.l, fontSize:"14px" }}>✕</button>
            </div>
          ))}
          <button onClick={addTreino}
            style={{ padding:"8px 14px", background:"transparent", border:`1.5px dashed ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"13px", cursor:"pointer", width:"100%", marginTop:"4px" }}>
            + Adicionar treino
          </button>
        </div>

        {/* ── HÁBITOS ── */}
        <div style={sectionStyle}>
          {secTitle("☕", "Hábitos e restrições")}
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", marginBottom:"12px", lineHeight:"1.5" }}>
            Escreva livremente: alergias, intolerâncias, restrições alimentares, hábitos de sono, comportamentos relevantes — qualquer coisa que o coach deva considerar.
          </p>
          {(p.habitos||[]).map((h, i) => (
            <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
              <input value={h} onChange={e => { const arr=[...(p.habitos||[])]; arr[i]=e.target.value; set("habitos",arr); }}
                placeholder="Ex: Não tolero glúten, Durmo mal em fases de TPM..."
                style={{ flex:1, padding:"8px 12px", background:C.bg, border:`1.5px solid ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", fontSize:"13px", color:C.t, outline:"none" }} />
              <button onClick={() => set("habitos",(p.habitos||[]).filter((_,j)=>j!==i))}
                style={{ width:"34px", height:"34px", borderRadius:"8px", border:`1px solid ${C.b}`, background:C.w, cursor:"pointer", color:C.l, fontSize:"14px", flexShrink:0 }}>✕</button>
            </div>
          ))}
          <button onClick={() => set("habitos",[...(p.habitos||[]),""])}
            style={{ padding:"8px 14px", background:"transparent", border:`1.5px dashed ${C.b}`, borderRadius:"10px", fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"13px", cursor:"pointer", width:"100%", marginTop:"4px" }}>
            + Adicionar hábito ou restrição
          </button>
          <div style={{ marginTop:"14px", paddingTop:"14px", borderTop:`1px solid ${C.b}` }}>
            <Field label="Notas livres para o coach" value={p.notas_livres||""} onChange={v => set("notas_livres",v)} multiline hint="Contexto extra, situações pontuais, recados diretos ao coach." />
          </div>
        </div>

      </div>

        {/* ── DOCUMENTOS NARRATIVOS ── */}
        <div style={sectionStyle}>
          {secTitle("📄", "Documentos do coach")}
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", marginBottom:"14px", lineHeight:"1.5" }}>
            Contexto narrativo completo que o coach lê antes de cada interação. Edite para refletir sua realidade atual.
          </p>
          {[
            { key:"macro", label:"MACRO", desc:"Quem você é, seus objetivos, contexto de vida e motivações profundas.", icon:"🗺️", color:C.p },
            { key:"micro", label:"MICRO", desc:"Rotina de fome, preferências alimentares, gatilhos e padrões do dia a dia.", icon:"🔍", color:"#5A7EA3" },
          ].map(item => (
            <div key={item.key} onClick={() => openModal(item.key)}
              style={{ display:"flex", gap:"12px", alignItems:"center", padding:"13px 14px", background:C.bg, borderRadius:"12px", marginBottom:"8px", cursor:"pointer", border:`1.5px solid ${C.b}`, transition:"border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor=item.color}
              onMouseLeave={e => e.currentTarget.style.borderColor=C.b}>
              <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:`${item.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>{item.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.t, fontSize:"13.5px", fontWeight:"700" }}>{item.label}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", marginTop:"2px", lineHeight:"1.4" }}>{item.desc}</div>
              </div>
              <span style={{ color:C.l, fontSize:"16px", flexShrink:0 }}>›</span>
            </div>
          ))}
        </div>

      {/* Floating save button */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:"430px", padding:"12px 16px", background:`${C.w}ee`, backdropFilter:"blur(8px)", borderTop:`1px solid ${C.b}`, zIndex:50 }}>
        <button onClick={save}
          style={{ width:"100%", padding:"14px", background:saved?"#5A9A5A":`linear-gradient(135deg,${C.pl},${C.p})`, color:"#FFF", border:"none", borderRadius:"14px", fontFamily:"'DM Sans',sans-serif", fontSize:"15px", fontWeight:"700", cursor:"pointer", transition:"background 0.3s", boxShadow:`0 4px 14px ${C.p}40` }}>
          {saved ? "✓ Salvo!" : "Salvar perfil"}
        </button>
      </div>

      {/* ── MODAL EDITOR (MACRO / MICRO) ── */}
      {modal && (
        <div style={{ position:"fixed", inset:0, zIndex:300, maxWidth:"430px", margin:"0 auto", display:"flex", flexDirection:"column", background:C.bg }}>
          {/* Modal header */}
          <div style={{ background:C.w, borderBottom:`1px solid ${C.b}`, padding:"13px 16px", flexShrink:0, display:"flex", alignItems:"center", gap:"12px" }}>
            <button onClick={() => setModal(null)}
              style={{ width:"34px", height:"34px", borderRadius:"10px", border:`1px solid ${C.b}`, background:C.bg, cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"17px", fontWeight:"700" }}>
                {modal === "macro" ? "🗺️ MACRO" : "🔍 MICRO"}
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px", marginTop:"1px" }}>
                {modal === "macro" ? "Contexto geral — quem você é" : "Perfil operacional — como você funciona"}
              </div>
            </div>
          </div>

          {/* Hint */}
          <div style={{ padding:"10px 16px 0", flexShrink:0 }}>
            <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11.5px", lineHeight:"1.6", background:C.w, padding:"10px 13px", borderRadius:"10px", border:`1px solid ${C.b}` }}>
              {modal === "macro"
                ? "Escreva na primeira pessoa. Descreva quem você é, o que quer, por que quer, e o que carrega. Quanto mais honesto e detalhado, melhor o coach te entende."
                : "Detalhe sua rotina de fome, o que você gosta e não gosta de comer, texturas, horários difíceis, gatilhos emocionais e padrões do seu dia a dia."
              }
            </p>
          </div>

          {/* Textarea */}
          <div style={{ flex:1, padding:"12px 16px", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <textarea value={modalText} onChange={e => setModalText(e.target.value)}
              style={{ flex:1, width:"100%", padding:"14px", background:C.w, border:`1.5px solid ${C.b}`, borderRadius:"14px", fontFamily:"'DM Sans',sans-serif", fontSize:"13.5px", color:C.t, outline:"none", resize:"none", lineHeight:"1.7" }} />
          </div>

          {/* Save button */}
          <div style={{ padding:"12px 16px 16px", flexShrink:0 }}>
            <button onClick={saveModal}
              style={{ width:"100%", padding:"14px", background:modalSaved?"#5A9A5A":`linear-gradient(135deg,${C.pl},${C.p})`, color:"#FFF", border:"none", borderRadius:"14px", fontFamily:"'DM Sans',sans-serif", fontSize:"15px", fontWeight:"700", cursor:"pointer", transition:"background 0.3s", boxShadow:`0 4px 14px ${C.p}40` }}>
              {modalSaved ? "✓ Salvo!" : `Salvar ${modal.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SAUDE TAB — Calorias + Treinos
══════════════════════════════════════════════════════════════════════════ */
function MacroBar({ label, value, meta, color }) {
  const pct = meta > 0 ? Math.min(100, Math.round((value / meta) * 100)) : 0;
  return (
    <div style={{ marginBottom:"10px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12px", fontWeight:"600" }}>{label}</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px" }}>{value}<span style={{ color:C.l, fontSize:"11px" }}>/{meta}</span></span>
      </div>
      <div style={{ height:"8px", background:`${color}22`, borderRadius:"4px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"4px", transition:"width 0.4s ease" }} />
      </div>
    </div>
  );
}

const DIAS_SEMANA = ["dom","seg","ter","qua","qui","sex","sab"];
const DIAS_PT = { dom:"D", seg:"S", ter:"T", qua:"Q", qui:"Q", sex:"S", sab:"S" };

function SaudeTab({ cal, treinos }) {
  const today = new Date().toLocaleDateString("pt-BR");
  const weekday = DIAS_SEMANA[new Date().getDay()];

  let calObj = {}; let treinosObj = {};
  try { calObj = JSON.parse(cal || "{}"); } catch {}
  try { treinosObj = JSON.parse(treinos || "{}"); } catch {}

  const meta = calObj.meta_diaria || { kcal:1450, proteina_g:115, carbo_g:110, gordura_g:45 };
  const hoje = calObj.dias?.[today] || { kcal_consumido:0, proteina_g:0, carbo_g:0, gordura_g:0, refeicoes:[] };
  const kcalRestante = Math.max(0, meta.kcal - (hoje.kcal_consumido || 0));
  const kcalPct = meta.kcal > 0 ? Math.min(100, Math.round(((hoje.kcal_consumido||0) / meta.kcal) * 100)) : 0;
  const kcalOver = (hoje.kcal_consumido||0) > meta.kcal;

  // Weekly cal summary
  const diasSemana = Object.entries(calObj.dias || {}).slice(-7);
  const totalSemana = diasSemana.reduce((s, [, d]) => s + (d.kcal_consumido || 0), 0);
  const metaSemana  = meta.kcal * 7;

  // Treinos: últimos 7 registros
  const regs = (treinosObj.registros || []).slice(-14);
  const planejados = treinosObj.planejados || {};

  // This week days (Mon-Sun)
  const hoje_js = new Date();
  const diaSemana = hoje_js.getDay();
  const startOfWeek = new Date(hoje_js);
  startOfWeek.setDate(hoje_js.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toLocaleDateString("pt-BR");
    const dayKey = DIAS_SEMANA[d.getDay()];
    const reg = regs.find(r => r.data === dateStr);
    const isPlanned = !!planejados[dayKey];
    const isToday = dateStr === today;
    return { dateStr, dayKey, reg, isPlanned, isToday, dayNum: d.getDate() };
  });
  const treinosFeitos = weekDays.filter(d => d.reg?.realizado).length;
  const treinosPlanejados = weekDays.filter(d => d.isPlanned).length;

  return (
    <div style={{ overflowY:"auto", height:"100%", background:C.bg }}>
      <div style={{ padding:"14px 15px 28px" }}>

        {/* ── CALORIAS HOJE ── */}
        <div style={{ background:C.w, borderRadius:"18px", padding:"16px 18px", marginBottom:"12px", border:`1px solid ${C.b}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"14px" }}>
            <div>
              <p style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"16px", fontWeight:"700" }}>🍎 Calorias hoje</p>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px", marginTop:"2px" }}>{today}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", color:kcalOver?"#C05A3A":C.p, fontSize:"24px", fontWeight:"700", lineHeight:"1" }}>{hoje.kcal_consumido||0}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px" }}>de {meta.kcal} kcal</div>
            </div>
          </div>

          {/* Ring-style progress */}
          <div style={{ position:"relative", height:"10px", background:`${C.p}22`, borderRadius:"8px", overflow:"hidden", marginBottom:"6px" }}>
            <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${kcalPct}%`, background:kcalOver?"#C05A3A":C.p, borderRadius:"8px", transition:"width 0.4s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px" }}>{kcalPct}% da meta</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", color:kcalOver?"#C05A3A":C.ok, fontSize:"11px", fontWeight:"600" }}>{kcalOver ? `+${(hoje.kcal_consumido||0)-meta.kcal} acima` : `${kcalRestante} restantes`}</span>
          </div>

          <MacroBar label="Proteína (g)" value={hoje.proteina_g||0} meta={meta.proteina_g} color="#5A9A5A" />
          <MacroBar label="Carboidrato (g)" value={hoje.carbo_g||0}   meta={meta.carbo_g}   color="#B87850" />
          <MacroBar label="Gordura (g)"     value={hoje.gordura_g||0}  meta={meta.gordura_g}  color="#7A6AAA" />

          {/* Meals logged today */}
          {(hoje.refeicoes||[]).length > 0 && (
            <div style={{ marginTop:"14px", paddingTop:"12px", borderTop:`1px solid ${C.b}` }}>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"11px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"6px" }}>Registrado hoje</p>
              {(hoje.refeicoes||[]).map((r, i) => (
                <div key={i} style={{ display:"flex", gap:"6px", marginBottom:"4px" }}>
                  <span style={{ color:C.p, fontSize:"11px", marginTop:"1px" }}>•</span>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12.5px", lineHeight:"1.5" }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TREINOS DA SEMANA ── */}
        <div style={{ background:C.w, borderRadius:"18px", padding:"16px 18px", marginBottom:"12px", border:`1px solid ${C.b}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <p style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"16px", fontWeight:"700" }}>🏋️ Treinos — semana</p>
            <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.p, fontSize:"13px", fontWeight:"700" }}>{treinosFeitos}/{treinosPlanejados}</span>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"6px", marginBottom:"12px" }}>
            {weekDays.map(d => {
              const done     = d.reg?.realizado === true;
              const missed   = d.reg?.realizado === false;
              const planned  = d.isPlanned && !d.reg;
              const rest     = !d.isPlanned && !d.reg;
              const future   = !d.reg && new Date(d.dateStr.split("/").reverse().join("-")) > new Date();
              const bg = done ? "#5A9A5A" : missed ? "#C05A3A" : d.isToday && planned ? C.p : planned && !future ? "#C09040" : C.bg;
              const textColor = (done || missed || (d.isToday && planned)) ? "#FFF" : C.l;
              return (
                <div key={d.dateStr} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"10px", color:C.l, fontWeight: d.isToday?"700":"400" }}>{["D","S","T","Q","Q","S","S"][new Date(d.dateStr.split("/").reverse().join("-")).getDay()]}</span>
                  <div title={d.reg?.tipo || (d.isPlanned ? planejados[d.dayKey] : "Descanso")} style={{ width:"34px", height:"34px", borderRadius:"10px", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", border:d.isToday?`2px solid ${C.p}`:"none" }}>
                    <span style={{ color:textColor, fontSize:"14px" }}>{done?"✓":missed?"✗":d.isPlanned?"◉":"·"}</span>
                  </div>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"10px", color:d.isToday?C.p:C.l, fontWeight:d.isToday?"700":"400" }}>{d.dayNum}</span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
            {[["#5A9A5A","✓ Feito"],["#C05A3A","✗ Perdido"],[C.p,"◉ Planejado"],["#D0C8C0","· Descanso"]].map(([color, label]) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                <div style={{ width:"10px", height:"10px", borderRadius:"3px", background:color }} />
                <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"10.5px" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Recent workout notes */}
          {regs.filter(r => r.notas).length > 0 && (
            <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:`1px solid ${C.b}` }}>
              {regs.filter(r => r.notas).slice(-3).map((r, i) => (
                <div key={i} style={{ display:"flex", gap:"6px", marginBottom:"4px" }}>
                  <span style={{ color:C.p, fontSize:"11px", marginTop:"1px", flexShrink:0 }}>•</span>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12px" }}><strong>{r.data}</strong> — {r.notas}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RESUMO SEMANAL ── */}
        <div style={{ background:C.p, borderRadius:"18px", padding:"16px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:"-20px", right:"-20px", width:"100px", height:"100px", borderRadius:"50%", background:"rgba(255,255,255,0.08)" }} />
          <p style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.7)", fontSize:"11px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px", position:"relative" }}>📊 Semana atual</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", position:"relative" }}>
            {[
              { l:"Kcal semana", v:`${totalSemana}`, s:`meta ${metaSemana}` },
              { l:"Saldo", v: totalSemana <= metaSemana ? `-${metaSemana - totalSemana}` : `+${totalSemana - metaSemana}`, s: totalSemana <= metaSemana ? "dentro da meta" : "acima da meta" },
              { l:"Treinos feitos", v:`${treinosFeitos}`, s:`de ${treinosPlanejados} planejados` },
              { l:"Adesão treinos", v:`${treinosPlanejados > 0 ? Math.round((treinosFeitos/treinosPlanejados)*100) : 0}%`, s:"na semana" },
            ].map((x, i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.14)", borderRadius:"12px", padding:"10px 12px" }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.6)", fontSize:"10px", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:"2px" }}>{x.l}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", color:"#FFF", fontSize:"20px", fontWeight:"700" }}>{x.v}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", color:"rgba(255,255,255,0.5)", fontSize:"10px" }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", textAlign:"center", marginTop:"14px" }}>
          💬 Relate refeições e treinos no chat — o coach atualiza aqui automaticamente.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONVERSATION HISTORY DRAWER
══════════════════════════════════════════════════════════════════════════ */
function ConvoDrawer({ convos, onLoad, onDelete, onClose }) {
  return (
    <div style={{ position:"absolute", inset:0, zIndex:100, display:"flex", flexDirection:"column" }}>
      {/* Overlay */}
      <div onClick={onClose} style={{ flex:1, background:"rgba(0,0,0,0.35)", cursor:"pointer" }} />
      {/* Panel */}
      <div style={{ background:C.w, borderRadius:"24px 24px 0 0", maxHeight:"78vh", display:"flex", flexDirection:"column", boxShadow:"0 -8px 32px rgba(0,0,0,0.15)" }}>
        {/* Handle + header */}
        <div style={{ padding:"12px 20px 0", flexShrink:0 }}>
          <div style={{ width:"40px", height:"4px", borderRadius:"2px", background:C.b, margin:"0 auto 14px" }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
            <div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"18px", fontWeight:"700" }}>Conversas anteriores</h3>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"12px", marginTop:"2px" }}>{convos.length} conversa{convos.length !== 1 ? "s" : ""} salva{convos.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={onClose} style={{ width:"34px", height:"34px", borderRadius:"50%", border:`1px solid ${C.b}`, background:C.bg, cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        </div>
        {/* List */}
        <div style={{ overflowY:"auto", padding:"0 16px 24px", flex:1 }}>
          {convos.length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:"36px", marginBottom:"12px" }}>💬</div>
              <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"14px" }}>Nenhuma conversa arquivada ainda.</p>
            </div>
          )}
          {[...convos].reverse().map(c => (
            <div key={c.id} style={{ display:"flex", gap:"10px", alignItems:"center", padding:"12px 14px", background:C.bg, borderRadius:"14px", marginBottom:"8px", border:`1px solid ${C.b}` }}>
              <button onClick={() => onLoad(c)} style={{ flex:1, background:"none", border:"none", cursor:"pointer", textAlign:"left", padding:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.t, fontSize:"13px", fontWeight:"600" }}>{c.date}</span>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", color:C.l, fontSize:"11px" }}>{c.count} msg{c.count !== 1 ? "s" : ""}</span>
                </div>
                <p style={{ fontFamily:"'DM Sans',sans-serif", color:C.m, fontSize:"12.5px", lineHeight:"1.5", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{c.preview}</p>
              </button>
              <button onClick={() => onDelete(c.id)} style={{ width:"30px", height:"30px", borderRadius:"8px", border:`1px solid ${C.b}`, background:C.w, cursor:"pointer", fontSize:"13px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:C.l }}>🗑</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [docs, setDocs]         = useState({ micro:"", mem:"", hist:"", plano:"", marcos:"", cal:"", treinos:"", perfil:"", macro:"" });
  const [messages, setMessages] = useState([]);
  const [tab, setTab]           = useState("chat");
  const [docsReady, setReady]   = useState(false);
  const [convos, setConvos]     = useState([]);
  const [showHistory, setHistory] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const [micro, mem, hist, plano, marcos, chatRaw, convosRaw, calRaw, treinosRaw, perfilRaw, macroRaw] = await Promise.all([
        sget(SK.micro), sget(SK.mem), sget(SK.hist), sget(SK.plano), sget(SK.marcos), sget(SK.chat), sget(SK.convos), sget(SK.cal), sget(SK.treinos), sget(SK.perfil), sget(SK.macro),
      ]);
      setDocs({
        micro:   micro      || DEFAULTS.micro,
        mem:     mem        || DEFAULTS.mem,
        hist:    hist       || DEFAULTS.hist,
        plano:   plano      || DEFAULTS.plano,
        marcos:  marcos     || DEFAULTS.marcos,
        cal:     calRaw     || INIT_CAL,
        treinos: treinosRaw || INIT_TREINOS,
        perfil:  perfilRaw  || INIT_PERFIL,
        macro:   macroRaw   || INIT_MACRO,
      });
      if (!micro)      await sset(SK.micro,   DEFAULTS.micro);
      if (!mem)        await sset(SK.mem,     DEFAULTS.mem);
      if (!hist)       await sset(SK.hist,    DEFAULTS.hist);
      if (!plano)      await sset(SK.plano,   DEFAULTS.plano);
      if (!marcos)     await sset(SK.marcos,  DEFAULTS.marcos);
      if (!calRaw)     await sset(SK.cal,     INIT_CAL);
      if (!treinosRaw) await sset(SK.treinos, INIT_TREINOS);
      if (!perfilRaw)  await sset(SK.perfil,  INIT_PERFIL);
      if (!macroRaw)   await sset(SK.macro,   INIT_MACRO);
      try { setMessages(JSON.parse(chatRaw || "[]")); } catch { setMessages([]); }
      try { setConvos(JSON.parse(convosRaw || "[]")); } catch { setConvos([]); }
      setReady(true);
    }
    load();
  }, []);

  // Archive current conversation and start fresh
  async function startNewConvo() {
    if (messages.length === 0) return;
    // Build archive entry
    const userMsgs = messages.filter(m => m.role === "user");
    const preview  = userMsgs.length > 0 ? userMsgs[0].content.slice(0, 120) : "Conversa";
    const entry = {
      id:      Date.now(),
      date:    new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }),
      preview,
      count:   messages.length,
      messages: messages.slice(-60),
    };
    const updated = [...convos, entry];
    setConvos(updated);
    await sset(SK.convos, JSON.stringify(updated));
    // Clear current chat
    setMessages([]);
    await sset(SK.chat, "[]");
    setTab("chat");
  }

  async function loadConvo(c) {
    // Archive current if has messages
    if (messages.length > 0) {
      const userMsgs = messages.filter(m => m.role === "user");
      const preview  = userMsgs.length > 0 ? userMsgs[0].content.slice(0, 120) : "Conversa";
      const entry = { id:Date.now(), date:new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}), preview, count:messages.length, messages:messages.slice(-60) };
      const updated = [...convos.filter(x => x.id !== c.id), entry];
      setConvos(updated);
      await sset(SK.convos, JSON.stringify(updated));
    }
    setMessages(c.messages);
    await sset(SK.chat, JSON.stringify(c.messages));
    setHistory(false);
    setTab("chat");
  }

  async function deleteConvo(id) {
    const updated = convos.filter(c => c.id !== id);
    setConvos(updated);
    await sset(SK.convos, JSON.stringify(updated));
  }

  async function generatePlan() {
    if (generating) return;
    setGenerating(true);
    setTab("chat");
    const today = new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long" });

    // Build the trigger message — coach decides everything
    const triggerMsg = {
      role: "user",
      content: `[AÇÃO: GERAR PLANO DO DIA]\nData: ${today}\n\nGere um plano alimentar personalizado para hoje. Analisa meu histórico recente para variar os alimentos (evitar repetição), compensar metas calóricas ou de proteína se necessário, e adaptar ao meu dia. Após gerar, atualize o Plano_Renata.md com o plano de hoje.`
    };

    const newMsgs = [...messages, triggerMsg];
    setMessages(newMsgs);
    await sset(SK.chat, JSON.stringify(newMsgs.slice(-60)));

    try {
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role:m.role, content:m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          thinking: { type: "enabled", budget_tokens: 5000 },
          system: buildPrompt(docs),
          messages: [...apiMsgs, { role: "assistant", content: "{" }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || `Erro ${res.status}`);
      const textBlock = data.content?.find(b => b.type === "text")?.text;
      const rawJson = ("{" + textBlock).replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim();
      const parsed = JSON.parse(rawJson);

      const aiMsg = { role:"assistant", content: parsed.reply || "..." };
      let newDocs = docs;
      for (const u of (parsed.updates || []).filter(u => !u.requiresPermission)) {
        newDocs = await applyUpdate(u, newDocs);
      }
      setDocs(newDocs);
      const finalMsgs = [...newMsgs, aiMsg];
      setMessages(finalMsgs);
      await sset(SK.chat, JSON.stringify(finalMsgs.slice(-60)));
    } catch(e) {
      console.error("generatePlan:", e);
      setMessages(prev => [...prev, { role:"assistant", content:`⚠️ Erro ao gerar plano: ${e.message}` }]);
    }
    setGenerating(false);
  }

  async function savePerfil(json) {
    setDocs(prev => ({ ...prev, perfil: json }));
    await sset(SK.perfil, json);
  }
  async function saveMacro(text) {
    setDocs(prev => ({ ...prev, macro: text }));
    await sset(SK.macro, text);
  }
  async function saveMicro(text) {
    setDocs(prev => ({ ...prev, micro: text }));
    await sset(SK.micro, text);
  }

  const tabs = [
    { id:"chat",      label:"Chat",    icon:"💬" },
    { id:"plano",     label:"Plano",   icon:"📋" },
    { id:"saude",     label:"Saúde",   icon:"🍎" },
    { id:"marcos",    label:"Marcos",  icon:"🏆" },
    { id:"perfil",    label:"Perfil",  icon:"⚙️" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(184,120,80,0.2); border-radius:4px; }
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-5px);opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        textarea { font-family:'DM Sans',sans-serif; }
      `}</style>

      <div style={{ width:"100%", height:"100vh", maxWidth:"430px", margin:"0 auto", display:"flex", flexDirection:"column", background:C.bg, overflow:"hidden", fontFamily:"'DM Sans',sans-serif", position:"relative" }}>

        {/* HEADER */}
        <div style={{ background:C.w, borderBottom:`1px solid ${C.b}`, padding:"13px 16px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"11px" }}>
            <div style={{ width:"42px", height:"42px", borderRadius:"13px", background:`linear-gradient(135deg,${C.pl},${C.p})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"21px", flexShrink:0, boxShadow:`0 3px 10px ${C.p}35` }}>🌿</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", color:C.t, fontSize:"18px", fontWeight:"700", lineHeight:"1.2" }}>Coach Renata</div>
              <div style={{ color:C.l, fontSize:"12px", display:"flex", alignItems:"center", gap:"5px", marginTop:"2px" }}>
                <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:docsReady?"#5BAA5B":"#C09040", display:"inline-block", flexShrink:0 }} />
                {docsReady ? "Online — memória carregada" : "Carregando..."}
              </div>
            </div>
            {/* Header action buttons */}
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <button onClick={() => setHistory(true)} title="Histórico de conversas"
                style={{ width:"36px", height:"36px", borderRadius:"10px", border:`1px solid ${C.b}`, background:C.bg, cursor:"pointer", fontSize:"17px", display:"flex", alignItems:"center", justifyContent:"center" }}>🕐</button>
              <button onClick={startNewConvo} disabled={messages.length===0} title="Nova conversa"
                style={{ width:"36px", height:"36px", borderRadius:"10px", border:`1px solid ${C.b}`, background:messages.length>0?C.p:C.bg, cursor:messages.length>0?"pointer":"not-allowed", fontSize:"17px", display:"flex", alignItems:"center", justifyContent:"center", opacity:messages.length>0?1:0.4 }}>✏️</button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ background:C.w, borderBottom:`1px solid ${C.b}`, display:"flex", flexShrink:0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"8px 2px 9px", background:"none", border:"none", borderBottom:tab===t.id?`2.5px solid ${C.p}`:"2.5px solid transparent", color:tab===t.id?C.p:C.l, fontFamily:"'DM Sans',sans-serif", fontSize:"10px", fontWeight:tab===t.id?"700":"400", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"2px", transition:"all 0.15s" }}>
              <span style={{ fontSize:"15px" }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>
          {tab==="chat"      && <ChatTab docs={docs} setDocs={setDocs} messages={messages} setMessages={setMessages} docsReady={docsReady} setTab={setTab} onNewConvo={startNewConvo} onHistory={() => setHistory(true)} onGeneratePlan={generatePlan} generating={generating} />}
          {tab==="plano"     && <PlanoTab plano={docs.plano} onGeneratePlan={generatePlan} generating={generating} />}
          {tab==="saude"     && <SaudeTab cal={docs.cal} treinos={docs.treinos} />}
          {tab==="marcos"    && <MarcosTab marcos={docs.marcos} />}
          {tab==="perfil"    && <PerfilTab perfil={docs.perfil} onSave={savePerfil} macro={docs.macro} micro={docs.micro} onSaveMacro={saveMacro} onSaveMicro={saveMicro} />}
        </div>
      </div>

      {/* Conversation History Drawer */}
      {showHistory && (
        <div style={{ position:"fixed", inset:0, zIndex:200, maxWidth:"430px", margin:"0 auto", display:"flex", flexDirection:"column" }}>
          <ConvoDrawer
            convos={convos}
            onLoad={loadConvo}
            onDelete={deleteConvo}
            onClose={() => setHistory(false)}
          />
        </div>
      )}
    </>
  );
}
