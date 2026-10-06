import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from '../permissions/permissions.entity';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_role' })
  idRole: number;

  @Column({ unique: true, name: 'name' })
  name: string;

  @Column({ nullable: true, type: 'varchar', name: 'description' })
  description: string | null;

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({ name: 'role_permission' })
  permissions: Permission[];
}
