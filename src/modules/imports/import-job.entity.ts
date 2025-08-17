import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity('imports')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 64 })
  public tenantId!: string;

  @Index()
  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  public idempotencyKey!: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  public status!: ImportStatus;

  @Column({ type: 'integer', default: 0 })
  public processed!: number;

  @Column({ type: 'integer', default: 0 })
  public succeeded!: number;

  @Column({ type: 'integer', default: 0 })
  public failed!: number;

  @Column({ type: 'integer', name: 'total_estimated', default: 0 })
  public totalEstimated!: number;

  @Column({ type: 'boolean', default: false })
  public published!: boolean;

  @Column({ type: 'text', nullable: true })
  public error?: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  public createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  public updatedAt!: Date;
}
