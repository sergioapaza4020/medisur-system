import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { DoctorAgendaQueryDto } from 'src/dtos/appointments/doctor-agenda-query.dto';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';
class QuerySource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}
describe('Doctor agenda SQL and scope', () => {
  const source = new QuerySource({
    type: 'postgres',
    entities: [Appointment, Schedule, Doctor, User, Specialty, Role, Permission, UserSession],
  });
  const schedules = new SchedulesService(source);
  const service = new AppointmentsService(source, schedules);
  let doctorLookup: jest.SpyInstance;
  beforeAll(async () => {
    await source.prepare();
  });
  beforeEach(() => {
    doctorLookup = jest
      .spyOn(source.getRepository(Doctor), 'findOne')
      .mockResolvedValue({ idDoctor: 3 } as Doctor);
  });
  afterEach(() => jest.restoreAllMocks());
  it('reuses active doctor validation and scopes both records and totals before pagination', async () => {
    const repository = source.getRepository(Appointment);
    const qb = repository.createQueryBuilder('appointment');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([
      [
        {
          idAppointment: 9,
          patient: {
            name: 'Ana',
            lastname: 'Pérez',
            ci: '123456',
            email: 'private',
            password: 'private',
          },
          specialty: { name: 'Cardiología' },
          date: '2026-11-02',
          startTime: '09:00:00',
          endTime: '10:00:00',
          status: AppointmentStatus.RESCHEDULED,
          createdBy: 99,
        } as Appointment,
      ],
      12,
    ]);
    const result = await service.agenda(
      7,
      Object.assign(new DoctorAgendaQueryDto(), {
        date: '2026-11-02',
        status: AppointmentStatus.RESCHEDULED,
        page: 2,
        limit: 5,
        idDoctor: 999,
      }),
    );
    expect(doctorLookup).toHaveBeenCalledWith({
      where: {
        user: { idUser: 7, isActive: true, roles: { name: 'DOCTOR', isActive: true } },
        isActive: true,
      },
    });
    expect(qb.getQuery()).toContain('"appointment"."id_doctor" = :idDoctor');
    expect(qb.getQuery()).toContain('"appointment"."deleted_at" IS NULL');
    expect(qb.getQuery()).toContain('"appointment"."date" = :date');
    expect(qb.getParameters()).toMatchObject({
      idDoctor: 3,
      date: '2026-11-02',
      status: 'RESCHEDULED',
    });
    expect(qb.expressionMap.skip).toBe(5);
    expect(qb.expressionMap.take).toBe(5);
    expect(qb.expressionMap.orderBys).toEqual({
      'appointment.date': 'ASC',
      'appointment.startTime': 'ASC',
      'appointment.idAppointment': 'ASC',
    });
    expect(result).toEqual({
      data: [
        {
          idAppointment: 9,
          patient: { name: 'Ana', lastname: 'Pérez', ci: '123456' },
          specialty: { name: 'Cardiología' },
          date: '2026-11-02',
          startTime: '09:00:00',
          endTime: '10:00:00',
          status: 'RESCHEDULED',
          timeZone: 'America/La_Paz',
        },
      ],
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /email|password|createdBy|idUser|idPatient|roles|permissions/,
    );
    expect(qb.getQuery()).not.toContain('is_active');
  });
  it('allows an inclusive range of 31 days and returns a valid empty page', async () => {
    const repository = source.getRepository(Appointment);
    const qb = repository.createQueryBuilder('appointment');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
    expect(
      await service.agenda(
        7,
        Object.assign(new DoctorAgendaQueryDto(), { from: '2026-11-01', to: '2026-12-01' }),
      ),
    ).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
    expect(qb.getQuery()).toContain('BETWEEN :from AND :to');
    expect(qb.getParameters()).toMatchObject({ idDoctor: 3, from: '2026-11-01', to: '2026-12-01' });
    expect(qb.getParameters()).not.toHaveProperty('status');
  });
  it.each([
    {},
    { from: '2026-11-01' },
    { from: '2026-11-30', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-12-02' },
    { date: '2026-11-02', from: '2026-11-01', to: '2026-11-30' },
  ])('rejects unbounded or ambiguous ranges %j', async (filters) => {
    await expect(
      service.agenda(7, Object.assign(new DoctorAgendaQueryDto(), filters)),
    ).rejects.toThrow('válid');
  });
  it('rejects an account without an active doctor profile even if permission is granted', async () => {
    doctorLookup.mockResolvedValue(null);
    await expect(
      service.agenda(7, Object.assign(new DoctorAgendaQueryDto(), { date: '2026-11-02' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
