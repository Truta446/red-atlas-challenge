import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImportsPublishedAndTotalEstimated1723810200000 implements MigrationInterface {
  public name = 'AddImportsPublishedAndTotalEstimated1723810200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE imports ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE imports ADD COLUMN IF NOT EXISTS total_estimated integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE imports DROP COLUMN IF EXISTS total_estimated`);
    await queryRunner.query(`ALTER TABLE imports DROP COLUMN IF EXISTS published`);
  }
}
