import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { DoctorsService } from './doctors.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SpecialtiesService } from '../specialties/specialties.service';

class QueryDataSource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}

describe('Operational doctor selection', () => {
  const source = new QueryDataSource({
    type: 'postgres',
    entities: [Doctor, User, Specialty, Role, Permission, UserSession],
  });
  const specialties = { getActiveById: jest.fn(), getAll: jest.fn() };
  const service = new DoctorsService(
    source.getRepository(Doctor),
    source,
    {} as UsersService,
    {} as RolesService,
    specialties as unknown as SpecialtiesService,
  );
  beforeAll(async () => {
    await source.prepare();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    specialties.getActiveById.mockResolvedValue({
      idSpecialty: 2,
      name: 'Cardiología',
      isActive: true,
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queries only associated active doctors, accounts, roles and specialties with stable shared pagination', async () => {
    const repository = source.getRepository(Doctor);
    const qb = repository.createQueryBuilder('doctor');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([
      [
        {
          idDoctor: 4,
          user: {
            idUser: 10,
            name: 'Ana',
            lastname: 'Pérez',
            email: 'private@example.com',
            ci: 'private',
            roles: [],
            password: 'secret',
          },
          createdBy: 7,
        } as Doctor,
      ],
      12,
    ]);
    const result = await service.getBySpecialty(
      2,
      Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 }),
    );
    expect(result).toEqual({
      data: [{ idDoctor: 4, name: 'Ana', lastname: 'Pérez' }],
      meta: { page: 2, limit: 5, total: 12, totalPages: 3 },
    });
    const sql = qb.getQuery();
    for (const alias of ['doctor', 'user', 'specialty', 'doctorRole']) {
      expect(sql).toContain(`"${alias}"."is_active" = true`);
      expect(sql).toContain(`"${alias}"."deleted_at" IS NULL`);
    }
    expect(sql).toContain('"specialty"."id_specialty" = :idSpecialty');
    expect(sql).toContain('"doctorRole"."name" = :doctorRoleName');
    expect(qb.getParameters()).toMatchObject({ idSpecialty: 2, doctorRoleName: 'DOCTOR' });
    expect(qb.expressionMap.skip).toBe(5);
    expect(qb.expressionMap.take).toBe(5);
    expect(qb.expressionMap.selects.map(({ selection }) => selection)).toEqual([
      'doctor.idDoctor',
      'user.idUser',
      'user.name',
      'user.lastname',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/email|ci|password|createdBy|idUser|roles/);
  });

  it('returns a valid empty page for a specialty without active doctors', async () => {
    const repository = source.getRepository(Doctor);
    const qb = repository.createQueryBuilder('doctor');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);
    expect(await service.getBySpecialty(2)).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('publishes operational doctors with active specialties and no personal or administrative fields', async () => {
    const repository = source.getRepository(Doctor);
    const qb = repository.createQueryBuilder('doctor');
    jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(qb);
    jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([
      [
        {
          idDoctor: 4,
          isActive: true,
          user: {
            idUser: 10,
            name: 'Ana',
            lastname: 'Pérez',
            email: 'private@example.com',
            ci: 'private',
            isActive: true,
          },
          specialties: [
            { idSpecialty: 2, name: 'Cardiología', isActive: true },
            { idSpecialty: 3, name: 'Inactiva', isActive: false },
          ],
        } as Doctor,
      ],
      1,
    ]);
    const result = await service.getPublicPage(
      Object.assign(new PaginationQueryDto(), {
        page: 1,
        limit: 6,
        status: 'all',
        search: 'private',
      }),
    );
    expect(result.data).toEqual([
      {
        idDoctor: 4,
        name: 'Ana',
        lastname: 'Pérez',
        specialties: [{ idSpecialty: 2, name: 'Cardiología' }],
      },
    ]);
    expect(qb.getParameters()).toMatchObject({ isActive: true, doctorRoleName: 'DOCTOR' });
    expect(qb.getParameters()).not.toHaveProperty('search');
    const sql = qb.getQuery();
    expect(sql).toContain('"user"."is_active" = true');
    expect(sql).toContain('"doctorRole"."is_active" = true');
    expect(qb.expressionMap.take).toBe(6);
    expect(JSON.stringify(result)).not.toMatch(
      /private|Inactiva|email|ci"|idUser|isActive|createdBy/,
    );
  });

  it.each(['nonexistent', 'inactive'])(
    'rejects an %s specialty before querying doctors',
    async () => {
      const createQuery = jest.spyOn(source.getRepository(Doctor), 'createQueryBuilder');
      specialties.getActiveById.mockRejectedValueOnce(
        new BadRequestException('Especialidad activa no encontrada'),
      );
      await expect(service.getBySpecialty(99)).rejects.toThrow('Especialidad activa no encontrada');
      expect(createQuery).not.toHaveBeenCalled();
    },
  );

  it('reuses the active specialty catalog and strips administrative fields', async () => {
    specialties.getAll.mockResolvedValueOnce({
      data: [{ idSpecialty: 2, name: 'Cardiología', isActive: true, createdBy: 7 }],
      meta: { page: 2, limit: 5, total: 6, totalPages: 2 },
    });
    const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 });
    const result = await service.getSelectionSpecialties(query);
    expect(specialties.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, status: 'active' }),
    );
    expect(result.data).toEqual([{ idSpecialty: 2, name: 'Cardiología' }]);
    expect(result.meta).toMatchObject({ total: 6, page: 2 });
  });
});
