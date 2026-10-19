import { DataSource } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { Schedule } from 'src/entities/schedules/schedule.entity';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { AvailabilityQueryDto } from 'src/dtos/schedules/availability-query.dto';
import { SchedulesService } from './schedules.service';

class QueryDataSource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}

describe('Derived medical availability', () => {
  const source = new QueryDataSource({
    type: 'postgres',
    entities: [Schedule, Doctor, User, Specialty, Role, Permission, UserSession],
  });
  const service = new SchedulesService(source);
  const query = Object.assign(new AvailabilityQueryDto(), {
    idDoctor: 3,
    date: '2026-11-02',
    page: 2,
    limit: 5,
  });
  beforeAll(async () => {
    await source.prepare();
  });
  afterEach(() => jest.restoreAllMocks());

  it('filters inactive/deleted doctors, accounts, roles, specialties and schedules in SQL before pagination', async () => {
    const repository = source.getRepository(Schedule);
    const qb = repository.createQueryBuilder('schedule');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([
      [
        {
          idSchedule: 9,
          doctor: { idDoctor: 3 },
          specialty: { idSpecialty: 2 },
          date: '2026-11-02',
          startTime: '09:00:00',
          endTime: '10:00:00',
          createdBy: 99,
        } as Schedule,
      ],
      12,
    ]);
    const result = await service.availability(
      Object.assign(new AvailabilityQueryDto(), query, { idSpecialty: 2 }),
    );
    expect(result).toEqual({
      data: [
        {
          idSchedule: 9,
          idDoctor: 3,
          idSpecialty: 2,
          date: '2026-11-02',
          startTime: '09:00:00',
          endTime: '10:00:00',
          timeZone: 'America/La_Paz',
        },
      ],
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
    const sql = qb.getQuery();
    for (const alias of ['schedule', 'doctor', 'user', 'doctorRole', 'specialty']) {
      expect(sql).toContain(`"${alias}"."is_active" = true`);
      expect(sql).toContain(`"${alias}"."deleted_at" IS NULL`);
    }
    expect(sql).toContain('"assignment"."id_specialty" = "specialty"."id_specialty"');
    expect(sql).toContain('"schedule"."start_time" < "schedule"."end_time"');
    expect(sql).toContain('CURRENT_TIMESTAMP AT TIME ZONE :timeZone');
    expect(sql).toContain('"doctor"."id_doctor" = :idDoctor');
    expect(sql).toContain('"schedule"."date" = :date');
    expect(sql).toContain('"specialty"."id_specialty" = :idSpecialty');
    expect(qb.getParameters()).toMatchObject({
      idDoctor: 3,
      idSpecialty: 2,
      date: query.date,
      timeZone: 'America/La_Paz',
      roleName: 'DOCTOR',
    });
    expect(qb.expressionMap.skip).toBe(5);
    expect(qb.expressionMap.take).toBe(5);
    expect(qb.expressionMap.selects.map(({ selection }) => selection)).toEqual([
      'schedule.idSchedule',
      'schedule.date',
      'schedule.startTime',
      'schedule.endTime',
      'doctor.idDoctor',
      'specialty.idSpecialty',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/createdBy|idUser|email|password|roles|isActive/);
  });

  it('returns a valid empty page when there are no eligible schedules', async () => {
    const repository = source.getRepository(Schedule);
    const qb = repository.createQueryBuilder('schedule');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
    expect(
      await service.availability(Object.assign(new AvailabilityQueryDto(), query, { page: 1 })),
    ).toEqual({ data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } });
    expect(qb.getParameters()).not.toHaveProperty('idSpecialty');
  });
  it('reuses eligibility rules for an inclusive monthly range before pagination', async () => {
    const repository = source.getRepository(Schedule);
    const qb = repository.createQueryBuilder('schedule');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
    await service.availability(
      Object.assign(new AvailabilityQueryDto(), {
        idDoctor: 3,
        idSpecialty: 2,
        from: '2026-11-01',
        to: '2026-11-30',
      }),
    );
    expect(qb.getQuery()).toContain('BETWEEN :from AND :to');
    expect(qb.getQuery()).not.toContain('= :date');
    expect(qb.getQuery()).toContain('CURRENT_TIMESTAMP AT TIME ZONE :timeZone');
    expect(qb.getParameters()).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
      idDoctor: 3,
      idSpecialty: 2,
    });
    expect(qb.expressionMap.orderBys).toEqual({
      'schedule.date': 'ASC',
      'schedule.startTime': 'ASC',
      'schedule.idSchedule': 'ASC',
    });
  });
  it.each([
    { from: '2026-11-30', to: '2026-11-01' },
    { from: '2026-11-01', to: '2026-12-02' },
    { date: '2026-11-01', from: '2026-11-01', to: '2026-11-30' },
  ])('rejects invalid or ambiguous ranges %j', async (range) => {
    await expect(
      service.availability(Object.assign(new AvailabilityQueryDto(), { idDoctor: 3 }, range)),
    ).rejects.toThrow('rango válido');
  });
  it('paginates only own schedules, preserves inactive blocks and strips audit fields', async () => {
    jest
      .spyOn(source.getRepository(Doctor), 'findOne')
      .mockResolvedValue({ idDoctor: 3 } as Doctor);
    const repository = source.getRepository(Schedule);
    const qb = repository.createQueryBuilder('schedule');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    const getManyAndCount = jest.spyOn(qb, 'getManyAndCount');
    getManyAndCount.mockResolvedValue([
      [
        {
          idSchedule: 9,
          doctor: { idDoctor: 3 },
          specialty: { idSpecialty: 2, name: 'Cardiología' },
          date: '2026-11-02',
          startTime: '09:00:00',
          endTime: '10:00:00',
          isActive: false,
          version: 3,
          createdBy: 99,
        } as Schedule,
      ],
      12,
    ]);
    const result = await service.mine(
      7,
      Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 }),
    );
    expect(result.data[0]).toEqual({
      idSchedule: 9,
      idDoctor: 3,
      idSpecialty: 2,
      specialtyName: 'Cardiología',
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '10:00',
      isActive: false,
      version: 3,
    });
    expect(qb.getParameters()).toMatchObject({ idDoctor: 3 });
    expect(qb.getQuery()).not.toContain('"schedule"."is_active" = true');
    expect(qb.expressionMap.skip).toBe(5);
    expect(qb.expressionMap.take).toBe(5);
    expect(result.meta).toMatchObject({ page: 2, total: 12 });
    expect(JSON.stringify(result)).not.toMatch(/createdBy|email|idUser/);
  });
  it('locks the owned schedule row without a nullable-side join in PostgreSQL', () => {
    const qb = source
      .getRepository(Schedule)
      .createQueryBuilder('schedule')
      .where('schedule.idSchedule = :idSchedule', { idSchedule: 9 })
      .andWhere('schedule.id_doctor = :idDoctor', { idDoctor: 3 })
      .setLock('pessimistic_write');
    expect(qb.getQuery()).not.toContain('JOIN');
    expect(qb.getQuery()).toContain('FOR UPDATE');
    expect(qb.getParameters()).toEqual({ idSchedule: 9, idDoctor: 3 });
  });
});
