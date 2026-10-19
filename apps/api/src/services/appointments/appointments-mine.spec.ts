import { DataSource } from 'typeorm';
import { Appointment, AppointmentStatus } from 'src/entities/appointments/appointment.entity';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { AppointmentsQueryDto } from 'src/dtos/appointments/appointments-query.dto';
import { SchedulesService } from '../schedules/schedules.service';
import { AppointmentsService } from './appointments.service';
class QuerySource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}
describe('Own appointments SQL and projection', () => {
  const source = new QuerySource({
    type: 'postgres',
    entities: [Appointment, Schedule, Doctor, User, Specialty, Role, Permission, UserSession],
  });
  const service = new AppointmentsService(source, new SchedulesService(source));
  beforeAll(async () => {
    await source.prepare();
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([7, 9])(
    'always scopes SQL and count to session patient %s and strips sensitive fields',
    async (idUser) => {
      const repository = source.getRepository(Appointment);
      const qb = repository.createQueryBuilder('appointment');
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([
        [
          {
            idAppointment: 1,
            doctor: {
              idDoctor: 2,
              user: {
                idUser: 3,
                name: 'Ana',
                lastname: 'Perez',
                email: 'private',
                password: 'private',
              },
            },
            specialty: { idSpecialty: 2, name: 'Cardiología' },
            date: '2026-01-01',
            startTime: '09:00:00',
            endTime: '10:00:00',
            status: AppointmentStatus.RESERVED,
            createdBy: 99,
          } as Appointment,
        ],
        12,
      ]);
      const result = await service.mine(
        idUser,
        Object.assign(new AppointmentsQueryDto(), {
          page: 2,
          limit: 5,
          period: 'past',
          status: AppointmentStatus.RESERVED,
          date: '2026-01-01',
          idPatient: 999,
        }),
      );
      expect(qb.getQuery()).toContain('"appointment"."id_patient" = :idUser');
      expect(qb.getQuery()).toContain('"appointment"."deleted_at" IS NULL');
      expect(qb.getQuery()).toContain('CURRENT_TIMESTAMP AT TIME ZONE :timeZone');
      expect(qb.getQuery()).toContain('"appointment"."status" = :status');
      expect(qb.getQuery()).toContain('"appointment"."date" = :date');
      expect(qb.getParameters()).toMatchObject({
        idUser,
        timeZone: 'America/La_Paz',
        date: '2026-01-01',
        status: 'RESERVED',
      });
      expect(qb.expressionMap.skip).toBe(5);
      expect(qb.expressionMap.take).toBe(5);
      expect(qb.expressionMap.orderBys).toEqual({
        'appointment.date': 'DESC',
        'appointment.startTime': 'DESC',
        'appointment.idAppointment': 'DESC',
      });
      expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
      expect(result.data[0]).toEqual({
        idAppointment: 1,
        doctor: { name: 'Ana', lastname: 'Perez' },
        specialty: { name: 'Cardiología' },
        date: '2026-01-01',
        startTime: '09:00:00',
        endTime: '10:00:00',
        status: 'RESERVED',
        timeZone: 'America/La_Paz',
      });
      expect(JSON.stringify(result)).not.toMatch(
        /idPatient|idUser|email|password|createdBy|roles|permissions/,
      );
      expect(qb.getQuery()).not.toContain('is_active');
    },
  );
  it.each(['upcoming', 'all'] as const)(
    'returns a paginated empty result for %s',
    async (period) => {
      const repository = source.getRepository(Appointment);
      const qb = repository.createQueryBuilder('appointment');
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
      expect(await service.mine(7, Object.assign(new AppointmentsQueryDto(), { period }))).toEqual({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
      if (period === 'upcoming') expect(qb.getQuery()).toContain('>= (CURRENT_TIMESTAMP');
      else expect(qb.getQuery()).not.toContain('CURRENT_TIMESTAMP');
      expect(qb.getParameters()).not.toHaveProperty('status');
      expect(qb.expressionMap.orderBys['appointment.date']).toBe('ASC');
    },
  );
});
