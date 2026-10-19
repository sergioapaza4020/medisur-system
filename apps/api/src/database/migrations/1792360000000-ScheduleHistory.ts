import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleHistory1792360000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE schedules ADD COLUMN version integer NOT NULL DEFAULT 1');
    await queryRunner.query(`CREATE TABLE schedule_history (
      id_history SERIAL PRIMARY KEY,
      id_schedule INTEGER NOT NULL REFERENCES schedules(id_schedule) ON DELETE RESTRICT,
      before_state JSONB NOT NULL, after_state JSONB NOT NULL,
      created_by INTEGER NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_schedule_history_schedule" ON schedule_history(id_schedule, created_at)',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE schedule_history');
    await queryRunner.query('ALTER TABLE schedules DROP COLUMN version');
  }
}
