import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';

import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
  updateUserPassword,
  deleteUser
} from '../db/users.js';

import {
  createSession,
  findSessionByToken,
  updateSessionLastUsed,
  deleteSessionByToken,
  deleteOtherUserSessions,
  deleteAllUserSessions
} from '../db/sessions.js';

interface RegisterBody {
  email?: string;
  password?: string;
  nickname?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
  deviceName?: string;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_COOKIE_NAME = 'timezzw_session';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function authRoutes(app: FastifyInstance) {
  /*
   * =========================
   * 註冊
   * =========================
   */
  app.post<{ Body: RegisterBody }>(
    '/api/auth/register',
    async (request, reply) => {
      const email = normalizeEmail(request.body.email ?? '');
      const password = request.body.password ?? '';
      const nickname = request.body.nickname?.trim() || null;

      if (!email) {
        return reply.code(400).send({
          ok: false,
          error: 'EMAIL_REQUIRED'
        });
      }

      if (email.length > 320) {
        return reply.code(400).send({
          ok: false,
          error: 'EMAIL_TOO_LONG'
        });
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return reply.code(400).send({
          ok: false,
          error: 'INVALID_EMAIL'
        });
      }

      if (password.length < 8) {
        return reply.code(400).send({
          ok: false,
          error: 'PASSWORD_TOO_SHORT'
        });
      }

      if (password.length > 128) {
        return reply.code(400).send({
          ok: false,
          error: 'PASSWORD_TOO_LONG'
        });
      }

      if (nickname && nickname.length > 50) {
        return reply.code(400).send({
          ok: false,
          error: 'NICKNAME_TOO_LONG'
        });
      }

      const existingUser = await findUserByEmail(email);

      if (existingUser) {
        return reply.code(409).send({
          ok: false,
          error: 'EMAIL_ALREADY_EXISTS'
        });
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id
      });

      try {
        const user = await createUser({
          email,
          passwordHash,
          nickname
        });

        return reply.code(201).send({
          ok: true,
          user: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            avatar: user.avatar,
            status: user.status,
            createdAt: user.created_at
          }
        });
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        ) {
          return reply.code(409).send({
            ok: false,
            error: 'EMAIL_ALREADY_EXISTS'
          });
        }

        throw error;
      }
    }
  );

  /*
   * =========================
   * 登入
   * =========================
   */
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    async (request, reply) => {
      const email = normalizeEmail(request.body.email ?? '');
      const password = request.body.password ?? '';
      const deviceName =
        request.body.deviceName?.trim() || null;

      if (!email || !password) {
        return reply.code(400).send({
          ok: false,
          error: 'EMAIL_AND_PASSWORD_REQUIRED'
        });
      }

      const user = await findUserByEmail(email);

      if (!user) {
        return reply.code(401).send({
          ok: false,
          error: 'INVALID_CREDENTIALS'
        });
      }

      if (user.status !== 'active') {
        return reply.code(403).send({
          ok: false,
          error: 'ACCOUNT_UNAVAILABLE'
        });
      }

      let passwordValid = false;

      try {
        passwordValid = await argon2.verify(
          user.password_hash,
          password
        );
      } catch {
        passwordValid = false;
      }

      if (!passwordValid) {
        return reply.code(401).send({
          ok: false,
          error: 'INVALID_CREDENTIALS'
        });
      }

      const expiresAt = new Date(
        Date.now() + SESSION_DURATION_MS
      );

      const { token } = await createSession(
        user.id,
        expiresAt,
        deviceName
      );

      const isProduction =
        process.env.NODE_ENV === 'production';

      reply.setCookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt
      });

      return reply.code(200).send({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          status: user.status,
          createdAt: user.created_at
        },
        expiresAt
      });
    }
  );

  /*
   * =========================
   * 取得目前登入使用者
   * =========================
   */
