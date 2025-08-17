import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompositeIndexes1723750600000 implements MigrationInterface {
  public name = 'AddCompositeIndexes1723750600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Composite indexes to speed up common filters and ordering
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_tenant_sector_type ON properties (tenant_id, sector, type)`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_props_tenant_price ON properties (tenant_id, price)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_tenant_sector_type_price ON properties (tenant_id, sector, type, price)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_sector_type_price`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_price`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_sector_type`);
  }
}
