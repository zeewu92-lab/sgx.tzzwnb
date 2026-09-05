import { randomBytes, createHash } from 'node:crypto';
import { pool } from './client.js';

export interface SessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  device_name: string | null;
  created_at: Date;
  expires_at: Date;
  last_used_at: Date;
}

const SESSION_TOKEN_BYTES = 32;

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

export async function createSession(
  userId: string,
  expiresAt: Date,
  deviceName: string | null = null
): Promise<{
  session: SessionRecord;
  token: string;
}> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  const result = await pool.query<SessionRecord>(
    `
      INSERT INTO sessions (
        user_id,
        token_hash,
        device_name,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        user_id,
        token_hash,
        device_name,
        created_at,
        expires_at,
        last_used_at
    `,
    [
      userId,
      tokenHash,
      deviceName,
      expiresAt
    ]
  );

  return {
    session: result.rows[0],
    token
  };
}

export async function findSessionByToken(
  token: string
): Promise<SessionRecord | null> {
  const tokenHash = hashSessionToken(token);

  const result = await pool.query<SessionRecord>(
    `
      SELECT
        id,
        user_id,
        token_hash,
        device_name,
        created_at,
        expires_at,
        last_used_at
      FROM sessions
      WHERE token_hash = $1
        AND expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function updateSessionLastUsed(
  sessionId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE sessions
      SET last_used_at = NOW()
      WHERE id = $1
    `,
    [sessionId]
  );
}

export async function deleteSession(
  sessionId: string
): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM sessions
      WHERE id = $1
    `,
    [sessionId]
  );

  return result.rowCount === 1;
}

export async function deleteSessionByToken(
  token: string
): Promise<boolean> {
  const tokenHash = hashSessionToken(token);

  const result = await pool.query(
    `
      DELETE FROM sessions
      WHERE token_hash = $1
    `,
    [tokenHash]
  );

  return result.rowCount === 1;
}

export async function deleteAllUserSessions(
  userId: string
): Promise<number> {
  const result = await pool.query(
    `
      DELETE FROM sessions
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rowCount ?? 0;
}

export async function deleteOtherUserSessions(
  userId: string,
  currentSessionId: string
): Promise<number> {
  const result = await pool.query(
    `
      DELETE FROM sessions
      WHERE user_id = $1
        AND id != $2
    `,
    [userId, currentSessionId]
  );

  return result.rowCount ?? 0;
}
