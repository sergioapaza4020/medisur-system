import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Schedule } from './schedule.entity';

export interface ScheduleState {
  idSpecialty: number;
  date: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  version: number;
}

// Append-only snapshots; schedule identifiers and future appointment references stay intact.
@Entity('schedule_history')
export class ScheduleHistory {
  @PrimaryGeneratedColumn({ name: 'id_history' })
  idHistory: number;

  @ManyToOne(() => Schedule, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_schedule' })
  schedule: Schedule;

  @Column({ name: 'before_state', type: 'jsonb' })
  before: ScheduleState;

  @Column({ name: 'after_state', type: 'jsonb' })
  after: ScheduleState;

  @Column({ name: 'created_by', type: 'integer' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
