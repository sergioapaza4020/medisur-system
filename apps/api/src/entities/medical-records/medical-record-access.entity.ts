import {
  Check,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Doctor } from '../doctors/doctors.entity';
import { Appointment } from '../appointments/appointment.entity';
import { MedicalRecord } from './medical-record.entity';
import { ExtraordinaryGrant } from './extraordinary-grant.entity';

// Append-only clinical access context for the future transversal audit module.
@Entity('medical_record_accesses')
@Check(
  'CHK_medical_record_access_basis',
  '(id_appointment IS NOT NULL AND id_extraordinary_grant IS NULL) OR (id_appointment IS NULL AND id_extraordinary_grant IS NOT NULL)',
)
export class MedicalRecordAccess {
  @PrimaryGeneratedColumn({ name: 'id_access' })
  idAccess: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_actor' })
  actor: User;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_patient' })
  patient: User;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_doctor' })
  doctor: Doctor;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_appointment' })
  appointment: Appointment | null;

  @ManyToOne(() => ExtraordinaryGrant, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_extraordinary_grant' })
  extraordinaryGrant: ExtraordinaryGrant | null;

  @ManyToOne(() => MedicalRecord, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_medical_record' })
  medicalRecord: MedicalRecord | null;

  @CreateDateColumn({ name: 'accessed_at', type: 'timestamptz' })
  accessedAt: Date;
}