app.patch('/api/auth/me', async (request, reply) => {
  const token = request.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return reply.code(401).send({
      ok: false,
      error: 'NOT_AUTHENTICATED'
    });
  }

  const session = await findSessionByToken(token);

  if (!session) {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return reply.code(401).send({
      ok: false,
      error: 'SESSION_INVALID'
    });
  }

  const user = await findUserById(session.user_id);

  if (!user || user.status !== 'active') {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return reply.code(401).send({
      ok: false,
      error: 'ACCOUNT_UNAVAILABLE'
    });
  }

  const body = request.body as {
    nickname?: unknown;
    avatar?: unknown;
  };

  const nickname =
    typeof body.nickname === 'string'
      ? body.nickname.trim() || null
      : user.nickname;

  const avatar =
    typeof body.avatar === 'string'
      ? body.avatar.trim() || null
      : user.avatar;

  if (nickname && nickname.length > 50) {
    return reply.code(400).send({
      ok: false,
      error: 'NICKNAME_TOO_LONG'
    });
  }

  if (avatar && avatar.length > 2000) {
    return reply.code(400).send({
      ok: false,
      error: 'AVATAR_TOO_LONG'
    });
  }

  const updatedUser = await updateUserProfile(
    user.id,
    nickname,
    avatar
  );

  if (!updatedUser) {
    return reply.code(404).send({
      ok: false,
      error: 'USER_NOT_FOUND'
    });
  }

  await updateSessionLastUsed(session.id);

  return reply.code(200).send({
    ok: true,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      nickname: updatedUser.nickname,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      createdAt: updatedUser.created_at
    }
  });
});

  /*
   * =========================
   * 修改密碼
   * =========================
   */
  app.post(
    '/api/auth/change-password',
    async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE_NAME];

      if (!token) {
        return reply.code(401).send({
          ok: false,
          error: 'NOT_AUTHENTICATED'
        });
      }

      const session = await findSessionByToken(token);

      if (!session) {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });

        return reply.code(401).send({
          ok: false,
          error: 'SESSION_INVALID'
        });
      }

      const user = await findUserById(session.user_id);

      if (!user || user.status !== 'active') {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });

        return reply.code(401).send({
          ok: false,
          error: 'ACCOUNT_UNAVAILABLE'
        });
      }

      const body = request.body as {
        currentPassword?: unknown;
        newPassword?: unknown;
      };

      const currentPassword =
        typeof body.currentPassword === 'string'
          ? body.currentPassword
          : '';

      const newPassword =
        typeof body.newPassword === 'string'
          ? body.newPassword
          : '';

      if (!currentPassword || !newPassword) {
        return reply.code(400).send({
          ok: false,
          error: 'CURRENT_AND_NEW_PASSWORD_REQUIRED'
        });
      }

      if (newPassword.length < 8) {
        return reply.code(400).send({
          ok: false,
          error: 'PASSWORD_TOO_SHORT'
        });
      }

      if (newPassword.length > 128) {
        return reply.code(400).send({
          ok: false,
          error: 'PASSWORD_TOO_LONG'
        });
      }

      let currentPasswordValid = false;

      try {
        currentPasswordValid = await argon2.verify(
          user.password_hash,
          currentPassword
        );
      } catch {
        currentPasswordValid = false;
      }

      if (!currentPasswordValid) {
        return reply.code(401).send({
          ok: false,
          error: 'INVALID_CURRENT_PASSWORD'
        });
      }

      if (currentPassword === newPassword) {
        return reply.code(400).send({
          ok: false,
          error: 'NEW_PASSWORD_SAME_AS_CURRENT'
        });
      }

      const newPasswordHash = await argon2.hash(
        newPassword,
        {
          type: argon2.argon2id
        }
      );

      const updated = await updateUserPassword(
        user.id,
        newPasswordHash
      );

      if (!updated) {
        return reply.code(404).send({
          ok: false,
          error: 'USER_NOT_FOUND'
        });
      }

      await deleteOtherUserSessions(
        user.id,
        session.id
      );

      await updateSessionLastUsed(session.id);

      return reply.code(200).send({
        ok: true
      });
    }
  );

  /*
   * =========================
   * 刪除帳戶
   * =========================
   */
  app.delete(
    '/api/auth/me',
    async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE_NAME];

      if (!token) {
        return reply.code(401).send({
          ok: false,
          error: 'NOT_AUTHENTICATED'
        });
      }

      const session = await findSessionByToken(token);

      if (!session) {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });

        return reply.code(401).send({
          ok: false,
          error: 'SESSION_INVALID'
        });
      }

      const user = await findUserById(session.user_id);

      if (!user || user.status !== 'active') {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });

        return reply.code(401).send({
          ok: false,
          error: 'ACCOUNT_UNAVAILABLE'
        });
      }

      const body = request.body as {
        currentPassword?: unknown;
      };

      const currentPassword =
        typeof body.currentPassword === 'string'
          ? body.currentPassword
          : '';

      if (!currentPassword) {
        return reply.code(400).send({
          ok: false,
          error: 'CURRENT_PASSWORD_REQUIRED'
        });
      }

      let passwordValid = false;

      try {
        passwordValid = await argon2.verify(
          user.password_hash,
          currentPassword
        );
      } catch {
        passwordValid = false;
      }

      if (!passwordValid) {
        return reply.code(401).send({
          ok: false,
          error: 'INVALID_CURRENT_PASSWORD'
        });
      }

      const deleted = await deleteUser(user.id);

      if (!deleted) {
        return reply.code(404).send({
          ok: false,
          error: 'USER_NOT_FOUND'
        });
      }

      await deleteAllUserSessions(user.id);

      reply.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });

      return reply.code(200).send({
        ok: true
      });
    }
  );

  /*
   * =========================
   * 登出
   * =========================
   */
  app.post(
    '/api/auth/logout',
    async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE_NAME];

      if (token) {
        await deleteSessionByToken(token);
      }

      reply.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });

      return reply.code(200).send({
        ok: true
      });
    }
  );
}
