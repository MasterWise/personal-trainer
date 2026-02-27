import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -- Conexao --

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");
const DEFAULT_DB_PATH = path.join(DEFAULT_DATA_DIR, "personal-trainer.sqlite");

const DB_PATH = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
const DATA_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// -- Migration Runner --

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );
`);

function getCurrentVersion() {
  const row = db.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get();
  return row ? row.version : 0;
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  const current = getCurrentVersion();

  for (const file of files) {
    const match = file.match(/^(\d+)/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (version <= current) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
    console.log(`[DB] Migration aplicada: ${file}`);
  }
}

runMigrations();

// -- Prepared Statements --

const CONVERSATION_SELECT_COLUMNS = `
  id, user_id, messages, preview, message_count, is_current, created_at,
  conversation_type, plan_date, plan_version, plan_thread_key, origin_action, updated_at
`;

const stmts = {
  // Users
  getUserById: db.prepare("SELECT * FROM users WHERE id = ?"),
  getUserByName: db.prepare("SELECT * FROM users WHERE name = ?"),
  countUsers: db.prepare("SELECT COUNT(*) as count FROM users"),
  insertUser: db.prepare(`
    INSERT INTO users (id, name, password_hash, is_admin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateUser: db.prepare(`
    UPDATE users SET name = ?, updated_at = ? WHERE id = ?
  `),

  // Sessions
  getSession: db.prepare("SELECT * FROM sessions WHERE id = ?"),
  insertSession: db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `),
  deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
  deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),

  // User Documents
  getDoc: db.prepare("SELECT * FROM user_documents WHERE user_id = ? AND doc_key = ?"),
  getAllDocs: db.prepare("SELECT * FROM user_documents WHERE user_id = ?"),
  upsertDoc: db.prepare(`
    INSERT INTO user_documents (user_id, doc_key, content, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, doc_key) DO UPDATE SET
      content = excluded.content,
      updated_at = excluded.updated_at
  `),

  // Conversations
  getCurrent: db.prepare(`SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations WHERE user_id = ? AND is_current = 1 LIMIT 1`),
  getConversationById: db.prepare(`SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations WHERE id = ? AND user_id = ? LIMIT 1`),
  saveCurrent: db.prepare(`
    INSERT INTO conversations (
      id, user_id, messages, preview, message_count, is_current, created_at,
      conversation_type, plan_date, plan_version, plan_thread_key, origin_action, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      messages = excluded.messages,
      preview = excluded.preview,
      message_count = excluded.message_count,
      is_current = 1,
      conversation_type = excluded.conversation_type,
      plan_date = excluded.plan_date,
      plan_version = excluded.plan_version,
      plan_thread_key = excluded.plan_thread_key,
      origin_action = excluded.origin_action,
      updated_at = excluded.updated_at
  `),
  listArchived: db.prepare(
    `SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations
     WHERE user_id = ? AND is_current = 0 AND COALESCE(conversation_type, 'general') = 'general'
     ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC`
  ),
  archiveCurrent: db.prepare(
    "UPDATE conversations SET is_current = 0 WHERE user_id = ? AND is_current = 1"
  ),
  clearCurrentForUser: db.prepare("UPDATE conversations SET is_current = 0 WHERE user_id = ? AND is_current = 1"),
  activateConversation: db.prepare(`
    UPDATE conversations
    SET is_current = 1,
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `),
  getLatestPlanConversationByDate: db.prepare(
    `SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations
     WHERE user_id = ?
       AND COALESCE(conversation_type, 'general') = 'plan'
       AND plan_date = ?
     ORDER BY COALESCE(plan_version, 0) DESC, COALESCE(updated_at, created_at) DESC, created_at DESC
     LIMIT 1`
  ),
  listPlanHistoryByDate: db.prepare(
    `SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations
     WHERE user_id = ?
       AND COALESCE(conversation_type, 'general') = 'plan'
       AND plan_date = ?
     ORDER BY COALESCE(plan_version, 0) DESC, COALESCE(updated_at, created_at) DESC, created_at DESC`
  ),
  deleteConvo: db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?"),

  // AI Logs
  insertAiLog: db.prepare(`
    INSERT INTO ai_logs (
      id, user_id, created_at,
      system_prompt, system_prompt_length, messages_sent, messages_count,
      model, thinking_enabled, thinking_budget,
      response_raw, response_id, reply_text, updates_json, updates_count,
      input_tokens, output_tokens, total_tokens, duration_ms,
      success, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listAiLogs: db.prepare(
    "SELECT id, created_at, model, messages_count, updates_count, input_tokens, output_tokens, total_tokens, duration_ms, success, error_message, reply_text FROM ai_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ),
  getAiLog: db.prepare("SELECT * FROM ai_logs WHERE id = ? AND user_id = ?"),
  deleteAiLogs: db.prepare("DELETE FROM ai_logs WHERE user_id = ?"),
};

export { db, stmts };
