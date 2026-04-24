import Database from "better-sqlite3";
import { dirname } from "path";
import { mkdirSync } from "fs";

const DB_PATH = process.env.DB_PATH || "./data/defuddle.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db: InstanceType<typeof Database> = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT NOT NULL UNIQUE,
    name        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active   INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id      INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    url         TEXT,
    status_code INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_usage_logs_key_id ON usage_logs(key_id);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
`);

// Migration: recreate usage_logs with ON DELETE CASCADE if it was created without it
const fkInfo = db.pragma("foreign_key_list(usage_logs)") as { on_delete: string }[];
if (fkInfo.length > 0 && fkInfo[0].on_delete !== "CASCADE") {
  db.exec(`
    BEGIN TRANSACTION;
    CREATE TABLE usage_logs_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id      INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      url         TEXT,
      status_code INTEGER,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO usage_logs_new SELECT * FROM usage_logs;
    DROP TABLE usage_logs;
    ALTER TABLE usage_logs_new RENAME TO usage_logs;
    CREATE INDEX idx_usage_logs_key_id ON usage_logs(key_id);
    CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
    COMMIT;
  `);
}

export default db;
