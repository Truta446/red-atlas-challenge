import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScaleIndexesAndTransactionsPartition1723748600000 implements MigrationInterface {
  public readonly name = 'ScaleIndexesAndTransactionsPartition1723748600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Indexes for properties
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prop_tenant_sector_type ON properties (tenant_id, sector, type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prop_tenant_price ON properties (tenant_id, price, id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prop_tenant_created ON properties (tenant_id, created_at, id)`);

    // 2) Indexes for listings
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_list_tenant_status ON listings (tenant_id, status, id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_list_property ON listings (propertyid)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_list_tenant_price ON listings (tenant_id, price, id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_list_tenant_created ON listings (tenant_id, created_at, id)`);

    // 3) Prepare partitioned table for transactions
    // Create new partitioned parent table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transactions_new (
        id uuid DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        propertyid uuid NULL,
        listingid uuid NULL,
        price numeric(14,2) NOT NULL,
        date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        CONSTRAINT fk_tx_property_new FOREIGN KEY (propertyid) REFERENCES properties(id) ON DELETE SET NULL,
        CONSTRAINT fk_tx_listing_new FOREIGN KEY (listingid) REFERENCES listings(id) ON DELETE SET NULL
      ) PARTITION BY RANGE (date)
    `);

    // Create a default partition to absorb existing data range
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND c.relname = 'transactions_default'
        ) THEN
          EXECUTE 'CREATE TABLE transactions_default PARTITION OF transactions_new DEFAULT';
          EXECUTE 'ALTER TABLE transactions_default ADD PRIMARY KEY (id)';
        END IF;
      END$$;
    `);

    // Create current month partition proactively with PK(id)
    await queryRunner.query(`
      DO $$
      DECLARE
        start_date date := date_trunc('month', now())::date;
        end_date date := (date_trunc('month', now()) + interval '1 month')::date;
        part_name text := 'transactions_' || to_char(start_date, 'YYYY_MM');
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND c.relname = part_name
        ) THEN
          EXECUTE format('CREATE TABLE %I PARTITION OF transactions_new FOR VALUES FROM (%L) TO (%L)', part_name, start_date, end_date);
          EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', part_name);
        END IF;
      END$$;
    `);

    // Partitioned indexes on transactions_new
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_tenant_date ON transactions_new (tenant_id, date, id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_property ON transactions_new (propertyid)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_listing ON transactions_new (listingid)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS brin_tx_date ON transactions_new USING BRIN (date)`);

    // Move data from old transactions (if exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'transactions'
        ) THEN
          EXECUTE 'INSERT INTO transactions_new (id, tenant_id, propertyid, listingid, price, date, created_at, updated_at, deleted_at)\n'
               || 'SELECT id, tenant_id, propertyid, listingid, price, date, created_at, updated_at, deleted_at FROM transactions';

          -- Drop old table and rename new one
          EXECUTE 'DROP TABLE transactions';
        END IF;
      END$$;
    `);

    await queryRunner.query(`ALTER TABLE transactions_new RENAME TO transactions`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate non-partitioned transactions table and move data back
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transactions_legacy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        propertyid uuid NULL,
        listingid uuid NULL,
        price numeric(14,2) NOT NULL,
        date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        CONSTRAINT fk_tx_property FOREIGN KEY (propertyid) REFERENCES properties(id) ON DELETE SET NULL,
        CONSTRAINT fk_tx_listing FOREIGN KEY (listingid) REFERENCES listings(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO transactions_legacy (id, tenant_id, propertyid, listingid, price, date, created_at, updated_at, deleted_at)
      SELECT id, tenant_id, propertyid, listingid, price, date, created_at, updated_at, deleted_at FROM transactions
    `);

    // Drop partitioned structure
    await queryRunner.query(`DROP TABLE IF EXISTS transactions CASCADE`);

    // Rename legacy back to transactions
    await queryRunner.query(`ALTER TABLE transactions_legacy RENAME TO transactions`);

    // Drop created indexes (IF EXISTS to be safe)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prop_tenant_sector_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prop_tenant_price`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_prop_tenant_created`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_list_tenant_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_list_property`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_list_tenant_price`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_list_tenant_created`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_tx_tenant_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tx_property`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tx_listing`);
    await queryRunner.query(`DROP INDEX IF EXISTS brin_tx_date`);
  }
}
