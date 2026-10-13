import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorSpecialtyHistory1791820000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE doctor_specialty_history (
      id_history SERIAL PRIMARY KEY,
      id_doctor INTEGER NOT NULL REFERENCES doctors(id_doctor) ON DELETE RESTRICT,
      id_specialty INTEGER NOT NULL REFERENCES specialties(id_specialty) ON DELETE RESTRICT,
      assigned BOOLEAN NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_doctor_specialty_history_doctor" ON doctor_specialty_history(id_doctor, created_at)`,
    );
    // Snapshot existing assignments at migration time; earlier changes are unknown.
    await queryRunner.query(`INSERT INTO doctor_specialty_history (id_doctor, id_specialty, assigned)
      SELECT id_doctor, id_specialty, true FROM doctor_specialty`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE doctor_specialty_history');
  }
}
