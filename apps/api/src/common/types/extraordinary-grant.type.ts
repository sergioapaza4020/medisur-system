import { ExtraordinaryGrantType } from 'src/entities/medical-records/extraordinary-grant.entity';
export interface ExtraordinaryGrantView {
  idGrant: number;
  patient: { idUser: number; name: string; lastname: string; ci: string };
  beneficiary: { idUser: number; name: string; lastname: string };
  type: ExtraordinaryGrantType;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
  state: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}
