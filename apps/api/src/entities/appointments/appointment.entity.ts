import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
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
export class Appointment extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_appointment' })
  idAppointment: number;

  @ManyToOne(() => Schedule, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_schedule' })
  @Index('UQ_appointments_schedule', { unique: true })
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

  @Column({ type: 'varchar', default: AppointmentStatus.RESERVED })
  status: AppointmentStatus;
}
