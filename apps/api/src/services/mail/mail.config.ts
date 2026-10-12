import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';

export class MailConfigurationError extends Error {}

export function gmailMailConfig(config: ConfigService) {
  const required = (key: string) => {
    const value = config.get<string>(key)?.trim();
    if (!value || /\s/.test(value))
      throw new MailConfigurationError(`Configuración de correo inválida: ${key}`);
    return value;
  };
  if (required('MAIL_PROVIDER') !== 'gmail')
    throw new MailConfigurationError(
      'Configuración de correo inválida: MAIL_PROVIDER (se requiere gmail)',
    );
  const user = required('MAIL_GMAIL_USER');
  if (!isEmail(user) || user.length > 254)
    throw new MailConfigurationError('Configuración de correo inválida: MAIL_GMAIL_USER');
  const clientId = required('MAIL_GOOGLE_CLIENT_ID');
  const clientSecret = required('MAIL_GOOGLE_CLIENT_SECRET');
  const refreshToken = required('MAIL_GOOGLE_REFRESH_TOKEN');
  const timeout = Number(config.get<string>('MAIL_TIMEOUT_MS') || '10000');
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000)
    throw new MailConfigurationError(
      'Configuración de correo inválida: MAIL_TIMEOUT_MS (1000-30000)',
    );
  return { user, clientId, clientSecret, refreshToken, timeout };
}
