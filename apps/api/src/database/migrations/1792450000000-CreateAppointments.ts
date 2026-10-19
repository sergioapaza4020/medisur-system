import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppointments1792450000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "appointments" (
      "id_appointment" SERIAL PRIMARY KEY,
      "id_schedule" integer NOT NULL REFERENCES "schedules"("id_schedule") ON DELETE RESTRICT,
      "id_patient" integer NOT NULL REFERENCES "users"("id_user") ON DELETE RESTRICT,
      "id_doctor" integer NOT NULL REFERENCES "doctors"("id_doctor") ON DELETE RESTRICT,
      "id_specialty" integer NOT NULL REFERENCES "specialties"("id_specialty") ON DELETE RESTRICT,
      "date" date NOT NULL, "start_time" time NOT NULL, "end_time" time NOT NULL,
      "status" varchar NOT NULL DEFAULT 'RESERVED',
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP,
      CONSTRAINT "UQ_appointments_schedule" UNIQUE ("id_schedule"),
      CONSTRAINT "CHK_appointment_time" CHECK ("start_time" < "end_time")
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "appointments"');
  }
}
