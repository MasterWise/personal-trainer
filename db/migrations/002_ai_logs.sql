CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  
  -- Request
  system_prompt TEXT,
  system_prompt_length INTEGER,
  messages_sent TEXT,         -- JSON: array of {role, content}
  messages_count INTEGER,
  model TEXT,
  thinking_enabled INTEGER DEFAULT 0,
  thinking_budget INTEGER,
  
  -- Response
  response_raw TEXT,          -- Full raw API response JSON
  response_id TEXT,           -- Anthropic response id
  reply_text TEXT,             -- Parsed reply field
  updates_json TEXT,          -- Parsed updates array as JSON
  updates_count INTEGER DEFAULT 0,
  
  -- Usage & Performance
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  duration_ms INTEGER,
  
  -- Status
  success INTEGER DEFAULT 1,
  error_message TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_date ON ai_logs(created_at);
