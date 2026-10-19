import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Doctor } from '../doctors/doctors.entity';
import { Specialty } from '../specialties/specialties.entity';

@Entity('schedules')
export class Schedule extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_schedule' })
  idSchedule: number;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_doctor' })
  doctor: Doctor;

  @ManyToOne(() => Specialty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_specialty' })
  specialty: Specialty;

  @VersionColumn({ type: 'integer' })
  version: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
}
