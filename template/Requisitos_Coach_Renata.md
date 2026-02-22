# Coach Renata — Documento de Requisitos

**Agente de Acompanhamento de Saúde e Performance**

Versão 1.0 — Fevereiro 2026
Autor: Jhon Theylor

---

## 1. Resumo Executivo

Este documento descreve os requisitos para a construção de um agente conversacional inteligente (baseado em Claude/LLM) que atua como coach pessoal de saúde, nutrição e performance física para uma usuária específica: Renata.

O agente não é um chatbot genérico. Ele possui personalidade definida, competências específicas, memória persistente e um sistema de arquivos vivos que evolui a cada interação. O objetivo é que a Renata tenha um acompanhamento contínuo, personalizado e inteligente que a ajude a alcançar suas metas de saúde e preparação para gestação.

---

## 2. Visão do Produto

### 2.1. O que é

- Um agente conversacional com identidade de coach de saúde e performance
- Atende exclusivamente uma usuária (Renata), com contexto profundo sobre ela
- Possui memória persistente: lembra de interações passadas, dados, progressão e preferências
- Gerencia um conjunto de documentos vivos que evoluem com o tempo
- Segue protocolos definidos de tom, conduta e gestão de memória

### 2.2. O que não é

- Não é um app de rastreamento de calorias (tipo MyFitnessPal)
- Não é um chatbot genérico de saúde com respostas prontas
- Não substitui médicos ou profissionais de saúde (deve recomendar consulta quando necessário)

---

## 3. Arquitetura do Sistema de Arquivos

O agente opera sobre dois tipos de arquivos: instruções (como ele pensa) e arquivos vivos (o que ele gerencia). Todos estão em Markdown.

### 3.1. Arquivos de Instrução (somente leitura para o agente)

Estes arquivos definem o comportamento do agente. São configurados pelo administrador e não devem ser editados pelo agente em tempo de execução.

| Arquivo | Função | Descrição |
|---|---|---|
| `Claude.md` | Identidade | Personalidade, tom, competências, princípios inegociáveis do agente |
| `Agents.md` | Workflow | Ciclo de interação, protocolos de sessão, regras de tarefa/recompensa, coleta de dados |
| `gestao-memoria/SKILL.md` | Gestão de memória | Protocolo de quando e como editar cada arquivo vivo (padrão agentskills.io) |

### 3.2. Arquivos Vivos (gerenciados pelo agente)

Estes arquivos são criados, lidos e atualizados pelo agente durante as interações. Cada um tem regras específicas de edição definidas na skill de gestão de memória.

| Arquivo | Função | Sensibilidade | Regra de edição |
|---|---|---|---|
| `MACRO_Renata.md` | Contexto geral: quem é, objetivos, limitações | Somente leitura | Editado apenas pelo administrador |
| `MICRO_Renata.md` | Perfil operacional: preferências, restrições, rotina | **Alta** | Info nova: edita direto. Contradição/remoção: pede permissão |
| `Memoria_Coach.md` | Anotações do profissional (post-its) | Livre | Edita livremente |
| `Historico.md` | Dados temporais: peso, medições, aderência | Livre | Edita direto, consolida por período |
| `Plano_Renata.md` | Plano ativo que a usuária consulta e segue | Moderada | Atualiza com evolução, comunica mudanças |
| `Marcos_Renata.md` | Conquistas, dificuldades, marcos de progresso | Livre | Edita direto quando identifica marco |

### 3.3. Diagrama de fluxo de dados

Ao receber uma mensagem da Renata, o agente segue este fluxo:

1. **Consulta:** Lê Memoria_Coach (continuidade) + Plano (o que ela deveria seguir) + Historico (se há dados recentes)
2. **Escuta:** Processa a mensagem da usuária e identifica tipo de informação
3. **Classifica:** Decide em qual(is) arquivo(s) registrar (pode ser múltiplos)
4. **Registra:** Atualiza os arquivos seguindo regras de permissão (MICRO) vs livre (demais)
5. **Responde:** Orienta, desafia ou acolhe conforme o ciclo definido no Agents.md

---

## 4. Requisitos Funcionais

### 4.1. Conversação

- **RF-01:** O agente deve manter conversação em português brasileiro, tom acolhedor e firme.
- **RF-02:** Deve iniciar cada sessão com check-in rápido (humor, sono, aderência).
- **RF-03:** Deve seguir o ciclo: escutar, registrar, orientar, desafiar, celebrar.
- **RF-04:** Quando a usuária pedir concessões alimentares, deve aplicar regras de tarefa/recompensa (3 níveis definidos no Agents.md).
- **RF-05:** Nunca deve dar respostas genéricas. Toda orientação deve ser específica para a Renata, referenciando seus dados e preferências.

### 4.2. Memória e Persistência

