import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImportBatches1723810260000 implements MigrationInterface {
  public name = 'CreateImportBatches1723810260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS import_batches (
        job_id uuid NOT NULL,
        seq integer NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, seq)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS import_batches`);
  }
}
