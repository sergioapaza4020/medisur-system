import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtraordinaryClinicalGrants1793404800000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE extraordinary_grants (
      id_grant SERIAL PRIMARY KEY,
      id_patient integer NOT NULL REFERENCES users(id_user) ON DELETE RESTRICT,
      id_beneficiary integer NOT NULL REFERENCES users(id_user) ON DELETE RESTRICT,
      created_by integer NOT NULL REFERENCES users(id_user) ON DELETE RESTRICT,
      type varchar(20) NOT NULL,
      reason varchar(1000) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      revoked_by integer REFERENCES users(id_user) ON DELETE RESTRICT,
      revocation_reason varchar(1000),
      CONSTRAINT "CHK_extraordinary_grant_type" CHECK (type IN ('AUTHORIZATION', 'EMERGENCY')),
      CONSTRAINT "CHK_extraordinary_grant_no_self" CHECK (id_beneficiary <> created_by),
      CONSTRAINT "CHK_extraordinary_grant_reason" CHECK (length(btrim(reason)) BETWEEN 10 AND 1000),
      CONSTRAINT "CHK_extraordinary_grant_expiry" CHECK (expires_at > created_at AND expires_at <= created_at + interval '24 hours'),
      CONSTRAINT "CHK_extraordinary_grant_revocation" CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
        (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL AND length(btrim(revocation_reason)) BETWEEN 10 AND 1000))
    )`);
    await runner.query(
      'CREATE INDEX "IDX_extraordinary_grant_beneficiary" ON extraordinary_grants(id_beneficiary, id_patient, expires_at)',
    );
    await runner.query(`ALTER TABLE medical_record_accesses
      ALTER COLUMN id_appointment DROP NOT NULL,
      ADD COLUMN id_extraordinary_grant integer REFERENCES extraordinary_grants(id_grant) ON DELETE RESTRICT,
      ADD CONSTRAINT "CHK_medical_record_access_basis" CHECK (
        (id_appointment IS NOT NULL AND id_extraordinary_grant IS NULL) OR (id_appointment IS NULL AND id_extraordinary_grant IS NOT NULL))`);
  }
  async down(runner: QueryRunner): Promise<void> {
    // Never silently discard extraordinary access traces to restore the previous schema.
    const rows = (await runner.query(
      'SELECT EXISTS (SELECT 1 FROM extraordinary_grants) AS exists',
    )) as { exists: boolean }[];
    if (rows[0].exists)
      throw new Error('Cannot revert while extraordinary grants must be retained');
    await runner.query(
      'ALTER TABLE medical_record_accesses DROP CONSTRAINT "CHK_medical_record_access_basis", DROP COLUMN id_extraordinary_grant, ALTER COLUMN id_appointment SET NOT NULL',
    );
    await runner.query('DROP TABLE extraordinary_grants');
  }
}
