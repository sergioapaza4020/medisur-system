import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { isEmail } from 'class-validator';
import { MailTransport } from './mail.transport';
import type { MailResult } from './mail.transport';
import { renderMail } from './mail.template';
import type { TransactionalMail } from './mail.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly transport: MailTransport,
    private readonly config: ConfigService,
  ) {}

  async send(input: TransactionalMail, idempotencyKey: string = randomUUID()): Promise<MailResult> {
    if (!this.validInput(input) || !/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey)) {
      return { accepted: false, reason: 'invalid-input' };
    }
    let result: MailResult;
    try {
      result = await this.transport.send({ to: input.to, ...renderMail(input) }, idempotencyKey);
    } catch {
      result = { accepted: false, reason: 'provider-error' };
    }
    if (!result.accepted) this.logger.warn('No se pudo aceptar un correo transaccional');
    return result;
  }

  private validInput(input: TransactionalMail): boolean {
    if (!isEmail(input.to) || input.to.length > 254 || /[\r\n]/.test(input.to)) return false;
    if (input.kind === 'test') return true;
    if (
      !Number.isInteger(input.expiresInMinutes) ||
      input.expiresInMinutes < 1 ||
      input.expiresInMinutes > 1440
    )
      return false;
    if (input.kind === 'login-code') return /^[0-9]{6,10}$/.test(input.code);
    if (input.kind !== 'login-link' && input.kind !== 'password-reset') return false;
    try {
      const url = new URL(input.url);
      const frontend = new URL(this.config.get<string>('FRONTEND_URL') || '');
      const localDevelopment =
        this.config.get<string>('NODE_ENV') !== 'production' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      return (
        input.url.length <= 4096 &&
        url.origin === frontend.origin &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && localDevelopment)) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }
}
