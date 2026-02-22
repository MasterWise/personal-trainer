import { Router } from "express";
import { stmts } from "../db/index.js";
import { authMiddleware, generateId } from "../middleware/auth.js";

export default function conversationRoutes() {
  const router = Router();

  // Lista conversas arquivadas
  router.get("/api/conversations", authMiddleware, (req, res) => {
    try {
      const convos = stmts.listArchived.all(req.user.id);
      res.json(convos);
    } catch (error) {
      console.error("[Conversations Error][GET list]", error);
      res.status(500).json({ error: "Erro ao listar conversas" });
    }
  });

  // Busca conversa atual
  router.get("/api/conversations/current", authMiddleware, (req, res) => {
    try {
      const current = stmts.getCurrent.get(req.user.id);
      if (!current) {
        return res.json({ messages: [], id: null });
      }

      let messages = [];
      try {
        messages = JSON.parse(current.messages || "[]");
      } catch {
        messages = [];
      }

      res.json({
        id: current.id,
        messages,
        preview: current.preview,
        messageCount: current.message_count,
        createdAt: current.created_at,
      });
    } catch (error) {
      console.error("[Conversations Error][GET current]", error);
      res.status(500).json({ error: "Erro ao buscar conversa atual" });
    }
  });

  // Salva conversa atual
  router.put("/api/conversations/current", authMiddleware, (req, res) => {
    try {
      const { messages } = req.body;
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Campo 'messages' deve ser um array" });
      }

      const userId = req.user.id;
      const now = new Date().toISOString();

      // Verifica se ja existe uma conversa atual
      let current = stmts.getCurrent.get(userId);
      const convoId = current ? current.id : generateId();

      // Preview: primeira mensagem do usuario
      const firstUserMsg = messages.find(m => m.role === "user");
      const preview = firstUserMsg
        ? (typeof firstUserMsg.content === "string"
            ? firstUserMsg.content.slice(0, 100)
            : "")
        : "";

      stmts.saveCurrent.run(
        convoId,
        userId,
        JSON.stringify(messages),
        preview,
        messages.length,
        current ? current.created_at : now
      );

      res.json({ ok: true, id: convoId });
    } catch (error) {
      console.error("[Conversations Error][PUT current]", error);
      res.status(500).json({ error: "Erro ao salvar conversa" });
    }
  });

  // Arquiva conversa atual
  router.post("/api/conversations/archive", authMiddleware, (req, res) => {
    try {
      const userId = req.user.id;
      const current = stmts.getCurrent.get(userId);

      if (!current) {
        return res.status(404).json({ error: "Nenhuma conversa atual para arquivar" });
      }

      stmts.archiveCurrent.run(userId);
      res.json({ ok: true, archivedId: current.id });
    } catch (error) {
      console.error("[Conversations Error][POST archive]", error);
      res.status(500).json({ error: "Erro ao arquivar conversa" });
    }
  });

  // Deleta conversa arquivada
  router.delete("/api/conversations/:id", authMiddleware, (req, res) => {
    try {
      const result = stmts.deleteConvo.run(req.params.id, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Conversa nao encontrada" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Conversations Error][DELETE]", error);
      res.status(500).json({ error: "Erro ao deletar conversa" });
    }
  });

  return router;
}
