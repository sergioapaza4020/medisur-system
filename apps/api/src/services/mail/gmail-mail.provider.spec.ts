import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { GmailMailProvider } from './gmail-mail.provider';
import { MailModule } from 'src/modules/mail/mail.module';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('Gmail OAuth2 mail provider', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  let config: ConfigService;
  let log: jest.SpyInstance;
  const message = {
    to: 'patient@example.com',
    subject: 'MEDISUR test',
    html: '<p>Test</p>',
    text: 'Test',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    config = new ConfigService();
    for (const [key, value] of Object.entries({
      MAIL_PROVIDER: 'gmail',
      MAIL_GMAIL_USER: 'medisur@gmail.com',
      MAIL_GOOGLE_CLIENT_ID: 'test-client',
      MAIL_GOOGLE_CLIENT_SECRET: 'test-secret',
      MAIL_GOOGLE_REFRESH_TOKEN: 'test-refresh',
      MAIL_TIMEOUT_MS: '10000',
      MAIL_FROM_EMAIL: 'ignored@example.com',
    }))
      config.set(key, value);
    jest.mocked(createTransport).mockReturnValue({ sendMail, close } as never);
    sendMail
      .mockReset()
      .mockResolvedValue({ accepted: [message.to], rejected: [], messageId: 'smtp-id' });
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('configures secure SMTP and renewable OAuth2 without password or static access token', () => {
    new GmailMailProvider(config);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: 'medisur@gmail.com',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        refreshToken: 'test-refresh',
        requestTimeout: 10000,
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
  it('keeps templates intact, forces the authenticated sender and supports repeated sends', async () => {
    const provider = new GmailMailProvider(config);
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
  it.each([
    'MAIL_PROVIDER',
    'MAIL_GMAIL_USER',
    'MAIL_GOOGLE_CLIENT_ID',
    'MAIL_GOOGLE_CLIENT_SECRET',
    'MAIL_GOOGLE_REFRESH_TOKEN',
  ])('rejects missing %s at initialization', (key) => {
    config.set(key, '');
    expect(() => new GmailMailProvider(config)).toThrow(key);
    expect(createTransport).not.toHaveBeenCalled();
  });
  it.each([
    ['MAIL_PROVIDER', 'other'],
    ['MAIL_GMAIL_USER', 'invalid'],
    ['MAIL_GOOGLE_CLIENT_SECRET', 'secret\nvalue'],
    ['MAIL_TIMEOUT_MS', '0'],
    ['MAIL_TIMEOUT_MS', '30001'],
    ['MAIL_TIMEOUT_MS', 'text'],
  ])('rejects invalid %s without revealing its value', (key, value) => {
    config.set(key, value);
    expect(() => new GmailMailProvider(config)).toThrow(`Configuración de correo inválida: ${key}`);
    expect(createTransport).not.toHaveBeenCalled();
  });
  it('uses the default timeout and refuses to initialize a misconfigured Nest module', async () => {
    config.set('MAIL_TIMEOUT_MS', '');
    new GmailMailProvider(config);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ socketTimeout: 10000 }));
    config.set('MAIL_GOOGLE_REFRESH_TOKEN', '');
    await expect(
      Test.createTestingModule({ imports: [MailModule] })
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile(),
    ).rejects.toThrow('MAIL_GOOGLE_REFRESH_TOKEN');
  });
  it.each(['EAUTH', 'ETIMEDOUT', 'ECONNECTION'])(
    'logs safe diagnostics for %s and returns a controlled failure',
    async (code) => {
      sendMail.mockRejectedValue({
        code,
        responseCode: 535,
        command: 'AUTH XOAUTH2',
        message: 'test-secret test-refresh access-token patient@example.com',
        response: 'sensitive',
      });
      expect(await new GmailMailProvider(config).send(message, 'operation-1')).toEqual({
        accepted: false,
        reason: 'provider-error',
      });
      expect(log).toHaveBeenCalledWith({
        message: 'Falló el envío SMTP/OAuth2 de Gmail',
        code,
        responseCode: 535,
        command: 'AUTH XOAUTH2',
      });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /test-secret|test-refresh|access-token|patient@example|sensitive/,
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
    const provider = new GmailMailProvider(config);
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
