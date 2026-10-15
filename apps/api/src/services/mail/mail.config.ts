import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';

export class MailConfigurationError extends Error {}

export function gmailMailConfig(config: ConfigService) {
  const required = (key: string, removePresentationSpaces = false) => {
    const raw = config.get<string>(key)?.trim();
    const value = removePresentationSpaces ? raw?.replace(/ /g, '') : raw;
    if (!value || /\s/.test(value))
      throw new MailConfigurationError(`Configuración de correo inválida: ${key}`);
    return value;
  };
  if (required('MAIL_PROVIDER') !== 'gmail-smtp')
    throw new MailConfigurationError(
      'Configuración de correo inválida: MAIL_PROVIDER (se requiere gmail-smtp)',
    );
  const user = required('MAIL_GMAIL_USER');
  if (!isEmail(user) || user.length > 254)
    throw new MailConfigurationError('Configuración de correo inválida: MAIL_GMAIL_USER');
  const appPassword = required('MAIL_GMAIL_APP_PASSWORD', true);
  const fromEmail = required('MAIL_FROM_EMAIL');
  if (!isEmail(fromEmail) || fromEmail.toLowerCase() !== user.toLowerCase())
    throw new MailConfigurationError(
      'Configuración de correo inválida: MAIL_FROM_EMAIL (debe coincidir con MAIL_GMAIL_USER)',
    );
  const fromName = config.get<string>('MAIL_FROM_NAME')?.trim() || 'MEDISUR';
  if (/[\r\n]/.test(fromName))
    throw new MailConfigurationError('Configuración de correo inválida: MAIL_FROM_NAME');
  const timeout = Number(config.get<string>('MAIL_TIMEOUT_MS') || '10000');
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000)
    throw new MailConfigurationError(
      'Configuración de correo inválida: MAIL_TIMEOUT_MS (1000-30000)',
    );
  return { user, appPassword, fromEmail, fromName, timeout };
}
