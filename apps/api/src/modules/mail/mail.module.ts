import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from 'src/services/mail/mail.service';
import { MailTransport } from 'src/services/mail/mail.transport';
import { GmailMailProvider } from 'src/services/mail/gmail-mail.provider';

@Module({
  imports: [ConfigModule],
  providers: [MailService, { provide: MailTransport, useClass: GmailMailProvider }],
  exports: [MailService],
})
export class MailModule {}
