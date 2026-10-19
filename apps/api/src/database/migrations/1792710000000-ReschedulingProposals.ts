import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReschedulingProposals1792710000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE rescheduling_proposals (
      id_proposal SERIAL PRIMARY KEY,
      id_appointment integer NOT NULL REFERENCES appointments(id_appointment) ON DELETE RESTRICT,
      id_schedule integer NOT NULL REFERENCES schedules(id_schedule) ON DELETE RESTRICT,
      schedule_version integer NOT NULL,
      original_date date NOT NULL, original_start_time time NOT NULL, original_end_time time NOT NULL,
      date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
      status varchar NOT NULL DEFAULT 'PENDING',
      is_active boolean NOT NULL DEFAULT true,
      created_by integer REFERENCES users(id_user) ON DELETE RESTRICT,
      updated_by integer, deleted_by integer,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp,
      CONSTRAINT "CHK_proposal_status" CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
      CONSTRAINT "CHK_proposal_time" CHECK (original_start_time < original_end_time AND start_time < end_time)
    )`);
    await runner.query(`CREATE UNIQUE INDEX "UQ_pending_proposal_appointment"
      ON rescheduling_proposals (id_appointment) WHERE status = 'PENDING'`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE rescheduling_proposals');
  }
}
