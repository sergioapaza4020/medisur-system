import { MigrationInterface, QueryRunner } from 'typeorm';
import { isEmail } from 'class-validator';
import { normalizeEmail } from '../../common/utils/normalize-email';

export class EmailOnlyAuthentication1791763200000 implements MigrationInterface {
  name = 'EmailOnlyAuthentication1791763200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM runs migrations transactionally. Prevent writes during the preflight.
    await queryRunner.query('LOCK TABLE "users" IN ACCESS EXCLUSIVE MODE');
    const users = (await queryRunner.query('SELECT "id_user", "email" FROM "users"')) as {
      id_user: number;
      email: string | null;
    }[];
    const seen = new Set<string>();
    for (const user of users) {
      const email = typeof user.email === 'string' ? normalizeEmail(user.email) : '';
      if (!isEmail(email) || email.length > 254 || seen.has(email)) {
        throw new Error(
          `Email migration blocked: invalid or duplicate email at user ID ${user.id_user}. Correct existing data before retrying.`,
        );
      }
      seen.add(email);
    }
    for (const user of users) {
      await queryRunner.query('UPDATE "users" SET "email" = $1 WHERE "id_user" = $2', [
        normalizeEmail(user.email!),
        user.id_user,
      ]);
    }
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_email_normalized" CHECK ("email" = lower(btrim("email")) AND "email" <> '')`,
    );
    // PostgreSQL drops the column's unique constraint/index automatically; no CASCADE.
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "username"');
    await queryRunner.query(
      `UPDATE "permissions" SET "is_active" = false WHERE "name" = 'user.get-one-by-username'`,
    );
  }

  down(): Promise<void> {
    // Removed identifiers cannot be recovered without inventing values.
    return Promise.reject(
      new Error('Restore a pre-migration backup to recover removed usernames.'),
    );
  }
}
