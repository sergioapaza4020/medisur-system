import { Column, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({
    name: 'created_by',
    nullable: true,
  })
  createdBy: number;

  @Column({
    name: 'updated_by',
    nullable: true,
  })
  updatedBy: number;

  @Column({
    name: 'deleted_by',
    nullable: true,
  })
  deletedBy: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt: Date | null;
}
