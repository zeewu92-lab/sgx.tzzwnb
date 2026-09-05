CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email VARCHAR(320) NOT NULL UNIQUE,

  password_hash TEXT NOT NULL,

  nickname VARCHAR(50),

  avatar TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'deleted')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  token_hash TEXT NOT NULL UNIQUE,

  device_name VARCHAR(100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  expires_at TIMESTAMPTZ NOT NULL,

  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  data JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_events_user_id
  ON events(user_id);

CREATE INDEX IF NOT EXISTS idx_events_user_updated_at
  ON events(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_events_user_deleted_at
  ON events(user_id, deleted_at);


CREATE TABLE IF NOT EXISTS sync_changes (
  id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  event_id UUID NOT NULL,

  operation VARCHAR(20) NOT NULL
    CHECK (operation IN ('upsert', 'delete')),

  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_user_id
  ON sync_changes(user_id);

CREATE INDEX IF NOT EXISTS idx_sync_changes_user_id_id
  ON sync_changes(user_id, id);

CREATE INDEX IF NOT EXISTS idx_sync_changes_event_id
  ON sync_changes(event_id);

