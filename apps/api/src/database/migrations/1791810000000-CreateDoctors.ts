import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDoctors1791810000000 implements MigrationInterface {
  name = 'CreateDoctors1791810000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "doctors" (
      "id_doctor" SERIAL PRIMARY KEY, "id_user" integer NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP,
      CONSTRAINT "UQ_doctors_user" UNIQUE ("id_user"),
      CONSTRAINT "FK_doctors_user" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE TABLE "doctor_specialty" (
      "id_doctor" integer NOT NULL, "id_specialty" integer NOT NULL,
      PRIMARY KEY ("id_doctor", "id_specialty"),
      CONSTRAINT "FK_doctor_specialty_doctor" FOREIGN KEY ("id_doctor") REFERENCES "doctors"("id_doctor") ON DELETE RESTRICT,
      CONSTRAINT "FK_doctor_specialty_specialty" FOREIGN KEY ("id_specialty") REFERENCES "specialties"("id_specialty") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_doctor_specialty_specialty" ON "doctor_specialty" ("id_specialty")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "doctor_specialty"');
    await queryRunner.query('DROP TABLE "doctors"');
  }
}
