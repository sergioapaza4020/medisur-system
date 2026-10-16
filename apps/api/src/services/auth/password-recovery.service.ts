import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { PasswordRecoveryToken } from 'src/entities/auth/password-recovery.entity';
import { User } from 'src/entities/users/users.entity';
import { MailService } from '../mail/mail.service';
import { PasswordRecoveryRateLimiter } from './password-recovery-rate-limiter';

export const PASSWORD_RECOVERY_MESSAGE =
  'Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.';

@Injectable()
export class PasswordRecoveryService implements OnModuleDestroy {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  private readonly pending = new Set<Promise<void>>();
  private stopping = false;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordRecoveryToken)
    private readonly tokens: Repository<PasswordRecoveryToken>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly limiter: PasswordRecoveryRateLimiter,
  ) {}

  async request(email: string, ip: string): Promise<void> {
    email = email.trim().toLowerCase();
    let ipAllowed: boolean;
    let emailAllowed: boolean;
    try {
      ipAllowed = await this.limiter.consume(`ip:${ip}`, 10);
      if (!ipAllowed)
        throw new HttpException(
          'Demasiadas solicitudes. Inténtalo más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      emailAllowed = await this.limiter.consume(`email:${email}`, 3);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn('No se pudo comprobar el límite de recuperación');
      throw new ServiceUnavailableException(
        'No se pudo procesar la solicitud. Inténtalo más tarde.',
      );
    }
    // Account throttling is deliberately indistinguishable from a successful request.
    if (!emailAllowed) return;
    if (this.stopping || this.pending.size >= 20) {
      throw new HttpException(
        'Demasiadas solicitudes. Inténtalo más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Respond before account lookup/SMTP so their timing cannot disclose account existence.
    const task = this.deliver(email).catch(() => {
      this.logger.warn('No se pudo procesar un correo de recuperación');
    });
    this.pending.add(task);
    void task.then(() => this.pending.delete(task));
  }

  private async deliver(email: string): Promise<void> {
    const user = await this.users.findOne({
      where: { email, isActive: true },
      select: { idUser: true, email: true },
    });
    if (!user) return;
    const url = new URL('/reset-password', this.config.get<string>('FRONTEND_URL') || '');
    const token = randomBytes(32).toString('hex');
    url.searchParams.set('token', token);
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
    const record = await this.tokens.save(
      this.tokens.create({
        id: randomUUID(),
        user: { idUser: user.idUser },
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }),
    );
    try {
      const result = await this.mail.send(
        { kind: 'password-reset', to: user.email, url: url.toString(), expiresInMinutes: 15 },
        record.id,
      );
      if (!result.accepted) await this.tokens.delete({ id: record.id });
    } catch {
      await this.tokens.delete({ id: record.id });
      this.logger.warn('No se pudo enviar un correo de recuperación');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await Promise.all(this.pending);
  }
}
