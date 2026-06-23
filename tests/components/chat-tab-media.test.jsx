import { describe, expect, it } from "vitest";
import { toApiMessage } from "../../src/components/chat/ChatTab.jsx";

describe("ChatTab media payload", () => {
  it("trata audio-only como mensagem principal do usuario para a IA", () => {
    const result = toApiMessage(
      {
        role: "user",
        content: "Anexo enviado.",
        attachments: [
          {
            kind: "audio",
            mediaRef: "pt-media/user/audio.wav",
            mimeType: "audio/wav",
            durationMs: 5000,
            sizeBytes: 12000,
          },
        ],
      },
      true
    );

    expect(result.content[0]).toEqual({
      type: "text",
      text: "Use o conteudo multimodal deste turno como parte da mensagem do usuario e responda diretamente ao que foi comunicado, sem mencionar formato, anexo ou processamento.",
    });
    expect(result.content[0].text).not.toMatch(/anexo enviado|analise o anexo/i);
    expect(result.content[1]).toMatchObject({
      type: "media",
      kind: "audio",
      mediaRef: "pt-media/user/audio.wav",
      mimeType: "audio/wav",
      durationMs: 5000,
    });
  });

  it("preserva texto digitado e inclui a midia como parte do mesmo turno", () => {
    const result = toApiMessage(
      {
        role: "user",
        content: "O que voce ve aqui?",
        attachments: [
          {
            kind: "image",
            mediaRef: "pt-media/user/image.webp",
            mimeType: "image/webp",
            width: 800,
            height: 600,
          },
        ],
      },
      true
    );

    expect(result.content[0].text).toContain("O que voce ve aqui?");
    expect(result.content[0].text).toContain("conteudo multimodal deste turno");
    expect(result.content[1]).toMatchObject({
      type: "media",
      kind: "image",
      mediaRef: "pt-media/user/image.webp",
      width: 800,
      height: 600,
    });
  });

  it("mantem historico anterior sem reintroduzir placeholder de anexo", () => {
    const result = toApiMessage(
      {
        role: "user",
        content: "Anexo enviado.",
        attachments: [{ kind: "audio", mediaRef: "old-audio", mimeType: "audio/wav" }],
      },
      false
    );

    expect(result.content).toContain("Mensagem multimodal enviada.");
    expect(result.content).toContain("Turno anterior com conteudo multimodal");
    expect(result.content).not.toContain("Anexo enviado.");
  });
});
