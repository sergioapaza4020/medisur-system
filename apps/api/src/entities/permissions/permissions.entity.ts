import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../roles/roles.entity';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('permissions')
export class Permission extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_permission' })
  idPermission: number;

  @Column({ unique: true, name: 'name' })
  name: string;

  @Column({ nullable: true, name: 'description' })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
