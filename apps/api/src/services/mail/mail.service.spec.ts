import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from 'src/modules/mail/mail.module';
import { MailService } from './mail.service';
import { MailTransport } from './mail.transport';
import { renderMail } from './mail.template';
import type { TransactionalMail } from './mail.template';

describe('Transactional mail', () => {
  const send = jest.fn();
  let service: MailService;
  let warning: jest.SpyInstance;
  let config: ConfigService;
  let originalEnvironment: NodeJS.ProcessEnv;
  beforeEach(() => {
    originalEnvironment = { ...process.env };
    send.mockReset().mockResolvedValue({ accepted: true });
    config = new ConfigService({ FRONTEND_URL: 'https://medisur.example', NODE_ENV: 'production' });
    config.set('FRONTEND_URL', 'https://medisur.example');
    config.set('NODE_ENV', 'production');
    service = new MailService({ send }, config);
    warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  it('can be resolved by an importing module without database or credentials', async () => {
    const module = await Test.createTestingModule({ imports: [ConfigModule, MailModule] })
      .overrideProvider(MailTransport)
      .useValue({ send })
      .compile();
    expect(await module.get(MailService).send({ kind: 'test', to: 'patient@example.com' })).toEqual(
      {
        accepted: true,
      },
    );
    await module.close();
  });

  it.each<TransactionalMail>([
    { kind: 'test', to: 'patient@example.com' },
    {
      kind: 'password-reset',
      to: 'patient@example.com',
      url: 'https://medisur.example/reset?token=secret&next=home',
      expiresInMinutes: 15,
    },
    {
      kind: 'login-link',
      to: 'patient@example.com',
      url: 'https://medisur.example/login?token=secret',
      expiresInMinutes: 5,
    },
    { kind: 'login-code', to: 'patient@example.com', code: '012345', expiresInMinutes: 5 },
  ])('renders and sends the $kind template with HTML and text', async (input) => {
    expect(await service.send(input, 'operation-123')).toEqual({ accepted: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: input.to,
        subject: expect.stringContaining('MEDISUR') as unknown,
        html: expect.stringContaining('<h1>MEDISUR</h1>') as unknown,
        text: expect.stringContaining('MEDISUR') as unknown,
      }),
      'operation-123',
    );
    expect(warning).not.toHaveBeenCalled();
  });

  it('renders the SMTP test message with the expected subject and content', () => {
    const mail = renderMail({ kind: 'test', to: 'patient@example.com' });
    expect(mail.subject).toBe('Prueba de correo MEDISUR');
    const content =
      'El servicio de correo transaccional de MEDISUR está configurado correctamente.';
    expect(mail.text).toContain(content);
    expect(mail.html).toContain(content);
  });
  it('escapes values in HTML while preserving the plain text link', () => {
    const url = 'https://medisur.example/reset?token=a&value="<script>"';
    const mail = renderMail({
      kind: 'password-reset',
      to: 'p@example.com',
      url,
      expiresInMinutes: 15,
    });
    expect(mail.html).toContain('&amp;value=&quot;&lt;script&gt;&quot;');
    expect(mail.html).not.toContain('<script>');
    expect(mail.text).toContain(url);
  });

  it.each([
    'https://evil.example/reset?token=secret',
    'https://medisur.example.evil.example/reset',
    'javascript:alert(1)',
    'http://medisur.example/reset',
    'https://user:password@medisur.example/reset',
  ])('rejects unsafe links without invoking the provider: %s', async (url) => {
    expect(
      await service.send({ kind: 'password-reset', to: 'p@example.com', url, expiresInMinutes: 5 }),
    ).toEqual({ accepted: false, reason: 'invalid-input' });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 1441, Number.NaN])(
    'rejects invalid expiration %s',
    async (expiresInMinutes) => {
      expect(
        await service.send({
          kind: 'login-code',
          to: 'p@example.com',
          code: '123456',
          expiresInMinutes,
        }),
      ).toEqual({ accepted: false, reason: 'invalid-input' });
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each(['123', '<script>', '12\n3456'])('rejects invalid codes', async (code) => {
    expect(
      await service.send({ kind: 'login-code', to: 'p@example.com', code, expiresInMinutes: 5 }),
    ).toEqual({ accepted: false, reason: 'invalid-input' });
  });

  it('rejects malformed recipients and idempotency keys', async () => {
    expect(
      await service.send({ kind: 'test', to: 'p@example.com\r\nBcc: victim@example.com' }),
    ).toEqual({ accepted: false, reason: 'invalid-input' });
    expect(await service.send({ kind: 'test', to: 'p@example.com' }, 'key\r\nheader')).toEqual({
      accepted: false,
      reason: 'invalid-input',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('allows localhost HTTP in development, but not production', async () => {
    config.set('FRONTEND_URL', 'http://localhost:3000');
    const input: TransactionalMail = {
      kind: 'login-link',
      to: 'p@example.com',
      url: 'http://localhost:3000/login?token=secret',
      expiresInMinutes: 5,
    };
    expect(await service.send(input)).toEqual({ accepted: false, reason: 'invalid-input' });
    config.set('NODE_ENV', 'development');
    expect(await service.send(input)).toEqual({ accepted: true });
  });

  it('fails safely when the frontend origin is missing', async () => {
    config.set('FRONTEND_URL', '');
    expect(
      await service.send({
        kind: 'login-link',
        to: 'p@example.com',
        url: 'https://medisur.example/login',
        expiresInMinutes: 5,
      }),
    ).toEqual({ accepted: false, reason: 'invalid-input' });
  });

  it('returns a controlled result and logs no provider details or token on failure', async () => {
    send.mockRejectedValue(new Error('key-secret patient@example.com token-secret'));
    expect(
      await service.send({
        kind: 'login-code',
        to: 'patient@example.com',
        code: '123456',
        expiresInMinutes: 5,
      }),
    ).toEqual({ accepted: false, reason: 'provider-error' });
    expect(warning.mock.calls).toEqual([['No se pudo aceptar un correo transaccional']]);
  });
});
