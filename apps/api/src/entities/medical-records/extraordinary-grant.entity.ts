import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';

export enum ExtraordinaryGrantType {
  AUTHORIZATION = 'AUTHORIZATION',
  EMERGENCY = 'EMERGENCY',
}

@Entity('extraordinary_grants')
@Check('CHK_extraordinary_grant_type', "type IN ('AUTHORIZATION', 'EMERGENCY')")
@Check('CHK_extraordinary_grant_no_self', 'id_beneficiary <> created_by')
@Check('CHK_extraordinary_grant_reason', 'length(btrim(reason)) BETWEEN 10 AND 1000')
@Check(
  'CHK_extraordinary_grant_expiry',
  "expires_at > created_at AND expires_at <= created_at + interval '24 hours'",
)
@Check(
  'CHK_extraordinary_grant_revocation',
  '(revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL AND length(btrim(revocation_reason)) BETWEEN 10 AND 1000)',
)
export class ExtraordinaryGrant {
  @PrimaryGeneratedColumn({ name: 'id_grant' }) idGrant: number;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_patient' })
  patient: User;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_beneficiary' })
  beneficiary: User;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
  @Column({ type: 'varchar', length: 20 }) type: ExtraordinaryGrantType;
  @Column({ type: 'varchar', length: 1000 }) reason: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revoked_by' })
  revokedBy: User | null;
  @Column({ name: 'revocation_reason', type: 'varchar', length: 1000, nullable: true })
  revocationReason: string | null;
}
