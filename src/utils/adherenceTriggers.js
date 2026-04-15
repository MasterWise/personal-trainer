/**
 * Evaluate health data for automatic progresso triggers.
 * Returns array of progresso entries to create.
 */
export function evaluateAdherenceTriggers(healthViewModel, medidasArr, progressoArr) {
  const triggers = [];
  const { treinosFeitos, treinosPlanejados } = healthViewModel;
  const todayLabel = new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

  // Weekly training adherence >90%
  if (treinosPlanejados > 0 && (treinosFeitos / treinosPlanejados) >= 0.9) {
    const exists = progressoArr.some(p =>
      p.date === todayLabel && p.type === "Conquista" && p.context?.includes("semanal")
    );
    if (!exists) {
      triggers.push({
        title: "Semana com alta adesão!",
        type: "Conquista",
        context: `Adesão semanal: ${treinosFeitos}/${treinosPlanejados} treinos`,
        significado: "Consistência e comprometimento com o plano.",
      });
    }
  }

  // Weekly training adherence <50%
  if (treinosPlanejados > 0 && (treinosFeitos / treinosPlanejados) < 0.5) {
    const exists = progressoArr.some(p =>
      p.date === todayLabel && p.type === "Dificuldade" && p.context?.includes("semanal")
    );
    if (!exists) {
      triggers.push({
        title: "Semana com baixa adesão",
        type: "Dificuldade",
        context: `Adesão: ${treinosFeitos}/${treinosPlanejados} treinos`,
        significado: "Identificar obstáculos e ajustar plano.",
      });
    }
  }

  // New lowest weight in medidas
  if (medidasArr.length >= 2) {
    const withWeight = medidasArr.filter(m => m.peso_kg);
    if (withWeight.length >= 2) {
      const latest = withWeight[withWeight.length - 1];
      const previousMin = Math.min(...withWeight.slice(0, -1).map(m => Number(m.peso_kg)));
      if (Number(latest.peso_kg) < previousMin) {
        const exists = progressoArr.some(p =>
          p.type === "Conquista" && p.context?.includes(String(latest.peso_kg))
        );
        if (!exists) {
          triggers.push({
            title: "Novo menor peso!",
            type: "Conquista",
            context: `${latest.peso_kg}kg — recorde pessoal`,
            significado: "Progresso real e mensurável.",
          });
        }
      }
    }
  }

  return triggers;
}
