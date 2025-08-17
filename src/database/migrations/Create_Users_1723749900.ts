import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1723750000000 implements MigrationInterface {
  public name = 'CreateUsers1723750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL,
        email citext NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role varchar(10) NOT NULL DEFAULT 'user',
        refresh_token_hash text NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
