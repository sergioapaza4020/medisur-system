import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from 'src/services/mail/mail.service';
import { MailTransport } from 'src/services/mail/mail.transport';
import { GmailSmtpMailProvider } from 'src/services/mail/gmail-mail.provider';

@Module({
  imports: [ConfigModule],
  providers: [MailService, { provide: MailTransport, useClass: GmailSmtpMailProvider }],
  exports: [MailService],
})
export class MailModule {}
