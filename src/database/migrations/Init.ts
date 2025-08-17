import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1710000000000 implements MigrationInterface {
  name = 'Init1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        address varchar(255) NOT NULL,
        sector varchar(64) NOT NULL,
        type varchar(64) NOT NULL,
        price numeric(14,2) NOT NULL,
        location geometry(Point, 4326) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_properties_sector ON properties(sector)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST(location)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        propertyId uuid NOT NULL,
        status varchar(32) NOT NULL,
        price numeric(14,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        CONSTRAINT fk_listings_property FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listings_tenant ON listings(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        propertyId uuid NULL,
        listingId uuid NULL,
        price numeric(14,2) NOT NULL,
        date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        CONSTRAINT fk_tx_property FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE SET NULL,
        CONSTRAINT fk_tx_listing FOREIGN KEY (listingId) REFERENCES listings(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_tenant ON transactions(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_price ON transactions(price)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS listings`);
    await queryRunner.query(`DROP TABLE IF EXISTS properties`);
  }
}
