import { pool } from './client.js';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  nickname: string | null;
  avatar: string | null;
  status: 'active' | 'disabled' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  nickname?: string | null;
  avatar?: string | null;
}

export async function findUserByEmail(
  email: string
): Promise<User | null> {
  const result = await pool.query<User>(
    `
      SELECT
        id,
        email,
        password_hash,
        nickname,
        avatar,
        status,
        created_at,
        updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function findUserById(
  id: string
): Promise<User | null> {
  const result = await pool.query<User>(
    `
      SELECT
        id,
        email,
        password_hash,
        nickname,
        avatar,
        status,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function createUser(
  input: CreateUserInput
): Promise<User> {
  const result = await pool.query<User>(
    `
      INSERT INTO users (
        email,
        password_hash,
        nickname,
        avatar
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        email,
        password_hash,
        nickname,
        avatar,
        status,
        created_at,
        updated_at
    `,
    [
      input.email,
      input.passwordHash,
      input.nickname ?? null,
      input.avatar ?? null
    ]
  );

  return result.rows[0];
}

export async function updateUserProfile(
  id: string,
  nickname: string | null,
  avatar: string | null
): Promise<User | null> {
  const result = await pool.query<User>(
    `
      UPDATE users
      SET
        nickname = $2,
        avatar = $3,
        updated_at = NOW()
      WHERE id = $1
        AND status != 'deleted'
      RETURNING
        id,
        email,
        password_hash,
        nickname,
        avatar,
        status,
        created_at,
        updated_at
    `,
    [id, nickname, avatar]
  );

  return result.rows[0] ?? null;
}

export async function updateUserPassword(
  id: string,
  passwordHash: string
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE users
      SET
        password_hash = $2,
        updated_at = NOW()
      WHERE id = $1
        AND status != 'deleted'
    `,
    [id, passwordHash]
  );

  return result.rowCount === 1;
}

export async function deleteUser(
  id: string
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE users
      SET
        status = 'deleted',
        updated_at = NOW()
      WHERE id = $1
        AND status != 'deleted'
    `,
    [id]
  );

  return result.rowCount === 1;
}
