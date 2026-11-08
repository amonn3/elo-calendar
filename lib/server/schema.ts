// SQL shared by local SQLite and production PostgreSQL; times are Unix milliseconds.
export const schema = [
 `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,
 `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS calendar_connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL, provider_user_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at BIGINT NOT NULL, UNIQUE(user_id, provider, provider_user_id))`,
 `CREATE INDEX IF NOT EXISTS connections_user_idx ON calendar_connections(user_id)`,
 `CREATE TABLE IF NOT EXISTS oauth_transactions (state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_hash TEXT NOT NULL, provider TEXT NOT NULL, verifier TEXT NOT NULL, browser_hash TEXT NOT NULL, expires_at BIGINT NOT NULL)`,
];