- **RF-06:** O agente deve ter acesso de leitura/escrita aos 6 arquivos vivos e somente leitura aos 3 de instrução.
- **RF-07:** Ao receber informação nova, deve decidir automaticamente em qual arquivo registrar, seguindo o fluxo de decisão da skill gestao-memoria.
- **RF-08:** Para o MICRO_Renata.md, deve pedir permissão antes de editar em casos de contradição ou remoção.
- **RF-09:** A Memoria_Coach.md deve ser atualizada em formato de post-its (data + categoria + observação).
- **RF-10:** O Historico.md deve consolidar dados por período, sem gerar entradas para cada micro-detalhe.
- **RF-11:** O Plano_Renata.md deve ser acessível à usuária como documento consultável e praticável.
- **RF-12:** Marcos devem ser registrados automaticamente quando o agente identifica conquistas, obstáculos superados ou mudanças de fase.

### 4.3. Coleta ativa de dados

- **RF-13:** O agente deve solicitar ativamente dados periódicos: semanal (aderência, sono, energia), quinzenal (peso, sensação corporal), mensal (medidas/bioimpedância).
- **RF-14:** Não deve esperar que a usuária traga informações. Deve cobrar de forma natural e leve.

---

## 5. Requisitos Não-Funcionais

- **RNF-01 Persistência:** Os arquivos vivos devem persistir entre sessões. Reinícios de conversa não devem apagar dados.
- **RNF-02 Performance:** O agente deve consultar seus arquivos de memória de forma eficiente, sem causar latência perceptível na resposta.
- **RNF-03 Segurança:** Os dados são pessoais e sensíveis (saúde, peso, emocional). Devem ser armazenados com privacidade.
- **RNF-04 Portabilidade:** Todos os arquivos são Markdown. Devem ser exportáveis e legíveis fora da plataforma.
- **RNF-05 Evolução:** A arquitetura deve permitir adicionar novos arquivos vivos ou skills no futuro sem reestruturação.

---

## 6. Experiência da Usuária (UX)

As decisões de UX ficam a cargo do designer, mas o documento estabelece os seguintes requisitos de experiência:

### 6.1. Interação conversacional

- **UX-01:** A interface principal é conversacional (chat). A Renata interage como se estivesse conversando com seu coach.
- **UX-02:** O agente não deve parecer uma máquina. Tom acolhedor, uso de nome, referências a contexto passado.
- **UX-03:** Respostas concisas. Evitar paredes de texto. Quando precisar detalhar, organizar bem.

### 6.2. Acesso aos documentos

- **UX-04:** A usuária deve ter acesso fácil ao Plano_Renata.md (seu plano ativo) para consultar a qualquer momento.
- **UX-05:** A usuária deve poder ver seus Marcos (conquistas e progresso) de forma visual e motivacional.
- **UX-06:** O Historico deve ter uma visualização amigável (gráficos de evolução de peso, aderência, etc.).
- **UX-07:** A Memoria_Coach e os arquivos de instrução não precisam ser visíveis para a usuária.

### 6.3. Notificações e lembretes

- **UX-08:** Considerar notificações para: lembrete de água, horário do lanche da tarde (16h), coleta de dados periódica.
- **UX-09:** Quando o agente atualizar o Plano, notificar a usuária com resumo da mudança.

### 6.4. Permissões

- **UX-10:** Quando o agente precisar pedir permissão para editar o MICRO (contradições), a UX deve tornar isso claro e fácil de aprovar/rejeitar.

---

## 7. Arquivos Anexos

Todos os arquivos mencionados neste documento estão entregues em conjunto. A estrutura completa é:

### Instruções do agente

| Arquivo | Conteúdo |
|---|---|
| `Claude.md` | Identidade, personalidade, competências e princípios do agente |
| `Agents.md` | Workflow operacional, ciclo de interação, regras de conduta |
| `gestao-memoria/SKILL.md` | Skill de gestão de memória (padrão agentskills.io) |

### Contexto da usuária

| Arquivo | Conteúdo |
|---|---|
| `MACRO_Renata.md` | Visão macro: quem é, objetivos, limitações, princípios de vida |
| `MICRO_Renata.md` | Visão micro: rotina de fome, preferências, restrições, gatilhos |

### Arquivos vivos (templates iniciais)

| Arquivo | Conteúdo |
|---|---|
| `Memoria_Coach.md` | Template com insights iniciais pré-preenchidos |
| `Historico.md` | Template com linha de base preenchida |
| `Plano_Renata.md` | Template aguardando montagem do plano |
| `Marcos_Renata.md` | Template com marco inicial registrado |

---

## 8. Próximos Passos

1. **Designer:** Definir a UX da interface conversacional, acesso aos documentos da usuária (Plano, Marcos, Histórico), fluxo de permissões e notificações.
2. **Desenvolvedor:** Definir a implementação técnica: qual LLM usar, como persistir os arquivos vivos, como carregar instruções e skills no contexto, como gerenciar a memória entre sessões.
3. **Ambos:** Decisões conjuntas sobre: formato de visualização do histórico (gráficos?), como apresentar marcos (timeline? cards?), como tornar o plano fácil de consultar no celular.

---

*Este documento e todos os anexos formam o briefing completo do projeto. O designer e o desenvolvedor têm liberdade para decidir como implementar a UX e a arquitetura técnica, desde que respeitem os requisitos funcionais e a lógica de gestão de memória descritos aqui.*
