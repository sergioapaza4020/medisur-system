import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { PasswordRecoveryToken } from 'src/entities/auth/password-recovery.entity';
import { User } from 'src/entities/users/users.entity';
import { hashPassword } from 'src/database/utils/password.util';
import { INVALID_RECOVERY_TOKEN_MESSAGE, ResetPasswordDto } from 'src/dtos/auth/reset-password.dto';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordRecoveryRateLimiter } from './password-recovery-rate-limiter';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordRecoveryToken)
    private readonly tokens: Repository<PasswordRecoveryToken>,
    private readonly dataSource: DataSource,
    private readonly sessions: SessionsService,
    private readonly limiter: PasswordRecoveryRateLimiter,
  ) {}

  async checkRate(ip: string): Promise<void> {
    let allowed: boolean;
    try {
      allowed = await this.limiter.consume(`password-reset:ip:${ip}`, 30);
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo procesar la solicitud. Inténtalo más tarde.',
      );
    }
    if (!allowed)
      throw new HttpException(
        'Demasiadas solicitudes. Inténtalo más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  private async lookup(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new BadRequestException(INVALID_RECOVERY_TOKEN_MESSAGE);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.tokens.findOne({
      where: { tokenHash, expiresAt: MoreThan(new Date()), user: { isActive: true } },
      relations: { user: true },
    });
    if (!record) throw new BadRequestException(INVALID_RECOVERY_TOKEN_MESSAGE);
    return { record, tokenHash };
  }

  async validate(token: string): Promise<void> {
    await this.lookup(token);
  }

  async reset(dto: ResetPasswordDto): Promise<void> {
    if (dto.password !== dto.confirmPassword)
      throw new BadRequestException('Las contraseñas deben coincidir');
    const { record: candidate, tokenHash } = await this.lookup(dto.token);
    // Hash before acquiring locks; all authorization conditions are checked again inside the transaction.
    const password = await hashPassword(dto.password);
    await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      // Serialize resets for the same account, including requests using different recovery links.
      const user = await users.findOne({
        where: { idUser: candidate.user.idUser, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new BadRequestException(INVALID_RECOVERY_TOKEN_MESSAGE);
      const tokens = manager.getRepository(PasswordRecoveryToken);
      const current = await tokens.findOne({
        where: { id: candidate.id, tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current || current.expiresAt <= new Date())
        throw new BadRequestException(INVALID_RECOVERY_TOKEN_MESSAGE);
      await users.update({ idUser: user.idUser }, { password, updatedBy: user.idUser });
      await this.sessions.revokeForPasswordChange(user.idUser, manager);
      // All existing recovery links become invalid, not just the submitted token.
      await tokens.delete({ user: { idUser: user.idUser } });
    });
  }
}
