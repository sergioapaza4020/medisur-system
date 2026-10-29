import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '../users/users.entity';
import { Doctor } from '../doctors/doctors.entity';
import { Specialty } from '../specialties/specialties.entity';
import { Appointment } from '../appointments/appointment.entity';
import { MedicalRecord } from '../medical-records/medical-record.entity';

@Entity('encounters')
export class Encounter extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_encounter' })
  idEncounter: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_patient' })
  patient: User;

  @ManyToOne(() => MedicalRecord, (record) => record.encounters, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    { name: 'id_medical_record', referencedColumnName: 'idMedicalRecord' },
    { name: 'id_patient', referencedColumnName: 'idPatient' },
  ])
  medicalRecord: MedicalRecord;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_doctor' })
  doctor: Doctor;

  @ManyToOne(() => Specialty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_specialty' })
  specialty: Specialty;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_appointment' })
  appointment: Appointment | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'text', select: false })
  summary: string;
}
