import {
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '../users/users.entity';
import { Specialty } from '../specialties/specialties.entity';

@Entity('doctors')
export class Doctor extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_doctor' })
  idDoctor: number;

  @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_user' })
  user: User;

  @ManyToMany(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinTable({
    name: 'doctor_specialty',
    joinColumn: { name: 'id_doctor', referencedColumnName: 'idDoctor' },
    inverseJoinColumn: { name: 'id_specialty', referencedColumnName: 'idSpecialty' },
  })
  specialties: Specialty[];
}
