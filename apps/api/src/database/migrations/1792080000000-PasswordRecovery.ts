import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordRecovery1792080000000 implements MigrationInterface {
  name = 'PasswordRecovery1792080000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "password_recovery_tokens" (
      "id" uuid PRIMARY KEY,
      "token_hash" varchar(64) NOT NULL,
      "id_user" integer NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "expires_at" timestamptz NOT NULL,
      CONSTRAINT "FK_password_recovery_user" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_password_recovery_token_hash" ON "password_recovery_tokens" ("token_hash")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_password_recovery_user" ON "password_recovery_tokens" ("id_user")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_password_recovery_expiration" ON "password_recovery_tokens" ("expires_at")',
    );
    await queryRunner.query(`CREATE TABLE "password_recovery_rate_limits" (
      "scope_hash" varchar(64) PRIMARY KEY,
      "attempts" integer NOT NULL,
      "expires_at" timestamptz NOT NULL
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_password_recovery_rate_expiration" ON "password_recovery_rate_limits" ("expires_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "password_recovery_rate_limits"');
    await queryRunner.query('DROP TABLE "password_recovery_tokens"');
  }
}
