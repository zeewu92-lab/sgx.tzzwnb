import { pool } from './client.js';

export type SyncOperation = 'upsert' | 'delete';

export interface SyncChangeRecord {
  id: number;
  user_id: string;
  event_id: string;
  operation: SyncOperation;
  changed_at: Date;
}

export async function createSyncChange(
  userId: string,
  eventId: string,
  operation: SyncOperation,
  changedAt: Date = new Date()
): Promise<SyncChangeRecord> {
  const result = await pool.query<SyncChangeRecord>(
    `
      INSERT INTO sync_changes (
        user_id,
        event_id,
        operation,
        changed_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        user_id,
        event_id,
        operation,
        changed_at
    `,
    [
      userId,
      eventId,
      operation,
      changedAt
    ]
  );

  return result.rows[0];
}

export async function listSyncChangesSince(
  userId: string,
  sinceId: number
): Promise<SyncChangeRecord[]> {
  const result = await pool.query<SyncChangeRecord>(
    `
      SELECT
        id,
        user_id,
        event_id,
        operation,
        changed_at
      FROM sync_changes
      WHERE user_id = $1
        AND id > $2
      ORDER BY id ASC
    `,
    [userId, sinceId]
  );

  return result.rows;
}
