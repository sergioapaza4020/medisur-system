import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Encounter } from 'src/entities/encounters/encounter.entity';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { CreateEncounters1792886400000 } from 'src/database/migrations/1792886400000-CreateEncounters';
import { SchedulesService } from '../schedules/schedules.service';
import { EncountersService } from './encounters.service';

// Same dedicated test connection as the appointment suite; never uses DATABASE_URL.
const postgres = process.env.APPOINTMENTS_TEST_DATABASE_URL ? describe : describe.skip;
postgres('Encounter migration and persistence in PostgreSQL', () => {
  const schema = `encounters_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let source: DataSource;
  let service: EncountersService;
  let patient: User;
  let physician: User;
  let specialty: Specialty;
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
    const runner = source.createQueryRunner();
    try {
      await new CreateEncounters1792886400000().up(runner);
    } finally {
      await runner.release();
    }
    const patientRole = await source.getRepository(Role).save({ name: 'PATIENT' });
    const doctorRole = await source.getRepository(Role).save({ name: 'DOCTOR' });
    patient = await source.getRepository(User).save({
      name: 'Patient',
      lastname: 'Test',
      email: 'patient@example.test',
      ci: '1',
      password: 'unused',
      roles: [patientRole],
    });
    physician = await source.getRepository(User).save({
      name: 'Doctor',
      lastname: 'Test',
      email: 'doctor@example.test',
      ci: '2',
      password: 'unused',
      roles: [doctorRole],
    });
    specialty = await source.getRepository(Specialty).save({ name: 'General' });
    await source.getRepository(Doctor).save({ user: physician, specialties: [specialty] });
    service = new EncountersService(source, new SchedulesService(source));
  }, 30000);
  afterAll(async () => {
    if (source?.isInitialized) await source.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.destroy();
    }
  });
  it('appends concurrent records, keeps clinical text hidden by default and restricts physical patient deletion', async () => {
    const input = {
      idPatient: patient.idUser,
      idSpecialty: specialty.idSpecialty,
      summary: 'Clinical summary',
    };
    const receipts = await Promise.all([
      service.create(input, physician.idUser),
      service.create(input, physician.idUser),
    ]);
    expect(receipts[0].idEncounter).not.toBe(receipts[1].idEncounter);
    expect(await source.getRepository(Encounter).count()).toBe(2);
    const records = await source.getRepository(Encounter).find();
    expect(records.every((record) => record.summary === undefined)).toBe(true);
    const stored = await source
      .getRepository(Encounter)
      .createQueryBuilder('encounter')
      .addSelect('encounter.summary')
      .getMany();
    expect(stored.map((record) => record.summary)).toEqual([
      'Clinical summary',
      'Clinical summary',
    ]);
    await expect(source.getRepository(User).delete(patient.idUser)).rejects.toMatchObject({
      driverError: { code: '23503' },
    });
    await source.getRepository(User).softDelete(patient.idUser);
    expect(await source.getRepository(Encounter).count()).toBe(2);
  });
  it('rolls back invalid relations without appending a partial encounter', async () => {
    const before = await source.getRepository(Encounter).count();
    await expect(
      service.create(
        { idPatient: 999999, idSpecialty: specialty.idSpecialty, summary: 'Text' },
        physician.idUser,
      ),
    ).rejects.toThrow('Paciente activo no encontrado');
    expect(await source.getRepository(Encounter).count()).toBe(before);
  });

  it('binds the actual appointment relations and denies a different medical profile', async () => {
    await source.getRepository(User).restore(patient.idUser);
    const doctor = await source
      .getRepository(Doctor)
      .findOneByOrFail({ user: { idUser: physician.idUser } });
    const schedule = await source
      .getRepository(Schedule)
      .save({ doctor, specialty, date: '2000-01-01', startTime: '09:00', endTime: '10:00' });
    const appointment = await source.getRepository(Appointment).save({
      doctor,
      patient,
      specialty,
      schedule,
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: AppointmentStatus.RESERVED,
    });
    const receipt = await service.create(
      { idAppointment: appointment.idAppointment, summary: 'Appointment encounter' },
      physician.idUser,
    );
    expect(receipt).toMatchObject({
      idPatient: patient.idUser,
      idDoctor: doctor.idDoctor,
      idSpecialty: specialty.idSpecialty,
      idAppointment: appointment.idAppointment,
    });
    const role = await source.getRepository(Role).findOneByOrFail({ name: 'DOCTOR' });
    const otherUser = await source.getRepository(User).save({
      name: 'Other',
      lastname: 'Doctor',
      email: 'other@example.test',
      ci: '3',
      password: 'unused',
      roles: [role],
    });
    await source.getRepository(Doctor).save({ user: otherUser, specialties: [specialty] });
    await expect(
      service.create(
        { idAppointment: appointment.idAppointment, summary: 'Unauthorized' },
        otherUser.idUser,
      ),
    ).rejects.toThrow('Cita propia no encontrada');
    await expect(
      service.create(
        {
          idAppointment: appointment.idAppointment,
          idPatient: otherUser.idUser,
          summary: 'Wrong patient',
        },
        physician.idUser,
      ),
    ).rejects.toThrow('El paciente y la especialidad deben corresponder a la cita');
    expect(
      await source
        .getRepository(Encounter)
        .countBy({ appointment: { idAppointment: appointment.idAppointment } }),
    ).toBe(1);
  });
});
