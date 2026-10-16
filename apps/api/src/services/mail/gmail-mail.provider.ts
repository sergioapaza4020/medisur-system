import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter, SMTPSentMessageInfo } from 'nodemailer';
import { MailTransport } from './mail.transport';
import type { MailMessage, MailResult } from './mail.transport';
import { gmailMailConfig } from './mail.config';

@Injectable()
export class GmailSmtpMailProvider extends MailTransport implements OnModuleDestroy {
  private readonly logger = new Logger(GmailSmtpMailProvider.name);
  private readonly transporter: Transporter<SMTPSentMessageInfo>;
  private readonly user: string;
  private readonly from: { name: string; address: string };

  constructor(config: ConfigService) {
    super();
    const { user, appPassword, fromEmail, fromName, timeout } = gmailMailConfig(config);
    this.user = user;
    this.from = { name: fromName, address: fromEmail };
    this.transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: appPassword },
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
      dnsTimeout: timeout,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async send(message: MailMessage, idempotencyKey: string): Promise<MailResult> {
    try {
      const info = await this.transporter.sendMail({
        ...message,
        from: this.from,
        // SMTP Message-ID supports tracing; it does not guarantee deduplication.
        messageId: `<${idempotencyKey}@${this.user.split('@')[1]}>`,
      });
      if (info.accepted?.includes(message.to) && !info.rejected?.length) return { accepted: true };
      this.logger.warn('Gmail no aceptó el destinatario del correo transaccional');
      return { accepted: false, reason: 'provider-error' };
    } catch (error: unknown) {
      const details = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
      const codes = [
        'EAUTH',
        'ECONNECTION',
        'ETIMEDOUT',
        'ESOCKET',
        'EDNS',
        'EENVELOPE',
        'EMESSAGE',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
      ];
      const commands = [
        'CONN',
        'EHLO',
        'HELO',
        'STARTTLS',
        'AUTH LOGIN',
        'AUTH PLAIN',
        'AUTH',
        'MAIL FROM',
        'RCPT TO',
        'DATA',
      ];
      this.logger.error({
        message: 'Falló el envío SMTP de Gmail',
        code:
          typeof details.code === 'string' && codes.includes(details.code)
            ? details.code
            : 'UNKNOWN',
        responseCode:
          typeof details.responseCode === 'number' &&
          Number.isInteger(details.responseCode) &&
          details.responseCode >= 100 &&
          details.responseCode <= 599
            ? details.responseCode
            : undefined,
        command:
          typeof details.command === 'string' && commands.includes(details.command)
            ? details.command
            : undefined,
      });
      return { accepted: false, reason: 'provider-error' };
    }
  }

  onModuleDestroy() {
    this.transporter.close();
  }
}
