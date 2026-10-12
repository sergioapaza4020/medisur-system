import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpecialties1791806400000 implements MigrationInterface {
  name = 'CreateSpecialties1791806400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "specialties" (
      "id_specialty" SERIAL PRIMARY KEY,
      "name" varchar(100) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_by" integer, "updated_by" integer, "deleted_by" integer,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
      "deleted_at" TIMESTAMP,
      CONSTRAINT "CHK_specialties_name" CHECK ("name" <> '' AND "name" = btrim(regexp_replace("name", '\\s+', ' ', 'g')))
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_specialties_name" ON "specialties" (lower("name"))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "specialties"');
  }
}
