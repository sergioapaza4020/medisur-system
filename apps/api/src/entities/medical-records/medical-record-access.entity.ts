import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/users.entity';
import { Doctor } from '../doctors/doctors.entity';
import { Appointment } from '../appointments/appointment.entity';
import { MedicalRecord } from './medical-record.entity';

// Append-only clinical access context for the future transversal audit module.
@Entity('medical_record_accesses')
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

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_appointment' })
  appointment: Appointment;

  @ManyToOne(() => MedicalRecord, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_medical_record' })
  medicalRecord: MedicalRecord | null;

  @CreateDateColumn({ name: 'accessed_at', type: 'timestamptz' })
  accessedAt: Date;
}
