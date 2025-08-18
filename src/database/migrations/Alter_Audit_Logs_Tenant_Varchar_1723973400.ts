import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAuditLogsTenantVarchar1723973400000 implements MigrationInterface {
  public name = 'AlterAuditLogsTenantVarchar1723973400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ALTER COLUMN tenant_id TYPE varchar(64) USING tenant_id::text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE audit_logs
      ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
    `);
  }
}
