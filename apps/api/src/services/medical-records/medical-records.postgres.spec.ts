import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';
import { EncountersService } from '../encounters/encounters.service';
import { SchedulesService } from '../schedules/schedules.service';
import { MedicalRecordAccess } from 'src/entities/medical-records/medical-record-access.entity';
import { MedicalRecord } from 'src/entities/medical-records/medical-record.entity';
import { MedicalRecordAccesses1793318400000 } from 'src/database/migrations/1793318400000-MedicalRecordAccesses';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { AppointmentsService } from '../appointments/appointments.service';
import { DoctorAgendaQueryDto } from 'src/dtos/appointments/doctor-agenda-query.dto';

const postgres = process.env.APPOINTMENTS_TEST_DATABASE_URL ? describe : describe.skip;
postgres('Clinical read isolation and access context in PostgreSQL', () => {
  const schema = `clinical_read_${randomUUID().replace(/-/g, '')}`;
  let source: DataSource;
  let admin: DataSource;
  let service: MedicalRecordsService;
  let encounters: EncountersService;
  let schedules: SchedulesService;
  let patient: User;
  let other: User;
  let doctors: Doctor[];
  let physicians: User[];
  let specialty: Specialty;
  let appointment: Appointment;
  let otherAppointment: Appointment;
  const query = Object.assign(new PaginationQueryDto(), { limit: 1 });
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
      extra: { options: `-c search_path=${schema},public` },
      entities: [
        MedicalRecordAccess,
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
    await source.query('DROP TABLE medical_record_accesses');
    const runner = source.createQueryRunner();
    try {
      await new MedicalRecordAccesses1793318400000().up(runner);
    } finally {
      await runner.release();
    }
    schedules = new SchedulesService(source);
    service = new MedicalRecordsService(source, schedules);
    encounters = new EncountersService(source, schedules);
  }, 30000);
  beforeEach(async () => {
    await source.query(
      'TRUNCATE medical_record_accesses, encounters, medical_records, appointments, schedules, doctor_specialty, doctors, user_role, users, role_permission, roles, specialties RESTART IDENTITY CASCADE',
    );
    const role = await source.getRepository(Role).save({ name: 'DOCTOR' });
    const patientRole = await source.getRepository(Role).save({ name: 'PATIENT' });
    const users = source.getRepository(User);
    patient = await users.save({
      name: 'Luis',
      lastname: 'Patient',
      email: 'patient@example.test',
      ci: 'p1',
      password: 'never-return',
      roles: [patientRole],
    });
    other = await users.save({
      name: 'Other',
      lastname: 'Patient',
      email: 'other@example.test',
      ci: 'p2',
      password: 'never-return',
      roles: [patientRole],
    });
    physicians = await users.save([
      {
        name: 'Ana',
        lastname: 'Doctor',
        email: 'one@example.test',
        ci: 'd1',
        password: 'never-return',
        roles: [role],
      },
      {
        name: 'Bea',
        lastname: 'Doctor',
        email: 'two@example.test',
        ci: 'd2',
        password: 'never-return',
        roles: [role],
      },
    ]);
    specialty = await source.getRepository(Specialty).save({ name: 'General' });
    doctors = await source
      .getRepository(Doctor)
      .save(physicians.map((user) => ({ user, specialties: [specialty] })));
    const blocks = await source.getRepository(Schedule).save([
      { doctor: doctors[0], specialty, date: '2099-01-01', startTime: '09:00', endTime: '10:00' },
      { doctor: doctors[1], specialty, date: '2000-01-01', startTime: '09:00', endTime: '10:00' },
    ]);
    [appointment, otherAppointment] = await source.getRepository(Appointment).save([
      {
        doctor: doctors[0],
        patient,
        specialty,
        schedule: blocks[0],
        date: blocks[0].date,
        startTime: blocks[0].startTime,
        endTime: blocks[0].endTime,
        status: AppointmentStatus.RESERVED,
      },
      {
        doctor: doctors[1],
        patient: other,
        specialty,
        schedule: blocks[1],
        date: blocks[1].date,
        startTime: blocks[1].startTime,
        endTime: blocks[1].endTime,
        status: AppointmentStatus.RESERVED,
      },
    ]);
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.destroy();
    }
  });
  async function add(idPatient = patient.idUser, physician = 0, summary = 'Clinical content') {
    return encounters.create(
      { idPatient, idSpecialty: specialty.idSpecialty, summary },
      physicians[physician].idUser,
    );
  }
  async function read(page = 1) {
    return service.byAppointment(appointment.idAppointment, physicians[0].idUser, {
      ...query,
      page,
    });
  }

  it('returns the general history across specialists with scoped totals and stable descending pagination', async () => {
    const first = await add(patient.idUser, 0, 'First doctor');
    const second = await add(patient.idUser, 1, 'Other specialist');
    await add(other.idUser, 1, 'PRIVATE-OTHER');
    await source.getRepository(Encounter).update([first.idEncounter, second.idEncounter], {
      occurredAt: new Date('2026-10-01T13:00:00Z'),
    });
    const result = await read();
    expect(result.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(result.data[0]).toEqual({
      idEncounter: second.idEncounter,
      occurredAt: new Date('2026-10-01T13:00:00Z'),
      summary: 'Other specialist',
      doctor: { name: 'Bea', lastname: 'Doctor' },
      specialty: { name: 'General' },
    });
    expect((await read(2)).data[0].idEncounter).toBe(first.idEncounter);
    expect((await read(3)).data).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE-OTHER|idPatient|idUser|email|password|createdBy|roles|permissions/,
    );
    const accesses = await source.getRepository(MedicalRecordAccess).find({
      relations: {
        actor: true,
        patient: true,
        doctor: true,
        appointment: true,
        medicalRecord: true,
      },
    });
    expect(accesses).toHaveLength(3);
    expect(accesses[0].actor.idUser).toBe(physicians[0].idUser);
    expect(accesses[0].patient.idUser).toBe(patient.idUser);
    expect(accesses[0].doctor.idDoctor).toBe(doctors[0].idDoctor);
    expect(accesses[0].appointment.idAppointment).toBe(appointment.idAppointment);
    expect(accesses[0].medicalRecord?.idPatient).toBe(patient.idUser);
    expect(accesses[0].accessedAt).toBeInstanceOf(Date);
    const raw: Record<string, unknown>[] = await source.query(
      'SELECT * FROM medical_record_accesses',
    );
    expect(JSON.stringify(raw)).not.toMatch(/First doctor|Other specialist|summary|password|email/);
  });
  it('denies another doctor using a foreign appointment, and a doctor using another patients appointment', async () => {
    await add();
    await expect(
      service.byAppointment(appointment.idAppointment, physicians[1].idUser, query),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.byAppointment(otherAppointment.idAppointment, physicians[0].idUser, query),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.byAppointment(99999, physicians[0].idUser, query)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await source.getRepository(MedicalRecordAccess).count()).toBe(0);
  });
  it('returns and audits an empty history without creating one', async () => {
    expect(await read()).toEqual({
      data: [],
      meta: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });
    expect(await source.getRepository(MedicalRecord).count()).toBe(0);
    expect(
      (await source.query('SELECT id_medical_record FROM medical_record_accesses')) as unknown,
    ).toEqual([{ id_medical_record: null }]);
  });
  it.each([AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED])(
    'denies %s appointments and hides the agenda action',
    async (status) => {
      await source.getRepository(Appointment).update(appointment.idAppointment, { status });
      await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
      const agenda = await new AppointmentsService(source, schedules).agenda(
        physicians[0].idUser,
        Object.assign(new DoctorAgendaQueryDto(), { date: appointment.date }),
      );
      expect(agenda.data[0].canReadMedicalRecord).toBe(false);
      expect(await source.getRepository(MedicalRecordAccess).count()).toBe(0);
    },
  );
  it('reflects eligibility in the agenda without exposing the patient state fields', async () => {
    const appointments = new AppointmentsService(source, schedules);
    const args = Object.assign(new DoctorAgendaQueryDto(), { date: appointment.date });
    expect(
      (await appointments.agenda(physicians[0].idUser, args)).data[0].canReadMedicalRecord,
    ).toBe(true);
    await source.getRepository(User).update(patient.idUser, { isActive: false });
    const agenda = await appointments.agenda(physicians[0].idUser, args);
    expect(agenda.data[0].canReadMedicalRecord).toBe(false);
    expect(agenda.data[0].patient).not.toHaveProperty('isActive');
    expect(agenda.data[0].patient).not.toHaveProperty('deletedAt');
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['inactive', 'deleted'])('denies %s appointments and patients', async (state) => {
    if (state === 'inactive')
      await source
        .getRepository(Appointment)
        .update(appointment.idAppointment, { isActive: false });
    else await source.getRepository(Appointment).softDelete(appointment.idAppointment);
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
    await source.getRepository(Appointment).restore(appointment.idAppointment);
    await source.getRepository(Appointment).update(appointment.idAppointment, { isActive: true });
    if (state === 'inactive')
      await source.getRepository(User).update(patient.idUser, { isActive: false });
    else await source.getRepository(User).softDelete(patient.idUser);
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('excludes inactive or deleted encounters, preserving historical author and specialty labels', async () => {
    await add();
    const inactive = await add();
    const deleted = await add();
    await source.getRepository(Encounter).update(inactive.idEncounter, { isActive: false });
    await source.getRepository(Encounter).softDelete(deleted.idEncounter);
    const historical = await add(patient.idUser, 1, 'Historical doctor');
    await source.getRepository(Doctor).softDelete(doctors[1].idDoctor);
    await source.getRepository(User).softDelete(physicians[1].idUser);
    await source.getRepository(Specialty).softDelete(specialty.idSpecialty);
    const result = await read();
    expect(result.meta.total).toBe(2);
    expect(result.data[0].idEncounter).toBe(historical.idEncounter);
    expect(result.data[0].doctor.name).toBe('Bea');
    expect(result.data[0].specialty.name).toBe('General');
  });
  it.each(['inactive', 'deleted'])('denies %s histories and medical profiles', async (state) => {
    await add();
    const records = source.getRepository(MedicalRecord);
    const record = await records.findOneByOrFail({ idPatient: patient.idUser });
    if (state === 'inactive') await records.update(record.idMedicalRecord, { isActive: false });
    else await records.softDelete(record.idMedicalRecord);
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
    await records.restore(record.idMedicalRecord);
    await records.update(record.idMedicalRecord, { isActive: true });
    if (state === 'inactive')
      await source.getRepository(Doctor).update(doctors[0].idDoctor, { isActive: false });
    else await source.getRepository(Doctor).softDelete(doctors[0].idDoctor);
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('requires a live doctor account and role independently of an existing relationship', async () => {
    await source.getRepository(User).update(physicians[0].idUser, { isActive: false });
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
    await source.getRepository(User).update(physicians[0].idUser, { isActive: true });
    await source.getRepository(Role).update({ name: 'DOCTOR' }, { isActive: false });
    await expect(read()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('fails closed if the durable access record cannot be written', async () => {
    await add();
    await source.query(
      `ALTER TABLE medical_record_accesses ADD CONSTRAINT "test_deny_access_insert" CHECK (id_actor < 0)`,
    );
    try {
      await expect(read()).rejects.toMatchObject({ driverError: { code: '23514' } });
    } finally {
      await source.query(
        'ALTER TABLE medical_record_accesses DROP CONSTRAINT "test_deny_access_insert"',
      );
    }
    expect(await source.getRepository(MedicalRecordAccess).count()).toBe(0);
  });
});
