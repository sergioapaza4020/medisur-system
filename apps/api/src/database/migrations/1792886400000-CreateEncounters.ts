import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEncounters1792886400000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "encounters" (
      "id_encounter" SERIAL PRIMARY KEY,
      "id_patient" integer NOT NULL REFERENCES "users"("id_user") ON DELETE RESTRICT,
      "id_doctor" integer NOT NULL REFERENCES "doctors"("id_doctor") ON DELETE RESTRICT,
      "id_specialty" integer NOT NULL REFERENCES "specialties"("id_specialty") ON DELETE RESTRICT,
      "id_appointment" integer REFERENCES "appointments"("id_appointment") ON DELETE RESTRICT,
      "occurred_at" timestamptz NOT NULL,
      "summary" text NOT NULL CHECK (length(btrim("summary")) BETWEEN 1 AND 10000),
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), "deleted_at" timestamp
    )`);
    await runner.query(
      'CREATE INDEX "IDX_encounters_patient_time" ON "encounters" ("id_patient", "occurred_at", "id_encounter")',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "encounters"');
  }
}
