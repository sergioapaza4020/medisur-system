import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorAppointmentCancellation1792630000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE appointments
      ADD COLUMN cancellation_reason varchar(500),
      ADD COLUMN cancellation_source varchar(10),
      ADD CONSTRAINT "CHK_appointment_cancellation_source"
        CHECK (cancellation_source IS NULL OR cancellation_source IN ('PATIENT', 'DOCTOR')),
      ADD CONSTRAINT "CHK_appointment_doctor_cancellation"
        CHECK (cancellation_source IS DISTINCT FROM 'DOCTOR' OR
          (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
            AND cancellation_reason IS NOT NULL AND length(btrim(cancellation_reason)) > 0))`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE appointments
      DROP CONSTRAINT "CHK_appointment_doctor_cancellation",
      DROP CONSTRAINT "CHK_appointment_cancellation_source",
      DROP COLUMN cancellation_source,
      DROP COLUMN cancellation_reason`);
  }
}
