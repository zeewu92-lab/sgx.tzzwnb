import type { FastifyInstance } from 'fastify';
import {
  findSessionByToken,
  updateSessionLastUsed
} from '../db/sessions.js';
import {
  findUserById
} from '../db/users.js';
import {
  findEventById,
  upsertEvent,
  deleteEvent,
  listEventsSince
} from '../db/events.js';
import {
  createSyncChange,
  listSyncChangesSince
} from '../db/syncChanges.js';

const SESSION_COOKIE_NAME = 'timezzw_session';

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseCursor(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 0;
  }

  const cursor = Number(value);

  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    return 0;
  }

  return cursor;
}

async function authenticate(
  request: Parameters<FastifyInstance['post']>[0] extends never
    ? never
    : any,
  reply: any
) {
  const token = request.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    reply.code(401).send({
      ok: false,
      error: 'NOT_AUTHENTICATED'
    });
    return null;
  }

  const session = await findSessionByToken(token);

  if (!session) {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    reply.code(401).send({
      ok: false,
      error: 'SESSION_INVALID'
    });

    return null;
  }

  const user = await findUserById(session.user_id);

  if (!user || user.status !== 'active') {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    reply.code(401).send({
      ok: false,
      error: 'ACCOUNT_UNAVAILABLE'
    });

    return null;
  }

  await updateSessionLastUsed(session.id);

  return {
    user,
    session
  };
}

export async function syncRoutes(app: FastifyInstance) {
  app.post(
    '/api/sync/push',
    async (request, reply) => {
      const auth = await authenticate(request, reply);

      if (!auth) {
        return;
      }

      const body = request.body as {
        changes?: unknown;
      };

      if (!Array.isArray(body?.changes)) {
        return reply.code(400).send({
          ok: false,
          error: 'CHANGES_REQUIRED'
        });
      }

      if (body.changes.length > 500) {
        return reply.code(400).send({
          ok: false,
          error: 'TOO_MANY_CHANGES'
        });
      }

      const results = [];

      for (const item of body.changes) {
        if (!item || typeof item !== 'object') {
          results.push({
            ok: false,
            error: 'INVALID_CHANGE'
          });
          continue;
        }

        const change = item as {
          id?: unknown;
          operation?: unknown;
          data?: unknown;
          updatedAt?: unknown;
        };

        if (
          typeof change.id !== 'string' ||
          !change.id
        ) {
          results.push({
            ok: false,
            error: 'EVENT_ID_REQUIRED'
          });
          continue;
        }

        if (
          change.operation !== 'upsert' &&
          change.operation !== 'delete'
        ) {
          results.push({
            ok: false,
            error: 'INVALID_OPERATION',
            id: change.id
          });
          continue;
        }

        const updatedAt = parseDate(change.updatedAt);

        if (!updatedAt) {
          results.push({
            ok: false,
            error: 'INVALID_UPDATED_AT',
            id: change.id
          });
          continue;
        }

        try {
          if (change.operation === 'upsert') {
            if (
              typeof change.data !== 'object' ||
              change.data === null ||
              Array.isArray(change.data)
            ) {
              results.push({
                ok: false,
                error: 'INVALID_EVENT_DATA',
                id: change.id
              });
              continue;
            }

            const existing = await findEventById(
              auth.user.id,
              change.id
            );

            if (
              existing &&
              existing.updated_at.getTime() > updatedAt.getTime()
            ) {
              results.push({
                ok: true,
                id: change.id,
                operation: 'upsert',
                applied: false,
                reason: 'SERVER_NEWER'
              });
              continue;
            }

            await upsertEvent(
              auth.user.id,
              change.id,
              change.data,
              updatedAt
            );

            await createSyncChange(
              auth.user.id,
              change.id,
              'upsert',
              updatedAt
            );

            results.push({
              ok: true,
              id: change.id,
              operation: 'upsert',
              applied: true
            });
          } else {
            const existing = await findEventById(
              auth.user.id,
              change.id
            );

            if (
              existing &&
              existing.updated_at.getTime() > updatedAt.getTime()
            ) {
              results.push({
                ok: true,
                id: change.id,
                operation: 'delete',
                applied: false,
                reason: 'SERVER_NEWER'
              });
              continue;
            }

            const deleted = await deleteEvent(
              auth.user.id,
              change.id,
              updatedAt
            );

            if (deleted) {
              await createSyncChange(
                auth.user.id,
                change.id,
                'delete',
                updatedAt
              );
            }

            results.push({
              ok: true,
              id: change.id,
              operation: 'delete',
              applied: Boolean(deleted)
            });
          }
        } catch (error) {
          app.log.error(error);

          results.push({
            ok: false,
            id: change.id,
            error: 'SYNC_WRITE_FAILED'
          });
        }
      }

      return reply.code(200).send({
        ok: true,
        results
      });
    }
  );

  app.get(
    '/api/sync/pull',
    async (request, reply) => {
      const auth = await authenticate(request, reply);

      if (!auth) {
        return;
      }

      const query = request.query as {
        since?: unknown;
      };

      const sinceCursor = parseCursor(query?.since);

      const changes = await listSyncChangesSince(
        auth.user.id,
        sinceCursor
      );

      const eventIds = [
        ...new Set(changes.map(change => change.event_id))
      ];

      const events = [];

      for (const eventId of eventIds) {
        const event = await findEventById(
          auth.user.id,
          eventId
        );

        if (event) {
          events.push(event);
        }
      }

      const nextCursor =
        changes.length > 0
          ? changes[changes.length - 1].id
          : sinceCursor;

      return reply.code(200).send({
        ok: true,
        cursor: {
          since: sinceCursor,
          next: nextCursor
        },
        events
      });
    }
  );

  app.get(
    '/api/sync/full',
    async (request, reply) => {
      const auth = await authenticate(request, reply);

      if (!auth) {
        return;
      }

      const events = await listEventsSince(
        auth.user.id,
        null
      );

      return reply.code(200).send({
        ok: true,
        events
      });
    }
  );
}
