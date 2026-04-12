// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../src/contexts/ThemeContext.jsx";
import PlanoView from "../../src/views/PlanoView.jsx";

function renderWithTheme(ui) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function buildProps(overrides = {}) {
  return {
    planoDictStr: "{}",
    cal: "{}",
    onGeneratePlan: vi.fn(),
    onEditPlan: vi.fn(),
    onNewPlan: vi.fn(),
    onRemovePlan: vi.fn().mockResolvedValue(true),
    removingPlan: false,
    onOpenPlanHistory: vi.fn(),
    planHistoryOpen: false,
    setPlanHistoryOpen: vi.fn(),
    planHistoryItems: [],
    planHistoryLoading: false,
    onOpenPlanVersion: vi.fn(),
    generating: false,
    onToggleItem: vi.fn(),
    selectedDate: "12/04/2026",
    setSelectedDate: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("PlanoView", () => {
  it("mostra CTA de gerar plano quando a data nao tem plano", async () => {
    const user = userEvent.setup();
    const props = buildProps();

    renderWithTheme(<PlanoView {...props} />);

    expect(screen.getByText(/Nenhum plano para esta data/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /gerar plano/i }));
    expect(props.onGeneratePlan).toHaveBeenCalledTimes(1);
  });

  it("abre o menu de acoes do plano existente e confirma remocao", async () => {
    const user = userEvent.setup();
    const props = buildProps({
      planoDictStr: JSON.stringify({
        "12/04/2026": {
          date: "12/04/2026",
          meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
          grupos: [
            {
              nome: "Manha",
              emoji: "🌅",
              itens: [{ id: "i1", tipo: "outro", texto: "Beber agua", checked: false }],
            },
          ],
        },
      }),
    });

    renderWithTheme(<PlanoView {...props} />);

    await user.click(screen.getByRole("button", { name: /mais ações do plano/i }));
    await user.click(screen.getByRole("button", { name: /histórico de versões/i }));
    expect(props.onOpenPlanHistory).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /mais ações do plano/i }));
    await user.click(screen.getByRole("button", { name: /remover plano/i }));

    expect(screen.getByText(/Remover plano do dia/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Remover plano$/i }));
    expect(props.onRemovePlan).toHaveBeenCalledTimes(1);
  });
});
