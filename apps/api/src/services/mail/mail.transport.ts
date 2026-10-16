export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult =
  | { accepted: true }
  | { accepted: false; reason: 'not-configured' | 'invalid-input' | 'provider-error' };

export abstract class MailTransport {
  abstract send(message: MailMessage, idempotencyKey: string): Promise<MailResult>;
}
