import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from '../users/users.entity';

@Entity('password_recovery_tokens')
export class PasswordRecoveryToken {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Exclude()
  @Index('UQ_password_recovery_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  @Index('IDX_password_recovery_user')
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_user' })
  user: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index('IDX_password_recovery_expiration')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}

@Entity('password_recovery_rate_limits')
export class PasswordRecoveryRateLimit {
  @Column({ name: 'scope_hash', type: 'varchar', length: 64, primary: true })
  scopeHash: string;

  @Column({ type: 'integer' })
  attempts: number;

  @Index('IDX_password_recovery_rate_expiration')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
