import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1723821000000 implements MigrationInterface {
  public name = 'CreateAuditLogs1723821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NULL,
        user_id uuid NULL,
        method varchar(16) NOT NULL,
        path varchar(256) NOT NULL,
        entity varchar(128) NULL,
        entity_id varchar(64) NULL,
        before jsonb NULL,
        after jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
  }
}
