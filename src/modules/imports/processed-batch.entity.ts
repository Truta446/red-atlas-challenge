import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('import_batches')
export class ImportProcessedBatch {
  @PrimaryColumn('uuid', { name: 'job_id' })
  public jobId!: string;

  @PrimaryColumn('integer', { name: 'seq' })
  public seq!: number;

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'now()' })
  public processedAt!: Date;
}
