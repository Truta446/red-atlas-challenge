import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyValuation1723751700000 implements MigrationInterface {
  public name = 'AddPropertyValuation1723751700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS valuation numeric(14,2) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE properties DROP COLUMN IF EXISTS valuation`);
  }
}
