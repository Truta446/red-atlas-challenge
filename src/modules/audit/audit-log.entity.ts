import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid', nullable: true })
  public tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  public userId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  public method!: string;

  @Column({ type: 'varchar', length: 256 })
  public path!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public entity!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public before!: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  public after!: unknown | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;
}
