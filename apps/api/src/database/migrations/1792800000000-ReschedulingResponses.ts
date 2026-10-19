import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReschedulingResponses1792800000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE rescheduling_proposals
      ADD COLUMN responded_at timestamptz,
      ADD COLUMN responded_by integer REFERENCES users(id_user) ON DELETE RESTRICT,
      ADD COLUMN id_resulting_appointment integer REFERENCES appointments(id_appointment) ON DELETE RESTRICT,
      ADD CONSTRAINT "CHK_proposal_response_audit" CHECK ((responded_at IS NULL AND responded_by IS NULL) OR
        (responded_at IS NOT NULL AND responded_by IS NOT NULL AND status <> 'PENDING')),
      ADD CONSTRAINT "CHK_proposal_replacement" CHECK (id_resulting_appointment IS NULL OR (status = 'ACCEPTED' AND responded_at IS NOT NULL))`);
    await runner.query(`CREATE UNIQUE INDEX "UQ_accepted_proposal_appointment"
      ON rescheduling_proposals (id_appointment) WHERE status = 'ACCEPTED'`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX "UQ_accepted_proposal_appointment"');
    await runner.query(`ALTER TABLE rescheduling_proposals
      DROP CONSTRAINT "CHK_proposal_response_audit", DROP CONSTRAINT "CHK_proposal_replacement",
      DROP COLUMN id_resulting_appointment, DROP COLUMN responded_by, DROP COLUMN responded_at`);
  }
}
