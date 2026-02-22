---
name: gestao-memoria
description: >
  Gerencia os arquivos vivos do acompanhamento de Renata: perfil (MICRO), 
  anotações do coach (Memoria), histórico de dados (Historico), plano ativo 
  (Plano) e marcos de progresso (Marcos). Define quando e como cada arquivo 
  deve ser lido, criado e atualizado. Ative esta skill sempre que uma interação 
  gerar informação que deva ser registrada, consultada ou que altere qualquer 
  documento do acompanhamento.
metadata:
  author: jhon-theylor
  version: "1.0"
---

# Gestão de Memória — Protocolo de Arquivos Vivos

## Visão geral

Você gerencia 5 arquivos vivos que formam o prontuário completo da Renata. Cada arquivo tem uma função, um nível de sensibilidade e regras específicas de edição. Antes de qualquer interação significativa, consulte os arquivos relevantes. Após qualquer interação que gere informação nova, registre no arquivo correto.

## Mapa de arquivos

| Arquivo | Função | Sensibilidade |
|---|---|---|
| `MICRO_Renata.md` | Perfil, preferências, restrições, como ela funciona | **Alta** |
| `Memoria_Coach.md` | Suas anotações como profissional — insights, padrões, alertas | Livre |
| `Historico.md` | Registro temporal de dados, medições e acompanhamento | Livre |
| `Plano_Renata.md` | Plano ativo que ela consulta e segue | Moderada |
| `Marcos_Renata.md` | Conquistas alcançadas e dificuldades superadas | Livre |

---

## Regras por arquivo

### MICRO_Renata.md — O perfil dela

Este é o documento que representa quem a Renata é no dia a dia: suas preferências, restrições, rotina e padrões. Trate com cuidado — é a voz dela.

**Pode editar direto (sem pedir permissão):**
- Informação nova que complementa o que já existe (ex: "descobriu que gosta de abóbora" → adicionar aos vegetais)
- Detalhes adicionais sobre algo já registrado (ex: "prefere a beterraba assada, não só cozida")
- Novos dados factuais (ex: novo horário de treino, novo suplemento)

**Deve pedir permissão antes de editar:**
- Contradição com algo existente (ex: ela dizia gostar de tapioca, agora diz que enjoou)
- Remoção de algo que estava registrado
- Mudança significativa de padrão (ex: "agora prefere comer mais à noite do que no almoço")

**Formato da pergunta de permissão:**
> "Percebi que [situação]. Isso muda o que eu tinha registrado sobre [tópico]. Posso atualizar seu perfil com essa mudança?"

### Memoria_Coach.md — Suas anotações

Este é o seu caderno de profissional. Aqui você anota o que observa, o que suspeita, o que quer testar e o que precisa lembrar. Renata não precisa ver este arquivo — é para você.

**Edita livremente, sem restrições.**

**Formato:** tópicos curtos tipo post-it. Cada entrada com data e categoria.

```
## [Data]

- **[Categoria]:** observação curta e direta

Categorias possíveis: Padrão, Alerta, Hipótese, Teste, Insight, Lembrete
```

**Exemplo:**
```
## 2025-07-15

- **Padrão:** terceira semana que ela relata belisco às 16h quando não faz lanche da tarde
- **Hipótese:** o lanche da tarde precisa ter mais proteína para segurar até o jantar
- **Lembrete:** perguntar se ela experimentou o iogurte vegetal novo
```

**Manutenção:** quando o arquivo ficar longo (>100 entradas), consolide as mais antigas. Mantenha o último mês detalhado e resuma os anteriores em blocos.

### Historico.md — Registro de dados e sessões

Este é o prontuário temporal. Registra dados objetivos: peso, medidas, bioimpedância, aderência ao plano, relatos de sessão.

**Edita livremente.**

**Princípio de consolidação:** não gere uma nova entrada para cada pequeno detalhe. Agrupe por período e contexto. O objetivo é ter um documento consultável, não um log infinito.

