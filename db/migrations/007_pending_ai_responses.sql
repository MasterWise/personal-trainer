-- Response Inbox: persistencia server-side de respostas da IA
-- Garante que respostas nao se perdem se o usuario sai da tela

CREATE TABLE IF NOT EXISTS pending_ai_responses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT,
  cli_session_id TEXT,
  trigger_message TEXT,
  response_raw TEXT NOT NULL,
  reply_text TEXT,
  updates_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  processed_at TEXT,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hot path: listar pendentes do usuario (reconnect polling)
CREATE INDEX IF NOT EXISTS idx_pending_user_pending
  ON pending_ai_responses(user_id, created_at)
  WHERE status = 'pending';

-- Cleanup: expirados nao-pendentes
CREATE INDEX IF NOT EXISTS idx_pending_expires
  ON pending_ai_responses(expires_at)
  WHERE status != 'pending';

-- Safeguard: persistir _sessionId do CLI na conversa
-- Evita desync com --resume apos page reload
ALTER TABLE conversations ADD COLUMN cli_session_id TEXT;
