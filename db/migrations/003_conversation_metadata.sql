ALTER TABLE conversations ADD COLUMN conversation_type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE conversations ADD COLUMN plan_date TEXT;
ALTER TABLE conversations ADD COLUMN plan_version INTEGER;
ALTER TABLE conversations ADD COLUMN plan_thread_key TEXT;
ALTER TABLE conversations ADD COLUMN origin_action TEXT;
ALTER TABLE conversations ADD COLUMN updated_at TEXT;

UPDATE conversations
SET conversation_type = COALESCE(conversation_type, 'general');

UPDATE conversations
SET updated_at = COALESCE(updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_type_date
  ON conversations(user_id, conversation_type, plan_date, plan_version);

CREATE INDEX IF NOT EXISTS idx_conversations_plan_thread
  ON conversations(user_id, plan_thread_key, plan_version);
