import { INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'http';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { PasswordRecoveryController } from './password-recovery.controller';
import {
  PasswordRecoveryService,
  PASSWORD_RECOVERY_MESSAGE,
} from 'src/services/auth/password-recovery.service';
import { PasswordRecoveryRateLimiter } from 'src/services/auth/password-recovery-rate-limiter';
import { User } from 'src/entities/users/users.entity';
import { PasswordRecoveryToken } from 'src/entities/auth/password-recovery.entity';
import { MailService } from 'src/services/mail/mail.service';
import type { TransactionalMail } from 'src/services/mail/mail.template';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';

describe('HU-AUTH-01 password recovery HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let recovery: PasswordRecoveryService;
  let records: PasswordRecoveryToken[];
  let attempts: Map<string, number>;
  let warnings: jest.SpyInstance;
  const user = { idUser: 7, email: 'ana@example.com', isActive: true, password: 'unchanged-hash' };
  const users = { findOne: jest.fn() };
  const tokens = {
    create: (value: Partial<PasswordRecoveryToken>) =>
      Object.assign(new PasswordRecoveryToken(), value),
    save: jest.fn((record: PasswordRecoveryToken) => {
      record.id = randomUUID();
      records.push(record);
      return Promise.resolve(record);
    }),
    delete: jest.fn(({ id }: { id?: string }) => {
      if (id) records = records.filter((record) => record.id !== id);
      return Promise.resolve({ affected: 1 });
    }),
  };
  const mail = { send: jest.fn<Promise<{ accepted: boolean }>, [TransactionalMail, string]>() };
  const limiter = { consume: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    records = [];
    attempts = new Map();
    users.findOne.mockImplementation(({ where }: { where: { email: string; isActive: boolean } }) =>
      Promise.resolve(where.email === user.email && where.isActive && user.isActive ? user : null),
    );
    mail.send.mockResolvedValue({ accepted: true });
    limiter.consume.mockImplementation((scope: string, maximum: number) => {
      const count = (attempts.get(scope) || 0) + 1;
      attempts.set(scope, count);
      return Promise.resolve(count <= maximum);
    });
    const module = await Test.createTestingModule({
      controllers: [PasswordRecoveryController],
      providers: [
        PasswordRecoveryService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(PasswordRecoveryToken), useValue: tokens },
        { provide: ConfigService, useValue: { get: () => 'https://medisur.example' } },
        { provide: MailService, useValue: mail },
        { provide: PasswordRecoveryRateLimiter, useValue: limiter },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    recovery = module.get(PasswordRecoveryService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
    user.isActive = true;
  });
  const post = (body: unknown) => request(server).post('/api/auth/forgot-password').send(body);

  it('is public, normalizes email, stores only a random token hash with 15-minute expiry, and sends via MailService', async () => {
    const start = Date.now();
    const response = await post({ email: ' ANA@EXAMPLE.COM ', roleNames: ['SUPERADMIN'] }).expect(
      200,
    );
    await recovery.onModuleDestroy();
    expect(response.body).toEqual({
      status: true,
      statusCode: 200,
      message: PASSWORD_RECOVERY_MESSAGE,
      data: null,
    });
    expect(records).toHaveLength(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const [message, id] = mail.send.mock.calls[0];
    expect(message.kind).toBe('password-reset');
    if (message.kind !== 'password-reset') throw new Error('Expected reset mail');
    const url = new URL(message.url);
    const token = url.searchParams.get('token')!;
    expect(url.origin).toBe('https://medisur.example');
    expect(url.pathname).toBe('/reset-password');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(records[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(records[0].tokenHash).not.toBe(token);
    expect(records[0].user.idUser).toBe(7);
    expect(records[0].expiresAt.getTime()).toBeGreaterThanOrEqual(start + 900000);
    expect(records[0].expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 900000);
    expect(id).toBe(records[0].id);
    expect(message.to).toBe(user.email);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(JSON.stringify(records)).not.toContain(token);
    expect(user.password).toBe('unchanged-hash');
    expect(warnings).not.toHaveBeenCalled();
  });

  it('returns exactly the same envelope for active, nonexistent and inactive accounts', async () => {
    const known = await post({ email: user.email }).expect(200);
    const absent = await post({ email: 'absent@example.com' }).expect(200);
    user.isActive = false;
    const inactive = await post({ email: user.email }).expect(200);
    await recovery.onModuleDestroy();
    expect(absent.body).toEqual(known.body);
    expect(inactive.body).toEqual(known.body);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    { email: '' },
    { email: 'invalid' },
    { email: 1 },
    { email: 'p@example.com\r\nBcc:other@example.com' },
    { email: `${'a'.repeat(255)}@example.com` },
  ])('validates input before querying accounts or sending', async (body) => {
    await post(body).expect(400);
    expect(users.findOne).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not wait for SMTP and drains pending delivery on shutdown', async () => {
    let complete!: (value: { accepted: boolean }) => void;
    mail.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const response = await post({ email: user.email }).expect(200);
    expect(response.body).toHaveProperty('message', PASSWORD_RECOVERY_MESSAGE);
    expect(mail.send).toHaveBeenCalledTimes(1);
    let finished = false;
    const shutdown = recovery.onModuleDestroy().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    complete({ accepted: true });
    await shutdown;
    expect(finished).toBe(true);
  });

  it.each(['rejected', 'throws'])(
    'removes a failed delivery token without revealing provider failure: %s',
    async (mode) => {
      if (mode === 'throws') mail.send.mockRejectedValue(new Error('smtp recipient secret'));
      else mail.send.mockResolvedValue({ accepted: false });
      await post({ email: user.email }).expect(200);
      await recovery.onModuleDestroy();
      expect(records).toHaveLength(0);
      expect(JSON.stringify(warnings.mock.calls)).not.toMatch(/smtp|recipient|secret|ana@example/);
    },
  );

  it('never sends a token that could not be persisted', async () => {
    tokens.save.mockRejectedValueOnce(new Error('database error secret'));
    await post({ email: user.email }).expect(200);
    await recovery.onModuleDestroy();
    expect(mail.send).not.toHaveBeenCalled();
    expect(records).toHaveLength(0);
  });

  it('creates independent cryptographically random tokens without invalidating previous links', async () => {
    await post({ email: user.email }).expect(200);
    await post({ email: user.email }).expect(200);
    await recovery.onModuleDestroy();
    expect(records).toHaveLength(2);
    expect(records[0].tokenHash).not.toBe(records[1].tokenHash);
  });

  it('silently suppresses more than three requests per normalized address, even across IPs', async () => {
    for (let i = 0; i < 4; i++) {
      await recovery.request(' ANA@example.com ', `client-${i}`);
    }
    await recovery.onModuleDestroy();
    expect(mail.send).toHaveBeenCalledTimes(3);
    expect(attempts.get('email:ana@example.com')).toBe(4);
  });

  it('limits a single IP to ten requests, including unknown accounts and spoofed forwarded headers', async () => {
    for (let i = 0; i < 10; i++) {
      await request(server)
        .post('/api/auth/forgot-password')
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .send({ email: `absent${i}@example.com` })
        .expect(200);
    }
    await post({ email: 'another@example.com' }).expect(429);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('fails closed if the limiter is unavailable, independently of account existence', async () => {
    limiter.consume.mockRejectedValue(new Error('database secret'));
    const known = await post({ email: user.email }).expect(503);
    const unknown = await post({ email: 'absent@example.com' }).expect(503);
    expect((unknown.body as { message: string }).message).toEqual(
      (known.body as { message: string }).message,
    );
    expect(users.findOne).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('bounds background work while the provider is stalled', async () => {
    limiter.consume.mockResolvedValue(true);
    const completions: ((value: { accepted: boolean }) => void)[] = [];
    mail.send.mockImplementation(() => new Promise((resolve) => completions.push(resolve)));
    try {
      for (let i = 0; i < 20; i++) await post({ email: user.email }).expect(200);
      await post({ email: 'absent@example.com' }).expect(429);
    } finally {
      completions.forEach((complete) => complete({ accepted: true }));
    }
    await recovery.onModuleDestroy();
    expect(mail.send).toHaveBeenCalledTimes(20);
  });
});
