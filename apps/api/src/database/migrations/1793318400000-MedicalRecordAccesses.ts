import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalRecordAccesses1793318400000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "medical_record_accesses" (
      "id_access" SERIAL PRIMARY KEY,
      "id_actor" integer NOT NULL REFERENCES "users"("id_user") ON DELETE RESTRICT,
      "id_patient" integer NOT NULL REFERENCES "users"("id_user") ON DELETE RESTRICT,
      "id_doctor" integer NOT NULL REFERENCES "doctors"("id_doctor") ON DELETE RESTRICT,
      "id_appointment" integer NOT NULL REFERENCES "appointments"("id_appointment") ON DELETE RESTRICT,
      "id_medical_record" integer REFERENCES "medical_records"("id_medical_record") ON DELETE RESTRICT,
      "accessed_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "medical_record_accesses"');
  }
}
