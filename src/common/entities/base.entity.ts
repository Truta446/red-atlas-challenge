import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Column, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

export abstract class BaseEntityWithTenant {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'tenant_id' })
  public tenantId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  public updatedAt!: Date;

  @Exclude({ toPlainOnly: true })
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  public deletedAt?: Date | null;
}
