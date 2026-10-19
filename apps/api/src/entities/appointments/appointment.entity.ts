import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
  Check,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '../users/users.entity';
import { Doctor } from '../doctors/doctors.entity';
import { Specialty } from '../specialties/specialties.entity';
import { Schedule } from '../schedules/schedule.entity';

export enum AppointmentStatus {
  RESERVED = 'RESERVED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
}

@Entity('appointments')
@Check(
  'CHK_appointment_cancellation_source',
  "cancellation_source IS NULL OR cancellation_source IN ('PATIENT', 'DOCTOR')",
)
@Check(
  'CHK_appointment_doctor_cancellation',
  `cancellation_source IS DISTINCT FROM 'DOCTOR' OR
  (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
    AND cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason)) > 0)`,
)
export class Appointment extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_appointment' })
  idAppointment: number;

  @ManyToOne(() => Schedule, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_schedule' })
  @Index('UQ_appointments_schedule', { unique: true, where: "status <> 'CANCELLED'" })
  schedule: Schedule;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_patient' })
  patient: User;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_doctor' })
  doctor: Doctor;

  @ManyToOne(() => Specialty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_specialty' })
  specialty: Specialty;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  cancelledBy: number | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', length: 500, nullable: true })
  cancellationReason: string | null;

  @Column({ name: 'cancellation_source', type: 'varchar', length: 10, nullable: true })
  cancellationSource: 'PATIENT' | 'DOCTOR' | null;

  @Column({ type: 'varchar', default: AppointmentStatus.RESERVED })
  status: AppointmentStatus;
}
