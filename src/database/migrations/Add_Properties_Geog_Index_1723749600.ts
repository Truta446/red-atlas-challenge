import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertiesGeogIndex1723749600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prop_location_geog ON properties USING GIST ((location::geography))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prop_location_geog`);
  }
}
