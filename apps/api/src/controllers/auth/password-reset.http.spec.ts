import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { Server } from 'http';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource, EntityManager } from 'typeorm';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PasswordRecoveryToken } from 'src/entities/auth/password-recovery.entity';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersService } from 'src/services/users/users.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { PasswordResetService } from 'src/services/auth/password-reset.service';
import { PasswordRecoveryRateLimiter } from 'src/services/auth/password-recovery-rate-limiter';
import { INVALID_RECOVERY_TOKEN_MESSAGE } from 'src/dtos/auth/reset-password.dto';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { SessionRevokeReasons } from '@common/enums/sessionRevokeReasons';
import { PasswordResetController } from './password-reset.controller';
import { AuthController } from './auth.controller';

describe('HU-AUTH-02 password reset over HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let user: User;
  let tokens: PasswordRecoveryToken[];
  let sessions: UserSession[];
  let failure: 'password' | 'sessions' | 'tokens' | undefined;
  let expireUnderLock: boolean;
  let queue: Promise<void>;
  let originalEnvironment: NodeJS.ProcessEnv;
  const token = 'a'.repeat(64);
  const otherToken = 'b'.repeat(64);
  const password = 'NuevaClave123';
  const body = () => ({ token, password, confirmPassword: password });
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const limiter = { consume: jest.fn() };
  const tokenRepository = { findOne: jest.fn() };
  const lockedUserFind = jest.fn();
  const lockedTokenFind = jest.fn();
  const transaction = jest.fn(async (callback: (manager: EntityManager) => Promise<void>) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const localUser = { ...user };
    let localTokens = tokens.map((record) => ({ ...record }));
    const localSessions = sessions.map((session) => ({ ...session }));
    lockedUserFind.mockImplementation(() => Promise.resolve(localUser.isActive ? localUser : null));
    lockedTokenFind.mockImplementation(
      ({ where }: { where: { id: string; tokenHash: string } }) => {
        const record = localTokens.find(
          (record) => record.id === where.id && record.tokenHash === where.tokenHash,
        );
        if (record && expireUnderLock) record.expiresAt = new Date(Date.now() - 1);
        return Promise.resolve(record ?? null);
      },
    );
    const users = {
      findOne: lockedUserFind,
      update: jest.fn((_where: unknown, values: Partial<User>) => {
        Object.assign(localUser, values);
        if (failure === 'password') throw new Error('database password update failed');
        return Promise.resolve({ affected: 1 });
      }),
    };
    const tokenStore = {
      findOne: lockedTokenFind,
      delete: jest.fn(({ user: owner }: { user: { idUser: number } }) => {
        localTokens = localTokens.filter((record) => record.user.idUser !== owner.idUser);
        if (failure === 'tokens') throw new Error('database token delete failed');
        return Promise.resolve({ affected: 2 });
      }),
    };
    const sessionStore = {
      update: jest.fn(
        ({ user: owner }: { user: { idUser: number } }, values: Partial<UserSession>) => {
          for (const session of localSessions) {
            if (session.user.idUser === owner.idUser && session.isActive)
              Object.assign(session, values);
          }
          if (failure === 'sessions') throw new Error('database session update failed');
          return Promise.resolve({ affected: 1 });
        },
      ),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? users : entity === UserSession ? sessionStore : tokenStore,
    } as unknown as EntityManager;
    try {
      await callback(manager);
      user = localUser;
      tokens = localTokens;
      sessions = localSessions;
    } finally {
      release();
    }
  });
  const sessionRepository = {
    create: (value: Partial<UserSession>) =>
      Object.assign(new UserSession(), value, { idSession: sessions.length + 1, isActive: true }),
    save: jest.fn((session: UserSession) => {
      sessions.push(session);
      return Promise.resolve(session);
    }),
    find: jest.fn(() =>
      Promise.resolve(
        sessions.filter((session) => session.isActive).map((session) => ({ ...session, user })),
      ),
    ),
    findOne: jest.fn(({ where }: { where: { idSession: number } }) =>
      Promise.resolve(
        sessions.find((session) => session.idSession === where.idSession && session.isActive) ??
          null,
      ),
    ),
  };

  beforeEach(async () => {
    originalEnvironment = { ...process.env };
    Object.assign(process.env, {
      JWT_ACCESS_SECRET: 'test-access',
      JWT_ACCESS_REFRESH: 'test-refresh',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
    jest.clearAllMocks();
    user = Object.assign(new User(), {
      idUser: 1,
      name: 'Ana',
      email: 'ana@example.com',
      password: await bcrypt.hash('Anterior123', 4),
      isActive: true,
      roles: [],
    });
    sessions = [];
    tokens = [token, otherToken].map((value) =>
      Object.assign(new PasswordRecoveryToken(), {
        id: randomUUID(),
        user: { idUser: 1 },
        tokenHash: hash(value),
        expiresAt: new Date(Date.now() + 900000),
      }),
    );
    failure = undefined;
    expireUnderLock = false;
    queue = Promise.resolve();
    limiter.consume.mockResolvedValue(true);
    tokenRepository.findOne.mockImplementation(({ where }: { where: { tokenHash: string } }) => {
      const record = tokens.find(
        (record) =>
          record.tokenHash === where.tokenHash && record.expiresAt > new Date() && user.isActive,
      );
      return Promise.resolve(record ? { ...record, user: { idUser: user.idUser } } : null);
    });
    const module = await Test.createTestingModule({
      controllers: [PasswordResetController, AuthController],
      providers: [
        PasswordResetService,
        AuthService,
        SessionsService,
        JwtService,
        JwtStrategy,
        { provide: getRepositoryToken(PasswordRecoveryToken), useValue: tokenRepository },
        { provide: getRepositoryToken(UserSession), useValue: sessionRepository },
        { provide: DataSource, useValue: { transaction } },
        { provide: PasswordRecoveryRateLimiter, useValue: limiter },
        {
          provide: UsersService,
          useValue: {
            getForAuthentication: (email: string) =>
              Promise.resolve(email === user.email ? { ...user } : null),
            getOneById: () => Promise.resolve(user),
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterEach(async () => {
    await app.close();
    process.env = originalEnvironment;
  });
  const validate = (value: string) =>
    request(server).post('/api/auth/reset-password/validate').send({ token: value });
  const reset = (value: unknown) => request(server).post('/api/auth/reset-password').send(value);
  const login = (value: string) =>
    request(server).post('/api/auth/login').send({ email: 'ana@example.com', password: value });

  it('validates without consuming, changes the hash, invalidates every link and permits login only with the new password', async () => {
    await validate(token).expect(200);
    expect(tokens).toHaveLength(2);
    const response = await reset({ ...body(), idUser: 999, roleNames: ['SUPERADMIN'] }).expect(200);
    expect(await bcrypt.compare(password, user.password)).toBe(true);
    expect(bcrypt.getRounds(user.password)).toBe(10);
    expect(user.password).not.toBe(password);
    expect(user.updatedBy).toBe(1);
    expect(user.roles).toEqual([]);
    expect(tokens).toHaveLength(0);
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(JSON.stringify(response.body)).not.toContain(token);
    await validate(token).expect(400);
    await validate(otherToken).expect(400);
    await reset(body()).expect(400);
    await login('Anterior123').expect(401);
    await login(password).expect(201);
    expect(lockedUserFind).toHaveBeenCalledWith({
      where: { idUser: 1, isActive: true },
      lock: { mode: 'pessimistic_write' },
    });
    expect(lockedTokenFind).toHaveBeenCalledWith({
      where: { id: expect.any(String) as unknown, tokenHash: hash(token) },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('revokes access and refresh sessions with the existing password-change reason', async () => {
    const response = await login('Anterior123').expect(201);
    const prior = (response.body as { data: { accessToken: string; refreshToken: string } }).data;
    await request(server)
      .get('/api/auth/me')
      .auth(prior.accessToken, { type: 'bearer' })
      .expect(200);
    await reset(body()).expect(200);
    expect(sessions[0].isActive).toBe(false);
    expect(sessions[0].revokedReason).toBe(SessionRevokeReasons.PASSWORD_CHANGED);
    expect(sessions[0].revokedBy.idUser).toBe(1);
    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    await request(server)
      .get('/api/auth/me')
      .auth(prior.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: prior.refreshToken })
      .expect(401);
  });

  it.each(['', 'a'.repeat(63), 'g'.repeat(64), 'x'.repeat(10000)])(
    'rejects malformed tokens without touching persistence',
    async (value) => {
      await validate(value).expect(400);
      await reset({ ...body(), token: value }).expect(400);
      expect(tokenRepository.findOne).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['invalid', 'expired', 'inactive'])(
    'rejects %s tokens with the same generic message',
    async (kind) => {
      const original = user.password;
      if (kind === 'invalid') tokens = [];
      if (kind === 'expired')
        tokens.forEach((record) => {
          record.expiresAt = new Date(Date.now() - 1);
        });
      if (kind === 'inactive') user.isActive = false;
      const response = await reset(body()).expect(400);
      expect(response.body).toHaveProperty('message', INVALID_RECOVERY_TOKEN_MESSAGE);
      expect(user.password).toBe(original);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['short', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumero', 'Aa1' + 'á'.repeat(35)])(
    'rejects passwords outside the existing policy',
    async (value) => {
      await reset({ ...body(), password: value, confirmPassword: value }).expect(400);
      expect(transaction).not.toHaveBeenCalled();
      expect(tokens).toHaveLength(2);
    },
  );

  it('requires confirmation and rejects a mismatch without consuming the token', async () => {
    await reset({ token, password }).expect(400);
    await reset({ ...body(), confirmPassword: 'Diferente123' }).expect(400);
    expect(tokens).toHaveLength(2);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechecks expiration under the lock after hashing', async () => {
    const original = user.password;
    expireUnderLock = true;
    await reset(body()).expect(400);
    expect(user.password).toBe(original);
    expect(tokens).toHaveLength(2);
  });

  it.each(['password', 'sessions', 'tokens'] as const)(
    'rolls back the password, sessions and tokens on %s failure',
    async (step) => {
      await login('Anterior123').expect(201);
      const original = user.password;
      failure = step;
      await reset(body()).expect(500);
      expect(user.password).toBe(original);
      expect(tokens).toHaveLength(2);
      expect(sessions[0].isActive).toBe(true);
      await validate(token).expect(200);
    },
  );

  it.each([false, true])(
    'serializes simultaneous resets, including different tokens: %s',
    async (differentToken) => {
      const results = await Promise.all([
        reset(body()),
        reset({ ...body(), token: differentToken ? otherToken : token }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
      expect(tokens).toHaveLength(0);
    },
  );

  it('uses the existing shared limiter and fails closed before checking tokens', async () => {
    limiter.consume.mockResolvedValue(false);
    await validate(token).expect(429);
    await reset(body()).expect(429);
    expect(limiter.consume).toHaveBeenCalledWith(expect.stringContaining('password-reset:ip:'), 30);
    expect(tokenRepository.findOne).not.toHaveBeenCalled();
    limiter.consume.mockRejectedValue(new Error('database unavailable'));
    await reset(body()).expect(503);
  });
});
