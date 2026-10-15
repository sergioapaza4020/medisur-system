import { randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { GmailSmtpMailProvider } from './gmail-mail.provider';
import { MailModule } from 'src/modules/mail/mail.module';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('Gmail SMTP App Password mail provider', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  let config: ConfigService;
  let originalEnvironment: NodeJS.ProcessEnv;
  let log: jest.SpyInstance;
  const message = {
    to: 'patient@example.com',
    subject: 'MEDISUR test',
    html: '<p>Test</p>',
    text: 'Test',
  };
  beforeEach(() => {
    originalEnvironment = { ...process.env };
    jest.clearAllMocks();
    config = new ConfigService();
    for (const [key, value] of Object.entries({
      MAIL_PROVIDER: 'gmail-smtp',
      MAIL_GMAIL_USER: 'medisur@gmail.com',
      MAIL_GMAIL_APP_PASSWORD: randomBytes(16).toString('hex'),
      MAIL_TIMEOUT_MS: '10000',
      MAIL_FROM_EMAIL: 'medisur@gmail.com',
      MAIL_FROM_NAME: 'MEDISUR',
    }))
      config.set(key, value);
    jest.mocked(createTransport).mockReturnValue({ sendMail, close } as never);
    sendMail
      .mockReset()
      .mockResolvedValue({ accepted: [message.to], rejected: [], messageId: 'smtp-id' });
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  it('configures secure SMTP with the configured user and private App Password', () => {
    new GmailSmtpMailProvider(config);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'medisur@gmail.com',
        pass: config.get<string>('MAIL_GMAIL_APP_PASSWORD'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      dnsTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  });
  it('accepts Google presentation spaces without changing the credential characters', () => {
    const password = randomBytes(8).toString('hex');
    config.set('MAIL_GMAIL_APP_PASSWORD', password.match(/.{4}/g)?.join(' '));
    new GmailSmtpMailProvider(config);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'medisur@gmail.com', pass: password },
      }),
    );
  });
  it('keeps templates intact, forces the authenticated sender and supports repeated sends', async () => {
    const provider = new GmailSmtpMailProvider(config);
    expect(await provider.send(message, 'operation-1')).toEqual({ accepted: true });
    expect(await provider.send(message, 'operation-2')).toEqual({ accepted: true });
    expect(sendMail).toHaveBeenNthCalledWith(1, {
      ...message,
      from: { name: 'MEDISUR', address: 'medisur@gmail.com' },
      messageId: '<operation-1@gmail.com>',
    });
    expect(createTransport).toHaveBeenCalledTimes(1);
    provider.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('uses the configured display name and defaults to MEDISUR when omitted', async () => {
    config.set('MAIL_FROM_NAME', 'Centro MEDISUR');
    await new GmailSmtpMailProvider(config).send(message, 'op');
    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: { name: 'Centro MEDISUR', address: 'medisur@gmail.com' },
      }),
    );
    config.set('MAIL_FROM_NAME', '');
    await new GmailSmtpMailProvider(config).send(message, 'op');
    expect(sendMail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: { name: 'MEDISUR', address: 'medisur@gmail.com' },
      }),
    );
  });
  it.each(['MAIL_PROVIDER', 'MAIL_GMAIL_USER', 'MAIL_GMAIL_APP_PASSWORD', 'MAIL_FROM_EMAIL'])(
    'rejects missing %s at initialization',
    (key) => {
      config.set(key, '');
      expect(() => new GmailSmtpMailProvider(config)).toThrow(key);
      expect(createTransport).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['MAIL_PROVIDER', 'other'],
    ['MAIL_GMAIL_USER', 'invalid'],
    ['MAIL_GMAIL_APP_PASSWORD', 'invalid\nvalue'],
    ['MAIL_FROM_EMAIL', 'other@example.com'],
    ['MAIL_FROM_EMAIL', 'invalid'],
    ['MAIL_FROM_NAME', 'name\r\nBcc: other@example.com'],
    ['MAIL_TIMEOUT_MS', '0'],
    ['MAIL_TIMEOUT_MS', '30001'],
    ['MAIL_TIMEOUT_MS', 'text'],
  ])('rejects invalid %s without revealing its value', (key, value) => {
    config.set(key, value);
    expect(() => new GmailSmtpMailProvider(config)).toThrow(
      `Configuración de correo inválida: ${key}`,
    );
    expect(createTransport).not.toHaveBeenCalled();
  });
  it('uses the default timeout and refuses to initialize a misconfigured Nest module', async () => {
    config.set('MAIL_TIMEOUT_MS', '');
    new GmailSmtpMailProvider(config);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ socketTimeout: 10000 }));
    config.set('MAIL_GMAIL_APP_PASSWORD', '');
    await expect(
      Test.createTestingModule({ imports: [MailModule] })
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile(),
    ).rejects.toThrow('MAIL_GMAIL_APP_PASSWORD');
  });
  it.each(['EAUTH', 'ETIMEDOUT', 'ECONNECTION'])(
    'logs safe diagnostics for %s and returns a controlled failure',
    async (code) => {
      sendMail.mockRejectedValue({
        code,
        responseCode: 535,
        command: 'AUTH LOGIN',
        message: config.get<string>('MAIL_GMAIL_APP_PASSWORD'),
        response: 'sensitive',
      });
      expect(await new GmailSmtpMailProvider(config).send(message, 'operation-1')).toEqual({
        accepted: false,
        reason: 'provider-error',
      });
      expect(log).toHaveBeenCalledWith({
        message: 'Falló el envío SMTP de Gmail',
        code,
        responseCode: 535,
        command: 'AUTH LOGIN',
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        config.get<string>('MAIL_GMAIL_APP_PASSWORD'),
      );
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /untrusted-provider-detail|patient@example|sensitive/,
      );
    },
  );
  it('does not log arbitrary diagnostic strings or assume acceptance for an invalid SMTP result', async () => {
    sendMail
      .mockRejectedValueOnce({
        code: 'secret',
        command: 'AUTH secret',
        responseCode: 'token',
        message: 'secret',
      })
      .mockResolvedValueOnce({ accepted: [], rejected: [message.to] });
    const provider = new GmailSmtpMailProvider(config);
    expect(await provider.send(message, 'op')).toEqual({
      accepted: false,
      reason: 'provider-error',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    expect(await provider.send(message, 'op')).toEqual({
      accepted: false,
      reason: 'provider-error',
    });
  });
});
