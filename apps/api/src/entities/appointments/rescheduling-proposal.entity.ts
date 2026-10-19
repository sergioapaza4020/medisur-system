import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Appointment } from './appointment.entity';
import { Schedule } from '../schedules/schedule.entity';

export enum ProposalStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('rescheduling_proposals')
@Check('CHK_proposal_status', "status IN ('PENDING', 'ACCEPTED', 'REJECTED')")
@Check('CHK_proposal_time', 'original_start_time < original_end_time AND start_time < end_time')
export class ReschedulingProposal extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_proposal' })
  idProposal: number;

  @ManyToOne(() => Appointment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_appointment' })
  @Index('UQ_pending_proposal_appointment', { unique: true, where: "status = 'PENDING'" })
  appointment: Appointment;

  @ManyToOne(() => Schedule, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_schedule' })
  schedule: Schedule;

  @Column({ name: 'schedule_version', type: 'integer' })
  scheduleVersion: number;

  @Column({ name: 'original_date', type: 'date' })
  originalDate: string;

  @Column({ name: 'original_start_time', type: 'time' })
  originalStartTime: string;

  @Column({ name: 'original_end_time', type: 'time' })
  originalEndTime: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'varchar', default: ProposalStatus.PENDING })
  status: ProposalStatus;
}
