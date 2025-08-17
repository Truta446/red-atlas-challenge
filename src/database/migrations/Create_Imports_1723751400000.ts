import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImports1723751400000 implements MigrationInterface {
  public name = 'CreateImports1723751400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS imports (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id varchar(64) NOT NULL,
        idempotency_key varchar(128) NOT NULL,
        status varchar(16) NOT NULL,
        processed integer NOT NULL DEFAULT 0,
        succeeded integer NOT NULL DEFAULT 0,
        failed integer NOT NULL DEFAULT 0,
        error text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_imports_tenant ON imports (tenant_id)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_imports_tenant_key ON imports (tenant_id, idempotency_key)`,
    );
    // trigger to auto-update updated_at
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'imports_set_updated_at'
        ) THEN
          CREATE TRIGGER imports_set_updated_at
          BEFORE UPDATE ON imports
          FOR EACH ROW
          EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS imports_set_updated_at ON imports`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS ux_imports_tenant_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_imports_tenant`);
    await queryRunner.query(`DROP TABLE IF EXISTS imports`);
  }
}
