import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { PasswordRecoveryRateLimit } from 'src/entities/auth/password-recovery.entity';

@Injectable()
export class PasswordRecoveryRateLimiter {
  constructor(
    @InjectRepository(PasswordRecoveryRateLimit)
    private readonly limits: Repository<PasswordRecoveryRateLimit>,
  ) {}

  async consume(scope: string, maximum: number): Promise<boolean> {
    const hash = createHash('sha256').update(scope).digest('hex');
    // Indexed expiry cleanup and atomic UPSERT keep limits shared across API instances.
    await this.limits.query('DELETE FROM password_recovery_rate_limits WHERE expires_at < now()');
    const rows = await this.limits.query<{ attempts: number }[]>(
      `INSERT INTO password_recovery_rate_limits (scope_hash, attempts, expires_at)
       VALUES ($1, 1, now() + interval '15 minutes')
       ON CONFLICT (scope_hash) DO UPDATE SET
         attempts = CASE WHEN password_recovery_rate_limits.expires_at <= now() THEN 1
           ELSE LEAST(password_recovery_rate_limits.attempts + 1, $2 + 1) END,
         expires_at = CASE WHEN password_recovery_rate_limits.expires_at <= now()
           THEN now() + interval '15 minutes' ELSE password_recovery_rate_limits.expires_at END
       RETURNING attempts`,
      [hash, maximum],
    );
    return rows.length === 1 && rows[0].attempts <= maximum;
  }
}
