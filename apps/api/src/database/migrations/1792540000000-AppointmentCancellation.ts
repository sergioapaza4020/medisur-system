import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentCancellation1792540000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointments"
      ADD COLUMN "cancelled_at" timestamptz,
      ADD COLUMN "cancelled_by" integer REFERENCES "users"("id_user") ON DELETE RESTRICT`);
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP CONSTRAINT "UQ_appointments_schedule"',
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_appointments_schedule" ON "appointments" ("id_schedule") WHERE status <> 'CANCELLED'`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    // Never erase historical appointments to restore the former global uniqueness rule.
    const duplicates: unknown = await queryRunner.query(
      'SELECT id_schedule FROM appointments GROUP BY id_schedule HAVING COUNT(*) > 1 LIMIT 1',
    );
    if (!Array.isArray(duplicates) || duplicates.length)
      throw new Error(
        'No se puede revertir: existen varias citas históricas para un mismo horario',
      );
    await queryRunner.query('DROP INDEX "UQ_appointments_schedule"');
    await queryRunner.query(
      'ALTER TABLE "appointments" ADD CONSTRAINT "UQ_appointments_schedule" UNIQUE ("id_schedule")',
    );
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP COLUMN "cancelled_by", DROP COLUMN "cancelled_at"',
    );
  }
}