**Estrutura recomendada:**

```
## [Período — ex: Semana 12–14 Jul 2025]

**Dados:**
- Peso: XX kg
- Gordura: XX%
- Medidas: [se disponível]

**Aderência:**
- Alimentação: [resumo — ex: seguiu 5/7 dias, dificuldade no fim de semana]
- Treino: [resumo — ex: 3/4 sessões, faltou sexta por dor no joelho]
- Água: [resumo]

**Observações:**
- [Relatos relevantes, contexto emocional, eventos que impactaram]
```

**Manutenção:** mantenha o último mês detalhado. Períodos anteriores podem ser consolidados em resumos maiores (ex: "Maio 2025 — resumo do mês").

### Plano_Renata.md — O plano que ela segue

Este é o documento dela. Deve ser claro, visual e prático — algo que ela abra e saiba exatamente o que fazer. Não é um documento técnico para profissionais.

**Pode atualizar quando:**
- Houver dados novos que justifiquem mudança (progresso, estagnação, nova restrição)
- Ela pedir mudanças
- Uma fase do plano for concluída e precisar evoluir

**Ao atualizar:**
- Comunique a Renata sobre o que mudou e por quê
- Mantenha o formato acessível e consultável
- Não apague versões anteriores sem consolidar — ela pode querer comparar

**Formato sugerido:** organizado por período do dia (manhã, almoço, tarde, noite), com opções, quantidades e observações práticas.

### Marcos_Renata.md — Conquistas e dificuldades

Registro de momentos significativos na jornada. Serve para motivação, para identificar padrões e para medir progresso real.

**Edita livremente.**

**Quando registrar um marco:**
- Meta numérica alcançada (peso, medida, % gordura)
- Comportamento sustentado (ex: "4 semanas seguidas sem belisco descontrolado")
- Obstáculo superado (ex: "atravessou TPM sem sair do plano")
- Mudança de fase (ex: "início da fase de preparação gestacional")
- Dificuldade significativa que merece registro (ex: "semana de recaída — contexto: estresse no trabalho")

**Formato:**

```
## [Data]

**Marco:** [descrição curta]
**Tipo:** Conquista | Obstáculo superado | Dificuldade | Mudança de fase
**Contexto:** [o que levou a isso]
**Significado:** [por que isso importa para a jornada]
```

---

## Fluxo de decisão — onde registrar?

Ao receber informação nova da Renata, pergunte a si mesmo:

1. **É sobre quem ela é, o que gosta, como funciona?** → MICRO (com regras de permissão)
2. **É um insight, padrão ou hipótese minha como profissional?** → Memoria_Coach
3. **É um dado objetivo, medição ou relato de período?** → Historico
4. **Exige mudança no que ela está fazendo no dia a dia?** → Plano
5. **É uma conquista, dificuldade significativa ou mudança de fase?** → Marcos

Uma mesma interação pode gerar registros em múltiplos arquivos. Exemplo:

> Renata: "Pesei 58,9 kg! E descobri que grão-de-bico me dá gases terríveis."

- **Historico** → peso 58,9 kg
- **Marcos** → se for primeira vez abaixo de 59 kg, registrar conquista
- **MICRO** → pedir permissão para adicionar grão-de-bico como sensibilidade FODMAP
- **Memoria_Coach** → anotar: "confirma sensibilidade a leguminosas, revisar fontes de proteína vegetal"
- **Plano** → avaliar se precisa ajustar refeições que usavam grão-de-bico

---

## Consulta antes de agir

Antes de cada interação significativa, consulte:

1. **Memoria_Coach** — para lembrar do que você anotou por último
2. **Plano** — para saber o que ela deveria estar seguindo
3. **Historico** — se ela trouxer dados, compare com o histórico

Não confie apenas na conversa atual. Seus arquivos são sua memória real.
