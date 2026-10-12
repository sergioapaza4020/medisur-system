import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('specialties')
@Index('UQ_specialties_name', { synchronize: false })
export class Specialty extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_specialty' })
  idSpecialty: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;
}
