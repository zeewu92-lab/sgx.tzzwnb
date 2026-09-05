import { pool } from './client.js';

export interface EventRecord {
  id: string;
  user_id: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export async function findEventById(
  userId: string,
  eventId: string
): Promise<EventRecord | null> {
  const result = await pool.query<EventRecord>(
    `
      SELECT
        id,
        user_id,
        data,
        created_at,
        updated_at,
        deleted_at
      FROM events
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, eventId]
  );

  return result.rows[0] ?? null;
}

export async function upsertEvent(
  userId: string,
  eventId: string,
  data: unknown,
  updatedAt: Date
): Promise<EventRecord> {
  const result = await pool.query<EventRecord>(
    `
      INSERT INTO events (
        id,
        user_id,
        data,
        updated_at
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
      WHERE events.user_id = EXCLUDED.user_id
        AND events.updated_at <= EXCLUDED.updated_at
      RETURNING
        id,
        user_id,
        data,
        created_at,
        updated_at,
        deleted_at
    `,
    [
      eventId,
      userId,
      JSON.stringify(data),
      updatedAt
    ]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const existing = await findEventById(userId, eventId);

  if (!existing) {
    throw new Error('EVENT_NOT_FOUND_AFTER_UPSERT');
  }

  return existing;
}

export async function deleteEvent(
  userId: string,
  eventId: string,
  deletedAt: Date
): Promise<EventRecord | null> {
  const result = await pool.query<EventRecord>(
    `
      UPDATE events
      SET
        updated_at = $3,
        deleted_at = $3
      WHERE user_id = $1
        AND id = $2
        AND updated_at <= $3
      RETURNING
        id,
        user_id,
        data,
        created_at,
        updated_at,
        deleted_at
    `,
    [
      userId,
      eventId,
      deletedAt
    ]
  );

  return result.rows[0] ?? null;
}

export async function listEventsSince(
  userId: string,
  since: Date | null
): Promise<EventRecord[]> {
  if (since) {
    const result = await pool.query<EventRecord>(
      `
        SELECT
          id,
          user_id,
          data,
          created_at,
          updated_at,
          deleted_at
        FROM events
        WHERE user_id = $1
          AND updated_at > $2
        ORDER BY updated_at ASC, id ASC
      `,
      [userId, since]
    );

    return result.rows;
  }

  const result = await pool.query<EventRecord>(
    `
      SELECT
        id,
        user_id,
        data,
        created_at,
        updated_at,
        deleted_at
      FROM events
      WHERE user_id = $1
      ORDER BY updated_at ASC, id ASC
    `,
    [userId]
  );

  return result.rows;
}
