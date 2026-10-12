import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { MailModule } from './modules/mail/mail.module';
import { MailService } from './services/mail/mail.service';
import { MailConfigurationError } from './services/mail/mail.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '..', '.env') }),
    MailModule,
  ],
})
class MailTestModule {}

export async function runMailTest() {
  const app = await NestFactory.createApplicationContext(MailTestModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    const to = app.get(ConfigService).get<string>('MAIL_TEST_TO');
    if (!to) throw new MailConfigurationError('Configuración de correo inválida: MAIL_TEST_TO');
    const result = await app.get(MailService).send({ kind: 'test', to });
    if (!result.accepted)
      throw new MailConfigurationError(
        `Correo no aceptado: ${result.reason}. Revisa los códigos técnicos del provider en el log.`,
      );
    console.log('Correo de prueba aceptado por el proveedor');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void runMailTest().catch((error: unknown) => {
    console.error(
      error instanceof MailConfigurationError
        ? error.message
        : 'No se pudo enviar el correo de prueba. Revisa la configuración del backend.',
    );
    process.exitCode = 1;
  });
}
