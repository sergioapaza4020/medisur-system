import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Doctor } from './doctors.entity';
import { Specialty } from '../specialties/specialties.entity';

// Append-only events; removing a current assignment never removes its history.
@Entity('doctor_specialty_history')
export class DoctorSpecialtyHistory {
  @PrimaryGeneratedColumn({ name: 'id_history' })
  idHistory: number;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_doctor' })
  doctor: Doctor;

  @ManyToOne(() => Specialty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_specialty' })
  specialty: Specialty;

  @Column()
  assigned: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
