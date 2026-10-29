import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { CreateEncounters1792886400000 } from 'src/database/migrations/1792886400000-CreateEncounters';
import { CreateMedicalRecords1793232000000 } from 'src/database/migrations/1793232000000-CreateMedicalRecords';
import { EncountersService } from './encounters.service';
import { SchedulesService } from '../schedules/schedules.service';

const postgres = process.env.APPOINTMENTS_TEST_DATABASE_URL ? describe : describe.skip;
postgres('Unique patient medical record in PostgreSQL', () => {
  const schema = `records_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let source: DataSource;
  let service: EncountersService;
  let patient: User;
  let otherPatient: User;
  let physicians: User[];
  let doctors: Doctor[];
  let specialty: Specialty;
  const migration = new CreateMedicalRecords1793232000000();
  async function migrate(direction: 'up' | 'down') {
    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      await migration[direction](runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
  beforeAll(async () => {
    admin = await new DataSource({
      type: 'postgres',
      url: process.env.APPOINTMENTS_TEST_DATABASE_URL,
    }).initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    source = await new DataSource({
      type: 'postgres',
      url: process.env.APPOINTMENTS_TEST_DATABASE_URL,
      schema,
      extra: { options: `-c search_path=${schema},public`, max: 8 },
      entities: [
        MedicalRecord,
        Encounter,
        Appointment,
        Schedule,
        Doctor,
        User,
        Specialty,
        Role,
        Permission,
        UserSession,
      ],
      synchronize: true,
    }).initialize();
    await source.query('DROP TABLE encounters');
    await source.query('DROP TABLE medical_records');
    const runner = source.createQueryRunner();
    try {
      await new CreateEncounters1792886400000().up(runner);
    } finally {
      await runner.release();
    }
    await migrate('up');
    service = new EncountersService(source, new SchedulesService(source));
  }, 30000);
  beforeEach(async () => {
    await source.query(
      'TRUNCATE encounters, medical_records, appointments, schedules, doctor_specialty, doctors, user_role, users, role_permission, roles, specialties RESTART IDENTITY CASCADE',
    );
    const patientRole = await source.getRepository(Role).save({ name: 'PATIENT' });
    const doctorRole = await source.getRepository(Role).save({ name: 'DOCTOR' });
    const users = source.getRepository(User);
    patient = await users.save({
      name: 'Patient',
      lastname: 'One',
      email: 'one@example.test',
      ci: '1',
      password: 'unused',
      roles: [patientRole],
    });
    otherPatient = await users.save({
      name: 'Patient',
      lastname: 'Two',
      email: 'two@example.test',
      ci: '2',
      password: 'unused',
      roles: [patientRole],
    });
    physicians = await users.save([
      {
        name: 'Doctor',
        lastname: 'One',
        email: 'doctor-one@example.test',
        ci: '3',
        password: 'unused',
        roles: [doctorRole],
      },
      {
        name: 'Doctor',
        lastname: 'Two',
        email: 'doctor-two@example.test',
        ci: '4',
        password: 'unused',
        roles: [doctorRole],
      },
    ]);
    specialty = await source.getRepository(Specialty).save({ name: 'General' });
    doctors = await source
      .getRepository(Doctor)
      .save(physicians.map((user) => ({ user, specialties: [specialty] })));
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.destroy();
    }
  });
  function create(idPatient = patient.idUser, doctorIndex = 0, summary = 'Attention') {
    return service.create(
      { idPatient, idSpecialty: specialty.idSpecialty, summary },
      physicians[doctorIndex].idUser,
    );
  }
  it('creates on first encounter and reuses without changing audit, retaining all encounters', async () => {
    const records = source.getRepository(MedicalRecord);
    expect(await records.count()).toBe(0);
    await create();
    const first = await records.findOneByOrFail({ idPatient: patient.idUser });
    await create(patient.idUser, 1);
    const record = await records.findOneOrFail({
      where: { idPatient: patient.idUser },
      relations: { encounters: true },
    });
    expect(record.idMedicalRecord).toBe(first.idMedicalRecord);
    expect(record.createdBy).toBe(physicians[0].idUser);
    expect(record.updatedAt).toEqual(first.updatedAt);
    expect(record.encounters).toHaveLength(2);
    expect(await records.count()).toBe(1);
  });
  it('serializes simultaneous first encounters from different doctors', async () => {
    await Promise.all([create(patient.idUser, 0), create(patient.idUser, 1)]);
    expect(await source.getRepository(MedicalRecord).count()).toBe(1);
    const encounters = await source
      .getRepository(Encounter)
      .find({ relations: { medicalRecord: true } });
    expect(encounters).toHaveLength(2);
    expect(
      new Set(encounters.map((encounter) => encounter.medicalRecord.idMedicalRecord)).size,
    ).toBe(1);
  });
  it('isolates patients and rejects cross-patient associations in SQL', async () => {
    const encounter = await create();
    await create(otherPatient.idUser);
    const other = await source
      .getRepository(MedicalRecord)
      .findOneByOrFail({ idPatient: otherPatient.idUser });
    expect(await source.getRepository(MedicalRecord).count()).toBe(2);
    await expect(
      source.query('UPDATE encounters SET id_medical_record = $1 WHERE id_encounter = $2', [
        other.idMedicalRecord,
        encounter.idEncounter,
      ]),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
    const stored = await source.getRepository(Encounter).findOneOrFail({
      where: { idEncounter: encounter.idEncounter },
      relations: { medicalRecord: true },
    });
    expect(stored.medicalRecord.idPatient).toBe(patient.idUser);
  });
  it('enforces uniqueness, required record, references and physical deletion restrictions', async () => {
    await create();
    const records = source.getRepository(MedicalRecord);
    const record = await records.findOneByOrFail({ idPatient: patient.idUser });
    await expect(records.insert({ idPatient: patient.idUser })).rejects.toMatchObject({
      driverError: { code: '23505' },
    });
    await expect(records.insert({ idPatient: 999999 })).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
    await expect(
      source.query('UPDATE encounters SET id_medical_record = NULL'),
    ).rejects.toMatchObject({ driverError: { code: '23502' } });
    await expect(records.delete(record.idMedicalRecord)).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
    await expect(source.getRepository(User).delete(patient.idUser)).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
  });
  it('rolls back a new record when the encounter fails its SQL constraint', async () => {
    await expect(create(patient.idUser, 0, '')).rejects.toMatchObject({
      driverError: { code: '23514' },
    });
    expect(await source.getRepository(MedicalRecord).count()).toBe(0);
    expect(await source.getRepository(Encounter).count()).toBe(0);
  });
  it('preserves an existing record and its encounters when a later encounter fails', async () => {
    await create();
    await expect(create(patient.idUser, 1, '')).rejects.toMatchObject({
      driverError: { code: '23514' },
    });
    expect(await source.getRepository(MedicalRecord).count()).toBe(1);
    expect(await source.getRepository(Encounter).count()).toBe(1);
  });
  it('retains clinical history through patient deactivation and soft deletion', async () => {
    await create();
    await source.getRepository(User).update(patient.idUser, { isActive: false });
    expect(await source.getRepository(MedicalRecord).count()).toBe(1);
    await source.getRepository(User).softDelete(patient.idUser);
    const record = await source
      .getRepository(MedicalRecord)
      .findOneOrFail({ where: { idPatient: patient.idUser }, relations: { encounters: true } });
    expect(record.encounters).toHaveLength(1);
    await expect(create()).rejects.toThrow('Paciente activo no encontrado');
    expect(await source.getRepository(MedicalRecord).count()).toBe(1);
  });
  it('does not duplicate even an inactive or soft-deleted medical record', async () => {
    await create();
    const records = source.getRepository(MedicalRecord);
    const first = await records.findOneByOrFail({ idPatient: patient.idUser });
    await records.update(first.idMedicalRecord, { isActive: false });
    await records.softDelete(first.idMedicalRecord);
    await create(patient.idUser, 1);
    const record = await records.findOneOrFail({
      where: { idPatient: patient.idUser },
      withDeleted: true,
      relations: { encounters: true },
    });
    expect(record.idMedicalRecord).toBe(first.idMedicalRecord);
    expect(record.isActive).toBe(false);
    expect(record.deletedAt).not.toBeNull();
    expect(record.encounters).toHaveLength(2);
    expect(await records.count({ withDeleted: true })).toBe(1);
  });
  it('backfills legacy encounters without changing data, including inactive and deleted patients', async () => {
    await migrate('down');
    await source.query(
      `INSERT INTO encounters (id_patient, id_doctor, id_specialty, occurred_at, summary, is_active, created_by, deleted_at)
      VALUES ($1, $3, $4, now(), 'First legacy', true, $5, NULL),
             ($1, $3, $4, now(), 'Deleted legacy', false, $5, now()),
             ($2, $3, $4, now(), 'Other legacy', true, $5, NULL)`,
      [
        patient.idUser,
        otherPatient.idUser,
        doctors[0].idDoctor,
        specialty.idSpecialty,
        physicians[0].idUser,
      ],
    );
    await source.getRepository(User).update(patient.idUser, { isActive: false });
    await source.getRepository(User).softDelete(otherPatient.idUser);
    const before: unknown = await source.query('SELECT * FROM encounters ORDER BY id_encounter');
    await migrate('up');
    const after: Record<string, unknown>[] = await source.query(
      'SELECT * FROM encounters ORDER BY id_encounter',
    );
    expect(
      after.map((row) => {
        const { id_medical_record: recordId, ...columns } = row;
        expect(recordId).toEqual(expect.any(Number));
        return columns;
      }),
    ).toEqual(before);
    expect(await source.getRepository(MedicalRecord).count()).toBe(2);
    const rows: { id_patient: number; id_medical_record: number; record_patient: number }[] =
      await source.query(`SELECT encounter.id_patient, encounter.id_medical_record, record.id_patient AS record_patient
      FROM encounters encounter JOIN medical_records record USING (id_medical_record) ORDER BY id_encounter`);
    expect(rows.every((row) => row.id_patient === row.record_patient)).toBe(true);
    expect(rows[0].id_medical_record).toBe(rows[1].id_medical_record);
    await migrate('down');
    expect(await source.query('SELECT * FROM encounters ORDER BY id_encounter')).toEqual(before);
    await migrate('up');
  });
});
