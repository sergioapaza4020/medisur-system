import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedules1792190000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "schedules" (
      "id_schedule" SERIAL PRIMARY KEY,
      "id_doctor" integer NOT NULL REFERENCES "doctors"("id_doctor") ON DELETE RESTRICT,
      "id_specialty" integer NOT NULL REFERENCES "specialties"("id_specialty") ON DELETE RESTRICT,
      "date" date NOT NULL, "start_time" time NOT NULL, "end_time" time NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP,
      CONSTRAINT "CHK_schedule_time" CHECK ("start_time" < "end_time")
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_schedules_doctor_date" ON "schedules" ("id_doctor", "date")',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "schedules"');
  }
}
