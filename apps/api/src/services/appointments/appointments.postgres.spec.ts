import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Appointment } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { ScheduleHistory } from 'src/entities/schedules/schedule-history.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { AvailabilityQueryDto } from 'src/dtos/schedules/availability-query.dto';
import { CreateAppointments1792450000000 } from 'src/database/migrations/1792450000000-CreateAppointments';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';

// Uses an isolated, disposable schema. Never reads the application's DATABASE_URL.
const postgres = process.env.APPOINTMENTS_TEST_DATABASE_URL ? describe : describe.skip;
postgres('Appointment booking against PostgreSQL', () => {
  let source: DataSource;
  let admin: DataSource;
  let service: AppointmentsService;
  let schedules: SchedulesService;
  let patient: User;
  let other: User;
  let doctor: Doctor;
  let specialty: Specialty;
  let schedule: Schedule;
  const schema = `booking_${randomUUID().replace(/-/g, '')}`;
  const date = '2099-11-02';
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
      extra: { options: `-c search_path=${schema},public`, max: 12 },
      entities: [
        Appointment,
        Schedule,
        ScheduleHistory,
        Doctor,
        User,
        Specialty,
        Role,
        Permission,
        UserSession,
      ],
      synchronize: true,
    }).initialize();
    // Exercise the actual production migration rather than relying on synchronize for appointments.
    await source.query(`DROP TABLE "${schema}".appointments`);
    const runner = source.createQueryRunner();
    await new CreateAppointments1792450000000().up(runner);
    await runner.release();
    schedules = new SchedulesService(source);
    service = new AppointmentsService(source, schedules);
  }, 30000);
  beforeEach(async () => {
    await source.query(
      'TRUNCATE appointments, schedule_history, schedules, doctor_specialty, doctors, user_role, users, role_permission, roles, specialties RESTART IDENTITY CASCADE',
    );
    const patientRole = await source.getRepository(Role).save({ name: 'PATIENT' });
    const doctorRole = await source.getRepository(Role).save({ name: 'DOCTOR' });
    const users = source.getRepository(User);
    patient = await users.save({
      email: 'patient@example.test',
      password: 'unused',
      name: 'Patient',
      lastname: 'Test',
      ci: '1',
      roles: [patientRole],
    });
    other = await users.save({
      email: 'other@example.test',
      password: 'unused',
      name: 'Other',
      lastname: 'Test',
      ci: '2',
      roles: [patientRole],
    });
    const doctorUser = await users.save({
      email: 'doctor@example.test',
      password: 'unused',
      name: 'Doctor',
      lastname: 'Test',
      ci: '3',
      roles: [doctorRole],
    });
    specialty = await source.getRepository(Specialty).save({ name: 'Cardiología' });
    doctor = await source
      .getRepository(Doctor)
      .save({ user: doctorUser, specialties: [specialty] });
    schedule = await source
      .getRepository(Schedule)
      .save({ doctor, specialty, date, startTime: '09:00', endTime: '10:00' });
  });
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.destroy();
    }
  });
  const dto = () => ({ idSchedule: schedule.idSchedule, expectedVersion: schedule.version });
  const availability = () =>
    schedules.availability(
      Object.assign(new AvailabilityQueryDto(), { idDoctor: doctor.idDoctor, date }),
    );

  it('reserves a complete block, snapshots associations and removes it from paginated availability', async () => {
    expect((await availability()).meta.total).toBe(1);
    const result = await service.create(dto(), patient.idUser);
    expect(result).toMatchObject({
      idPatient: patient.idUser,
      idDoctor: doctor.idDoctor,
      idSpecialty: specialty.idSpecialty,
      idSchedule: schedule.idSchedule,
      date,
      startTime: '09:00:00',
      endTime: '10:00:00',
      status: 'RESERVED',
    });
    expect(await availability()).toMatchObject({ data: [], meta: { total: 0 } });
    const stored = await source
      .getRepository(Appointment)
      .findOneByOrFail({ idAppointment: result.idAppointment });
    expect(stored.createdBy).toBe(patient.idUser);
    await expect(service.create(dto(), other.idUser)).rejects.toBeInstanceOf(ConflictException);
    await expect(
      schedules.update(
        schedule.idSchedule,
        {
          idSpecialty: specialty.idSpecialty,
          date,
          startTime: '09:00',
          endTime: '10:00',
          isActive: false,
          expectedVersion: schedule.version,
        },
        doctor.user.idUser,
      ),
    ).rejects.toThrow('cita reservada');
  });
  it('serializes simultaneous requests so exactly one patient obtains the block', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        service.create(dto(), index % 2 ? patient.idUser : other.idUser),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results)
      if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(ConflictException);
    expect(await source.getRepository(Appointment).count()).toBe(1);
  });
  it('has a database uniqueness constraint even for writers bypassing the service', async () => {
    await service.create(dto(), patient.idUser);
    await expect(
      source.getRepository(Appointment).save({
        schedule,
        patient: other,
        doctor,
        specialty,
        date,
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'UQ_appointments_schedule' },
    });
  });
  it('rejects nonexistent and changed schedules', async () => {
    await expect(service.create({ ...dto(), idSchedule: 999999 }, patient.idUser)).rejects.toThrow(
      'no encontrado',
    );
    await expect(
      service.create({ ...dto(), expectedVersion: 99 }, patient.idUser),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await source.getRepository(Appointment).count()).toBe(0);
  });
  it.each(['schedule', 'doctor', 'specialty', 'doctor-user', 'assignment', 'doctor-role', 'past'])(
    'rejects unavailable %s through the service and availability API',
    async (invalid) => {
      if (invalid === 'schedule')
        await source.getRepository(Schedule).update(schedule.idSchedule, { isActive: false });
      if (invalid === 'doctor')
        await source.getRepository(Doctor).update(doctor.idDoctor, { isActive: false });
      if (invalid === 'specialty')
        await source.getRepository(Specialty).update(specialty.idSpecialty, { isActive: false });
      if (invalid === 'doctor-user')
        await source.getRepository(User).update(doctor.user.idUser, { isActive: false });
      if (invalid === 'assignment')
        await source
          .createQueryBuilder()
          .relation(Doctor, 'specialties')
          .of(doctor)
          .remove(specialty);
      if (invalid === 'doctor-role')
        await source.getRepository(Role).update({ name: 'DOCTOR' }, { isActive: false });
      if (invalid === 'past')
        await source.getRepository(Schedule).update(schedule.idSchedule, { date: '2000-01-01' });
      const current = await source
        .getRepository(Schedule)
        .findOneByOrFail({ idSchedule: schedule.idSchedule });
      await expect(
        service.create({ ...dto(), expectedVersion: current.version }, patient.idUser),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await availability()).meta.total).toBe(0);
      expect(await source.getRepository(Appointment).count()).toBe(0);
    },
  );
  it('requires an active patient account even when the permission was granted to a different profile', async () => {
    await expect(service.create(dto(), doctor.user.idUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await source.getRepository(User).update(patient.idUser, { isActive: false });
    await expect(service.create(dto(), patient.idUser)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rechecks a schedule edited while booking waits for the shared doctor lock', async () => {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager
        .getRepository(Doctor)
        .findOne({ where: { idDoctor: doctor.idDoctor }, lock: { mode: 'pessimistic_write' } });
      const pending = service.create(dto(), patient.idUser);
      await runner.manager.getRepository(Schedule).update(schedule.idSchedule, { isActive: false });
      await runner.commitTransaction();
      await expect(pending).rejects.toBeInstanceOf(ConflictException);
      expect(await source.getRepository(Appointment).count()).toBe(0);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
