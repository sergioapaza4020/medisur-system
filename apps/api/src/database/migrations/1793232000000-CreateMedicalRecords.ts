import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMedicalRecords1793232000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Migrations run transactionally; block legacy writers until backfill and constraints commit.
    await runner.query('LOCK TABLE "encounters" IN ACCESS EXCLUSIVE MODE');
    await runner.query(`CREATE TABLE "medical_records" (
      "id_medical_record" SERIAL PRIMARY KEY,
      "id_patient" integer NOT NULL REFERENCES "users"("id_user") ON DELETE RESTRICT,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), "deleted_at" timestamp,
      CONSTRAINT "UQ_medical_records_patient" UNIQUE ("id_patient"),
      CONSTRAINT "UQ_medical_records_identity_patient" UNIQUE ("id_medical_record", "id_patient")
    )`);
    await runner.query(`INSERT INTO "medical_records" ("id_patient")
      SELECT DISTINCT "id_patient" FROM "encounters" ORDER BY "id_patient"`);
    await runner.query('ALTER TABLE "encounters" ADD COLUMN "id_medical_record" integer');
    await runner.query(`UPDATE "encounters" AS encounter SET "id_medical_record" = record."id_medical_record"
      FROM "medical_records" AS record WHERE record."id_patient" = encounter."id_patient"`);
    await runner.query(`ALTER TABLE "encounters"
      ALTER COLUMN "id_medical_record" SET NOT NULL,
      ADD CONSTRAINT "FK_encounters_record_patient" FOREIGN KEY ("id_medical_record", "id_patient")
        REFERENCES "medical_records" ("id_medical_record", "id_patient") ON DELETE RESTRICT`);
    await runner.query(
      'CREATE INDEX "IDX_encounters_medical_record" ON "encounters" ("id_medical_record", "id_patient")',
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "encounters" DROP CONSTRAINT "FK_encounters_record_patient"');
    await runner.query('DROP INDEX "IDX_encounters_medical_record"');
    await runner.query('ALTER TABLE "encounters" DROP COLUMN "id_medical_record"');
    await runner.query('DROP TABLE "medical_records"');
  }
}
