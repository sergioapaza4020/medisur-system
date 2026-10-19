import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { ScheduleHistory } from 'src/entities/schedules/schedule-history.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PatientSelectionQueryDto } from 'src/dtos/appointments/patient-selection-query.dto';
import { DoctorAgendaQueryDto } from 'src/dtos/appointments/doctor-agenda-query.dto';
import { AppointmentsQueryDto } from 'src/dtos/appointments/appointments-query.dto';
import { AvailabilityQueryDto } from 'src/dtos/schedules/availability-query.dto';
import { AppointmentCancellation1792540000000 } from 'src/database/migrations/1792540000000-AppointmentCancellation';
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
    await new AppointmentCancellation1792540000000().up(runner);
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
  it('isolates patients, filters by date/status/period and counts only their own appointments', async () => {
    const repository = source.getRepository(Appointment);
    const own = await service.create(dto(), patient.idUser);
    const otherSchedule = await source
      .getRepository(Schedule)
      .save({ doctor, specialty, date, startTime: '11:00', endTime: '12:00' });
    await service.create(
      { idSchedule: otherSchedule.idSchedule, expectedVersion: otherSchedule.version },
      other.idUser,
    );
    const pastSchedule = await source
      .getRepository(Schedule)
      .save({ doctor, specialty, date: '2000-01-01', startTime: '09:00', endTime: '10:00' });
    const past = await repository.save({
      schedule: pastSchedule,
      patient,
      doctor,
      specialty,
      date: pastSchedule.date,
      startTime: '09:00',
      endTime: '10:00',
    });
    const query = (filters: Partial<AppointmentsQueryDto> = {}) =>
      Object.assign(new AppointmentsQueryDto(), filters);
    const upcoming = await service.mine(patient.idUser, query());
    expect(upcoming.meta.total).toBe(1);
    expect(upcoming.data.map((row) => row.idAppointment)).toEqual([own.idAppointment]);
    const previous = await service.mine(patient.idUser, query({ period: 'past' }));
    expect(previous.data.map((row) => row.idAppointment)).toEqual([past.idAppointment]);
    expect(
      (await service.mine(patient.idUser, query({ period: 'all', limit: 1, page: 2 }))).meta,
    ).toMatchObject({ total: 2, totalPages: 2 });
    expect((await service.mine(other.idUser, query({ period: 'all' }))).meta.total).toBe(1);
    expect(
      (
        await service.mine(
          patient.idUser,
          query({ period: 'all', date: '2000-01-01', status: past.status }),
        )
      ).data.map((row) => row.idAppointment),
    ).toEqual([past.idAppointment]);
    expect((await service.mine(patient.idUser, query({ date: '2099-11-03' }))).data).toEqual([]);
    await repository.update(past.idAppointment, { status: 'OTHER' as Appointment['status'] });
    expect(
      (await service.mine(patient.idUser, query({ period: 'all', status: own.status }))).meta.total,
    ).toBe(1);
  });
  it('keeps historical doctor and specialty names after deactivation or soft deletion', async () => {
    await service.create(dto(), patient.idUser);
    await source.getRepository(Doctor).softDelete(doctor.idDoctor);
    await source.getRepository(User).softDelete(doctor.user.idUser);
    await source.getRepository(Specialty).update(specialty.idSpecialty, { isActive: false });
    const result = await service.mine(patient.idUser, new AppointmentsQueryDto());
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      doctor: { name: 'Doctor', lastname: 'Test' },
      specialty: { name: specialty.name },
    });
  });
  it('books for a different active patient and records the administrative actor', async () => {
    const result = await service.createForPatient(
      { ...dto(), idPatient: patient.idUser },
      other.idUser,
    );
    expect(result.idPatient).toBe(patient.idUser);
    const stored = await source.getRepository(Appointment).findOneOrFail({
      where: { idAppointment: result.idAppointment },
      relations: { patient: true },
    });
    expect(stored.patient.idUser).toBe(patient.idUser);
    expect(stored.createdBy).toBe(other.idUser);
    expect((await service.mine(other.idUser, new AppointmentsQueryDto())).data).toEqual([]);
    expect((await availability()).meta.total).toBe(0);
    await expect(
      service.createForPatient({ ...dto(), idPatient: patient.idUser }, other.idUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('serializes patient and reception requests competing for the same block', async () => {
    const results = await Promise.allSettled([
      service.create(dto(), patient.idUser),
      service.createForPatient({ ...dto(), idPatient: other.idUser }, patient.idUser),
      service.createForPatient({ ...dto(), idPatient: patient.idUser }, other.idUser),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results)
      if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(ConflictException);
    expect(await source.getRepository(Appointment).count()).toBe(1);
  });
  it.each(['missing', 'inactive', 'wrong-role', 'inactive-role', 'deleted'])(
    'rejects an administrative target that becomes %s',
    async (invalid) => {
      let idPatient = patient.idUser;
      if (invalid === 'missing') idPatient = 999999;
      if (invalid === 'inactive')
        await source.getRepository(User).update(patient.idUser, { isActive: false });
      if (invalid === 'wrong-role') idPatient = doctor.user.idUser;
      if (invalid === 'inactive-role')
        await source.getRepository(Role).update({ name: 'PATIENT' }, { isActive: false });
      if (invalid === 'deleted') await source.getRepository(User).softDelete(patient.idUser);
      await expect(service.createForPatient({ ...dto(), idPatient }, other.idUser)).rejects.toThrow(
        'paciente',
      );
      expect(await source.getRepository(Appointment).count()).toBe(0);
    },
  );
  it.each(['doctor', 'specialty', 'schedule', 'past'])(
    'applies the same availability rules from reception for invalid %s',
    async (invalid) => {
      if (invalid === 'doctor')
        await source.getRepository(Doctor).update(doctor.idDoctor, { isActive: false });
      if (invalid === 'specialty')
        await source.getRepository(Specialty).update(specialty.idSpecialty, { isActive: false });
      if (invalid === 'schedule')
        await source.getRepository(Schedule).update(schedule.idSchedule, { isActive: false });
      if (invalid === 'past')
        await source.getRepository(Schedule).update(schedule.idSchedule, { date: '2000-01-01' });
      const current = await source
        .getRepository(Schedule)
        .findOneByOrFail({ idSchedule: schedule.idSchedule });
      await expect(
        service.createForPatient(
          {
            idSchedule: current.idSchedule,
            expectedVersion: current.version,
            idPatient: patient.idUser,
          },
          other.idUser,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(await source.getRepository(Appointment).count()).toBe(0);
    },
  );
  it('paginates only active patients with an active profile and exposes minimum identification data', async () => {
    const query = Object.assign(new PatientSelectionQueryDto(), {
      search: 'Pat',
      page: 1,
      limit: 1,
    });
    const result = await service.patients(query);
    expect(result.meta).toMatchObject({ total: 1, totalPages: 1 });
    expect(result.data).toEqual([
      { idUser: patient.idUser, name: patient.name, lastname: patient.lastname, ci: patient.ci },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/email|password|roles|createdBy|avatar/);
    expect((await service.patients({ ...query, search: 'Doc' })).data).toEqual([]);
    expect((await service.patients({ ...query, search: '%at' })).data).toEqual([]);
    await source.getRepository(User).update(patient.idUser, { isActive: false });
    expect((await service.patients(query)).meta.total).toBe(0);
    await source.getRepository(User).update(patient.idUser, { isActive: true });
    await source.getRepository(Role).update({ name: 'PATIENT' }, { isActive: false });
    expect((await service.patients(query)).meta.total).toBe(0);
  });
  it('isolates doctor agendas, filters dates/statuses and counts only the authenticated doctor appointments', async () => {
    const own = await service.create(dto(), patient.idUser);
    const doctorRole = await source.getRepository(Role).findOneByOrFail({ name: 'DOCTOR' });
    await source.getRepository(User).save({ ...other, roles: [doctorRole] });
    const secondDoctor = await source
      .getRepository(Doctor)
      .save({ user: other, specialties: [specialty] });
    const foreignSchedule = await source
      .getRepository(Schedule)
      .save({ doctor: secondDoctor, specialty, date, startTime: '09:00', endTime: '10:00' });
    await service.create(
      { idSchedule: foreignSchedule.idSchedule, expectedVersion: foreignSchedule.version },
      patient.idUser,
    );
    const secondSchedule = await source
      .getRepository(Schedule)
      .save({ doctor, specialty, date: '2099-11-03', startTime: '09:00', endTime: '10:00' });
    const changed = await service.create(
      { idSchedule: secondSchedule.idSchedule, expectedVersion: secondSchedule.version },
      patient.idUser,
    );
    await source
      .getRepository(Appointment)
      .update(changed.idAppointment, { status: AppointmentStatus.CANCELLED });
    const query = (filters: Partial<DoctorAgendaQueryDto>) =>
      Object.assign(new DoctorAgendaQueryDto(), filters);
    const day = await service.agenda(doctor.user.idUser, query({ date }));
    expect(day.meta.total).toBe(1);
    expect(day.data.map((row) => row.idAppointment)).toEqual([own.idAppointment]);
    expect(day.data[0].patient).toEqual({
      name: patient.name,
      lastname: patient.lastname,
      ci: patient.ci,
    });
    const range = await service.agenda(
      doctor.user.idUser,
      query({ from: date, to: '2099-11-03', limit: 1, page: 2 }),
    );
    expect(range.meta).toMatchObject({ total: 2, totalPages: 2 });
    for (const [from, to, expected] of [
      [date, date, [own.idAppointment]],
      ['2099-11-02', '2099-11-08', [own.idAppointment, changed.idAppointment]],
      ['2099-11-01', '2099-11-30', [own.idAppointment, changed.idAppointment]],
    ] as const) {
      const calendar = await service.agenda(
        doctor.user.idUser,
        query({
          from,
          to,
          mode: 'calendar',
          page: 3,
          limit: 1,
        }),
      );
      expect(calendar.data.map((row) => row.idAppointment)).toEqual(expected);
      expect(calendar.data[0].patient).toEqual({ name: patient.name, lastname: patient.lastname });
      expect(JSON.stringify(calendar)).not.toMatch(/"ci"|email|password|diagnosis|notes/);
    }
    expect(range.data[0]).toMatchObject({
      idAppointment: changed.idAppointment,
      status: 'CANCELLED',
    });
    const filtered = await service.agenda(
      doctor.user.idUser,
      query({ from: date, to: '2099-11-03', status: AppointmentStatus.CANCELLED }),
    );
    expect(filtered.data.map((row) => row.idAppointment)).toEqual([changed.idAppointment]);
    await source
      .getRepository(Appointment)
      .update(changed.idAppointment, { status: AppointmentStatus.RESCHEDULED });
    expect(
      (
        await service.agenda(
          doctor.user.idUser,
          query({ from: date, to: '2099-11-03', status: AppointmentStatus.RESCHEDULED }),
        )
      ).meta.total,
    ).toBe(1);
    expect((await service.agenda(secondDoctor.user.idUser, query({ date }))).meta.total).toBe(1);
    expect((await service.agenda(doctor.user.idUser, query({ date: '2099-11-04' }))).data).toEqual(
      [],
    );
    await source.getRepository(User).softDelete(patient.idUser);
    expect((await service.agenda(doctor.user.idUser, query({ date }))).data[0].patient.name).toBe(
      patient.name,
    );
    await source.getRepository(Appointment).softDelete(own.idAppointment);
    expect((await service.agenda(doctor.user.idUser, query({ date }))).meta.total).toBe(0);
  });
  it.each(['missing', 'inactive-doctor', 'inactive-user', 'inactive-role', 'deleted-doctor'])(
    'rejects agenda access with %s doctor profile',
    async (invalid) => {
      let idUser = doctor.user.idUser;
      if (invalid === 'missing') idUser = patient.idUser;
      if (invalid === 'inactive-doctor')
        await source.getRepository(Doctor).update(doctor.idDoctor, { isActive: false });
      if (invalid === 'inactive-user')
        await source.getRepository(User).update(idUser, { isActive: false });
      if (invalid === 'inactive-role')
        await source.getRepository(Role).update({ name: 'DOCTOR' }, { isActive: false });
      if (invalid === 'deleted-doctor')
        await source.getRepository(Doctor).softDelete(doctor.idDoctor);
      await expect(
        service.agenda(idUser, Object.assign(new DoctorAgendaQueryDto(), { date })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('cancels an own future reservation, preserves history and audit, and releases the block for a new patient', async () => {
    const booked = await service.create(dto(), patient.idUser);
    const before = await source
      .getRepository(Appointment)
      .findOneByOrFail({ idAppointment: booked.idAppointment });
    const result = await service.cancelMine(booked.idAppointment, patient.idUser);
    expect(result).toMatchObject({
      idAppointment: booked.idAppointment,
      status: 'CANCELLED',
      cancelledAt: expect.any(Date) as Date,
    });
    const stored = await source
      .getRepository(Appointment)
      .findOneByOrFail({ idAppointment: booked.idAppointment });
    expect(stored).toMatchObject({
      date: before.date,
      startTime: before.startTime,
      endTime: before.endTime,
      createdBy: before.createdBy,
      cancelledBy: patient.idUser,
      updatedBy: patient.idUser,
      status: 'CANCELLED',
      deletedAt: null,
    });
    expect(stored.cancelledAt).toBeInstanceOf(Date);
    expect((await availability()).meta.total).toBe(1);
    const next = await service.createForPatient(
      { ...dto(), idPatient: other.idUser },
      patient.idUser,
    );
    expect(next.idAppointment).not.toBe(booked.idAppointment);
    expect(await source.getRepository(Appointment).count()).toBe(2);
    expect((await availability()).meta.total).toBe(0);
    await expect(service.cancelMine(booked.idAppointment, patient.idUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const unchanged = await source
      .getRepository(Appointment)
      .findOneByOrFail({ idAppointment: booked.idAppointment });
    expect(unchanged.cancelledAt).toEqual(stored.cancelledAt);
    expect((await availability()).meta.total).toBe(0);
    const rollbackRunner = source.createQueryRunner();
    try {
      await expect(new AppointmentCancellation1792540000000().down(rollbackRunner)).rejects.toThrow(
        'históricas',
      );
    } finally {
      await rollbackRunner.release();
    }
    expect(await source.getRepository(Appointment).count()).toBe(2);
  });
  it('does not reveal or cancel another patient appointment or a nonexistent identifier', async () => {
    const booked = await service.create(dto(), patient.idUser);
    await expect(service.cancelMine(booked.idAppointment, other.idUser)).rejects.toThrow(
      'Cita propia no encontrada',
    );
    await expect(service.cancelMine(999999, patient.idUser)).rejects.toThrow(
      'Cita propia no encontrada',
    );
    expect(
      (
        await source
          .getRepository(Appointment)
          .findOneByOrFail({ idAppointment: booked.idAppointment })
      ).status,
    ).toBe('RESERVED');
    expect((await availability()).meta.total).toBe(0);
  });
  it.each(['CANCELLED', 'RESCHEDULED', 'COMPLETED', 'ATTENDED'])(
    'rejects cancelling incompatible state %s',
    async (status) => {
      const booked = await service.create(dto(), patient.idUser);
      await source
        .getRepository(Appointment)
        .update(booked.idAppointment, { status: status as AppointmentStatus });
      await expect(service.cancelMine(booked.idAppointment, patient.idUser)).rejects.toBeInstanceOf(
        ConflictException,
      );
      const stored = await source
        .getRepository(Appointment)
        .findOneByOrFail({ idAppointment: booked.idAppointment });
      expect(stored.status).toBe(status);
      expect(stored.cancelledAt).toBeNull();
      expect(stored.cancelledBy).toBeNull();
    },
  );
  it.each(['past', 'started', 'inactive', 'deleted'])(
    'rejects cancellation of %s appointments',
    async (invalid) => {
      const booked = await service.create(dto(), patient.idUser);
      const repository = source.getRepository(Appointment);
      if (invalid === 'past') await repository.update(booked.idAppointment, { date: '2000-01-01' });
      if (invalid === 'started')
        await source.query(
          `UPDATE appointments SET date = (clock_timestamp() AT TIME ZONE 'America/La_Paz')::date, start_time = (clock_timestamp() AT TIME ZONE 'America/La_Paz')::time, end_time = '23:59:59.999999' WHERE id_appointment = $1`,
          [booked.idAppointment],
        );
      if (invalid === 'inactive')
        await repository.update(booked.idAppointment, { isActive: false });
      if (invalid === 'deleted') await repository.softDelete(booked.idAppointment);
      await expect(service.cancelMine(booked.idAppointment, patient.idUser)).rejects.toThrow();
      const stored = await repository.findOneOrFail({
        where: { idAppointment: booked.idAppointment },
        withDeleted: true,
      });
      expect(stored.status).toBe('RESERVED');
      expect(stored.cancelledAt).toBeNull();
    },
  );
  it('handles duplicate cancellations and competing reservations without overwriting the cancelled history', async () => {
    const booked = await service.create(dto(), patient.idUser);
    const cancellations = await Promise.allSettled(
      Array.from({ length: 4 }, () => service.cancelMine(booked.idAppointment, patient.idUser)),
    );
    expect(cancellations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const reservations = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        service.create(dto(), index % 2 ? patient.idUser : other.idUser),
      ),
    );
    expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await source.getRepository(Appointment).count()).toBe(2);
    expect((await availability()).meta.total).toBe(0);
  });
  it('serializes cancellation and a new booking under the shared doctor lock', async () => {
    const booked = await service.create(dto(), patient.idUser);
    const [cancelled, reserved] = await Promise.allSettled([
      service.cancelMine(booked.idAppointment, patient.idUser),
      service.create(dto(), other.idUser),
    ]);
    expect(cancelled.status).toBe('fulfilled');
    if (reserved.status === 'rejected') {
      expect(reserved.reason).toBeInstanceOf(ConflictException);
      await service.create(dto(), other.idUser);
    }
    expect(await source.getRepository(Appointment).count()).toBe(2);
    expect((await availability()).meta.total).toBe(0);
  });
  it('keeps inactive schedules unavailable after cancellation and permits editing blocks with cancelled history', async () => {
    const booked = await service.create(dto(), patient.idUser);
    await service.cancelMine(booked.idAppointment, patient.idUser);
    await schedules.update(
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
    );
    expect((await availability()).meta.total).toBe(0);
    expect(
      (
        await source
          .getRepository(Appointment)
          .findOneByOrFail({ idAppointment: booked.idAppointment })
      ).date,
    ).toBe(date);
  });
  it('allows cancellation even when the related doctor profile was logically deleted', async () => {
    const booked = await service.create(dto(), patient.idUser);
    await source.getRepository(Doctor).softDelete(doctor.idDoctor);
    await expect(service.cancelMine(booked.idAppointment, patient.idUser)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    expect((await availability()).meta.total).toBe(0);
  });

  it('supports the cancellation migration round trip without deleting appointments when the old uniqueness rule is restorable', async () => {
    await service.create(dto(), patient.idUser);
    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      const migration = new AppointmentCancellation1792540000000();
      await migration.down(runner);
      await migration.up(runner);
      await runner.commitTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
    expect(await source.getRepository(Appointment).count()).toBe(1);
  });
});
