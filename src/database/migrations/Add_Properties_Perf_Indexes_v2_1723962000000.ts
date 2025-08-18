import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertiesPerfIndexesV21723962000000 implements MigrationInterface {
  public readonly name = 'AddPropertiesPerfIndexesV21723962000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for trigram indexes (safe if already enabled)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Partial GIN index for ILIKE address searches (skip soft-deleted rows)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_address_trgm ON properties USING GIN (address gin_trgm_ops) WHERE deleted_at IS NULL`,
    );

    // Partial covering indexes focused on hot paths (skip soft-deleted rows)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_tenant_created_not_deleted ON properties (tenant_id, created_at, id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_tenant_price_not_deleted ON properties (tenant_id, price, id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_props_tenant_sector_type_not_deleted ON properties (tenant_id, sector, type, id) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop partial indexes created in up()
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_sector_type_not_deleted`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_price_not_deleted`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_tenant_created_not_deleted`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_props_address_trgm`);
    // Note: we intentionally do not drop the pg_trgm extension here to avoid
    // impacting other objects that might depend on it.
  }
}
