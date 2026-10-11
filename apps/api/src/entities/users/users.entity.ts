import {
  Check,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../roles/roles.entity';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@common/entities/base.entity';
import { UserSession } from '../user-sessions/user-sessions.entity';

@Entity('users')
@Check('CHK_users_email_normalized', `"email" = lower(btrim("email")) AND "email" <> ''`)
export class User extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id_user' })
  idUser: number;

  @Column({ unique: true, name: 'email' })
  email: string;

  @Exclude({ toPlainOnly: true })
  @Column({ name: 'password', select: false })
  password: string;

  @Column({ nullable: true, name: 'avatar' })
  avatar: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'lastname' })
  lastname: string;

  @Column({ unique: true, name: 'ci' })
  ci: string;

  @ManyToMany(() => Role)
  @JoinTable({ name: 'user_role' })
  roles: Role[];

  @OneToMany(() => UserSession, (userSession) => userSession.user)
  sessions: UserSession[];
}
