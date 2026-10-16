import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { runMailTest } from './mail-test';
import { MailService } from './services/mail/mail.service';

describe('mail:test', () => {
  const send = jest.fn();
  const close = jest.fn();
  const get = jest.fn((token: unknown) => (token === ConfigService ? config : { send }));
  let config: ConfigService;
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ accepted: true });
    close.mockReset().mockResolvedValue(undefined);
    get.mockClear();
    config = new ConfigService();
    config.set('MAIL_TEST_TO', 'recipient@example.com');
    jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue({
      get,
      close,
    } as never);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it('sends through MailService and closes the application context', async () => {
    await runMailTest();
    expect(get).toHaveBeenCalledWith(MailService);
    expect(send).toHaveBeenCalledWith({ kind: 'test', to: 'recipient@example.com' });
    expect(console.log).toHaveBeenCalledWith('Correo de prueba aceptado por el proveedor');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('reports controlled failures and still closes the context', async () => {
    send.mockResolvedValueOnce({ accepted: false, reason: 'provider-error' });
    await expect(runMailTest()).rejects.toThrow('provider-error');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('requires MAIL_TEST_TO without calling send and closes the context', async () => {
    config.set('MAIL_TEST_TO', '');
    await expect(runMailTest()).rejects.toThrow('MAIL_TEST_TO');
    expect(send).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
