import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '../users/users.entity';
import { Encounter } from '../encounters/encounter.entity';

@Entity('medical_records')
@Unique('UQ_medical_records_patient', ['idPatient'])
@Unique('UQ_medical_records_identity_patient', ['idMedicalRecord', 'idPatient'])
export class MedicalRecord extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_medical_record' })
  idMedicalRecord: number;

  @Column({ name: 'id_patient', type: 'integer' })
  idPatient: number;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_patient' })
  patient: User;

  @OneToMany(() => Encounter, (encounter) => encounter.medicalRecord)
  encounters: Encounter[];
}
