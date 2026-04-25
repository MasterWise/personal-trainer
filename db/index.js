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
db.exec("PRAGMA foreign_keys = ON");

// -- Migration Runner --

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applied_migrations (
    filename TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at TEXT NOT NULL
  );
`);

function getCurrentVersion() {
  const row = db.prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").get();
  return row ? row.version : 0;
}

function withTransaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw error;
  }
}

function runMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  const current = getCurrentVersion();
  const appliedRows = db.prepare("SELECT filename FROM applied_migrations").all();
  const appliedFiles = new Set(appliedRows.map((row) => row.filename));

  if (appliedFiles.size === 0 && current > 0) {
    const backfillRows = files
      .map((file) => {
        const match = file.match(/^(\d+)/);
        if (!match) return null;
        return { file, version: parseInt(match[1], 10) };
      })
      .filter(Boolean)
      .filter((entry) => entry.version <= current);

    if (backfillRows.length > 0) {
      withTransaction(() => {
        const insertMigration = db.prepare("INSERT OR IGNORE INTO applied_migrations (filename, version, applied_at) VALUES (?, ?, ?)");
        const now = new Date().toISOString();
        for (const row of backfillRows) {
          insertMigration.run(row.file, row.version, now);
        }
      });
      backfillRows.forEach((row) => appliedFiles.add(row.file));
    }
  }

  for (const file of files) {
    const match = file.match(/^(\d+)/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (appliedFiles.has(file)) continue;
    if (version <= current && appliedFiles.size > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    withTransaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
      db.prepare("INSERT INTO applied_migrations (filename, version, applied_at) VALUES (?, ?, ?)").run(file, version, new Date().toISOString());
    });
    console.log(`[DB] Migration aplicada: ${file}`);
  }
}

runMigrations();

// -- Prepared Statements --

const CONVERSATION_SELECT_COLUMNS = `
  id, user_id, messages, preview, message_count, is_current, created_at,
  conversation_type, plan_date, plan_version, plan_thread_key, origin_action, updated_at,
  cli_session_id
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
  updateSessionExpiry: db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?"),

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
  getCurrent: db.prepare(
    `SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations
     WHERE user_id = ? AND is_current = 1
     ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
     LIMIT 1`
  ),
  getConversationById: db.prepare(`SELECT ${CONVERSATION_SELECT_COLUMNS} FROM conversations WHERE id = ? AND user_id = ? LIMIT 1`),
  saveCurrent: db.prepare(`
    INSERT INTO conversations (
      id, user_id, messages, preview, message_count, is_current, created_at,
      conversation_type, plan_date, plan_version, plan_thread_key, origin_action, updated_at,
      cli_session_id
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
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
      updated_at = excluded.updated_at,
      cli_session_id = COALESCE(excluded.cli_session_id, conversations.cli_session_id)
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
      success, error_message, request_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  listAiLogs: db.prepare(
    "SELECT id, created_at, model, messages_count, updates_count, input_tokens, output_tokens, total_tokens, duration_ms, success, error_message, reply_text FROM ai_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ),
  getAiLog: db.prepare("SELECT * FROM ai_logs WHERE id = ? AND user_id = ?"),
  deleteAiLogs: db.prepare("DELETE FROM ai_logs WHERE user_id = ?"),

  // Invites
  insertInvite: db.prepare(`
    INSERT INTO invites (code, created_by, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `),
  getInvite: db.prepare("SELECT * FROM invites WHERE code = ?"),
  markInviteUsed: db.prepare("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?"),
  listInvitesByCreator: db.prepare(
    "SELECT code, created_at, expires_at, used_by, used_at FROM invites WHERE created_by = ? ORDER BY created_at DESC LIMIT 50"
  ),
  deleteInvite: db.prepare("DELETE FROM invites WHERE code = ? AND created_by = ? AND used_by IS NULL"),
  listAllUsers: db.prepare("SELECT id, name, is_admin, created_at FROM users ORDER BY created_at ASC"),

  // Pending AI Responses (Response Inbox)
  insertPendingResponse: db.prepare(`
    INSERT INTO pending_ai_responses
      (id, user_id, conversation_id, cli_session_id, trigger_message,
       response_raw, reply_text, updates_json, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  completePendingResponse: db.prepare(`
    UPDATE pending_ai_responses
    SET status = 'pending', response_raw = ?, reply_text = ?, updates_json = ?
    WHERE id = ? AND user_id = ? AND status = 'in_flight'
  `),
  failPendingResponse: db.prepare(`
    UPDATE pending_ai_responses
    SET status = 'failed', response_raw = ?, processed_at = ?
    WHERE id = ? AND user_id = ? AND status = 'in_flight'
  `),
  listPendingByUser: db.prepare(`
    SELECT id, conversation_id, cli_session_id, trigger_message,
           reply_text, updates_json, status, created_at
    FROM pending_ai_responses
    WHERE user_id = ? AND status IN ('pending', 'in_flight')
    ORDER BY created_at ASC
  `),
  getPendingById: db.prepare(`
    SELECT id, user_id, conversation_id, cli_session_id, trigger_message,
           response_raw, reply_text, updates_json, status, created_at, processed_at
    FROM pending_ai_responses
    WHERE id = ? AND user_id = ?
  `),
  ackPendingResponse: db.prepare(`
    UPDATE pending_ai_responses
    SET status = 'processed', processed_at = ?
    WHERE id = ? AND user_id = ? AND status = 'pending'
  `),
  cleanupExpiredPending: db.prepare(`
    DELETE FROM pending_ai_responses
    WHERE expires_at < ? AND status NOT IN ('pending', 'in_flight')
  `),
};

export { db, stmts, withTransaction };
