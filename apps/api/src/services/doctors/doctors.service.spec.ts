import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Doctor } from 'src/entities/doctors/doctors.entity';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Specialty } from 'src/entities/specialties/specialties.entity';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SpecialtiesService } from '../specialties/specialties.service';
import { DoctorsService } from './doctors.service';
import { DoctorsQueryDto } from 'src/dtos/doctors/doctors.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';

describe('Doctor registration integrity', () => {
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const doctors = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value: Partial<Doctor>) =>
      Object.assign(new Doctor(), { idDoctor: 1 }, value),
    ),
    createQueryBuilder: jest.fn(() => qb),
  };
  const users = { findOne: jest.fn(), save: jest.fn() };
  const roles = { findOne: jest.fn() };
  const specialties = { findOne: jest.fn() };
  const globalUsers = { findOne: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
  const globalRoles = { findOne: jest.fn() };
  const globalSpecialties = { findOne: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === User
        ? users
        : entity === Role
          ? roles
          : entity === Specialty
            ? specialties
            : doctors,
    ),
  } as unknown as EntityManager;
  const transaction = jest.fn((callback: (manager: EntityManager) => Promise<unknown>) =>
    callback(manager),
  );
  const rolesService = new RolesService(
    globalRoles as unknown as Repository<Role>,
    {} as PermissionsService,
  );
  const usersService = new UsersService(globalUsers as unknown as Repository<User>, rolesService);
  const specialtiesService = new SpecialtiesService(
    globalSpecialties as unknown as Repository<Specialty>,
  );
  const service = new DoctorsService(
    doctors as unknown as Repository<Doctor>,
    { transaction } as unknown as DataSource,
    usersService,
    rolesService,
    specialtiesService,
  );
  const doctorRole = { idRole: 3, name: 'DOCTOR', isActive: true } as Role;
  let user: User;
  const dto = { idUser: 4, isActive: true, specialtyIds: [2, 1] };

  beforeEach(() => {
    jest.clearAllMocks();
    user = {
      idUser: 4,
      name: 'Ana',
      lastname: 'Pérez',
      email: 'ana@example.com',
      ci: '123',
      isActive: true,
      roles: [{ idRole: 2, name: 'STAFF', isActive: true }],
      password: 'private',
    } as User;
    users.findOne.mockResolvedValue(user);
    users.save.mockImplementation((value: User) => Promise.resolve(value));
    doctors.findOne.mockResolvedValue(null);
    doctors.save.mockImplementation((value: Doctor) => Promise.resolve(value));
    roles.findOne.mockResolvedValue(doctorRole);
    specialties.findOne.mockImplementation(({ where }: { where: { idSpecialty: number } }) =>
      Promise.resolve({
        idSpecialty: where.idSpecialty,
        name: 'Especialidad ' + where.idSpecialty,
        isActive: true,
      }),
    );
  });

  it('creates the profile and assigns DOCTOR within one transaction, preserving identity and other roles', async () => {
    const result = await service.create(dto, 7);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(user.roles.map(({ name }) => name)).toEqual(['STAFF', 'DOCTOR']);
    expect(user.updatedBy).toBe(7);
    expect(users.findOne).toHaveBeenCalledWith({
      where: { idUser: 4, isActive: true },
      lock: { mode: 'pessimistic_write' },
    });
    expect(doctors.save).toHaveBeenCalledWith(
      expect.objectContaining({ user, isActive: true, createdBy: 7 }),
    );
    expect(specialties.findOne).toHaveBeenNthCalledWith(1, {
      where: { idSpecialty: 1, isActive: true },
      lock: { mode: 'pessimistic_read' },
    });
    expect(result.specialties).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/password|private|roles|createdBy/);
    expect(globalUsers.save).not.toHaveBeenCalled();
    expect(globalRoles.findOne).not.toHaveBeenCalled();
    expect(globalSpecialties.findOne).not.toHaveBeenCalled();
  });

  it('registers a previously assigned DOCTOR without duplicating the role and allows an inactive profile without specialties', async () => {
    user.roles.push(doctorRole);
    expect(await service.create({ ...dto, isActive: false, specialtyIds: [] }, 7)).toMatchObject({
      isActive: false,
      specialties: [],
    });
    expect(users.save).not.toHaveBeenCalled();
    expect(user.roles).toHaveLength(2);
  });

  it('rejects duplicate profiles including inactive/deleted ones before any write', async () => {
    doctors.findOne.mockResolvedValue({ idDoctor: 9, isActive: false });
    await expect(service.create(dto, 7)).rejects.toThrow('ya tiene un perfil médico');
    expect(doctors.findOne).toHaveBeenCalledWith({
      where: { user: { idUser: 4 } },
      withDeleted: true,
    });
    expect(users.save).not.toHaveBeenCalled();
    expect(doctors.save).not.toHaveBeenCalled();
  });

  it('rejects missing/inactive accounts, unavailable DOCTOR and inactive specialties before writing', async () => {
    users.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto, 7)).rejects.toThrow('cuenta activa');
    roles.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto, 7)).rejects.toThrow('rol DOCTOR');
    specialties.findOne.mockResolvedValueOnce(null);
    await expect(service.create(dto, 7)).rejects.toThrow('Especialidad activa');
    expect(users.save).not.toHaveBeenCalled();
    expect(doctors.save).not.toHaveBeenCalled();
    expect(user.roles.map(({ name }) => name)).toEqual(['STAFF']);
  });

  it('propagates late failures out of the transaction so all its writes are rolled back', async () => {
    const failure = new Error('database unavailable');
    doctors.save.mockRejectedValueOnce(failure);
    await expect(service.create(dto, 7)).rejects.toBe(failure);
    expect(users.save).toHaveBeenCalledTimes(1);
    expect(users.findOne).toHaveBeenCalled();
    expect(globalUsers.save).not.toHaveBeenCalled();
    await expect(transaction.mock.results[0].value).rejects.toBe(failure);
  });

  it('converts concurrent unique violations into a duplicate registration error', async () => {
    doctors.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as unknown as Error),
    );
    await expect(service.create(dto, 7)).rejects.toThrow('ya tiene un perfil médico');
  });

  it('paginates only available active profiles by default, excluding inactive accounts or roles', async () => {
    qb.getManyAndCount.mockResolvedValueOnce([
      [
        {
          idDoctor: 1,
          isActive: true,
          user,
          specialties: [
            { idSpecialty: 1, name: 'Cardiología', isActive: true },
            { idSpecialty: 2, name: 'Medicina interna', isActive: false },
          ],
        },
      ],
      12,
    ]);
    const query = Object.assign(new DoctorsQueryDto(), { page: 2, limit: 5, search: ' ana_% ' });
    const result = await service.getAll(query);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(qb.andWhere).toHaveBeenCalledWith('doctor.isActive = :isActive', { isActive: true });
    expect(qb.andWhere).toHaveBeenCalledWith('user.isActive = true');
    expect(qb.innerJoin).toHaveBeenCalledWith('user.roles', 'doctorRole', expect.any(String), {
      doctorRoleName: 'DOCTOR',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { search: '%ana\\_\\%%' });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
    expect(JSON.stringify(result)).not.toContain('password');
    expect(result.data[0].specialties).toEqual([
      { idSpecialty: 1, name: 'Cardiología', isActive: true },
    ]);
  });

  it('retains inactive profiles in administrative filters and supports empty results', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);
    await service.getAll(Object.assign(new DoctorsQueryDto(), { status: RecordStatus.INACTIVE }));
    expect(qb.andWhere).toHaveBeenCalledWith('doctor.isActive = :isActive', { isActive: false });
    expect(qb.innerJoin).not.toHaveBeenCalled();
    qb.andWhere.mockClear();
    expect(
      await service.getAll(Object.assign(new DoctorsQueryDto(), { status: RecordStatus.ALL })),
    ).toMatchObject({ data: [], meta: { total: 0 } });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('resolves active profiles for future operational writes with active account and DOCTOR checks', async () => {
    await expect(service.getActiveById(1)).rejects.toThrow('Médico activo no encontrado');
    expect(doctors.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idDoctor: 1,
          isActive: true,
          user: { isActive: true, roles: { name: 'DOCTOR', isActive: true } },
        },
      }),
    );
    doctors.findOne.mockResolvedValueOnce({ idDoctor: 1, user });
    expect(await service.getActiveById(1)).toMatchObject({ idDoctor: 1 });
  });

  it('deactivates and reactivates the profile without altering account or specialty history', async () => {
    const profile = {
      idDoctor: 1,
      user,
      isActive: true,
      specialties: [{ idSpecialty: 2, name: 'Cardiología', isActive: false }],
    } as Doctor;
    doctors.findOne.mockResolvedValue(profile);
    expect(await service.changeStatus(1, false, 7)).toMatchObject({
      idDoctor: 1,
      isActive: false,
      specialties: [{ idSpecialty: 2 }],
    });
    expect(profile).toMatchObject({ updatedBy: 7, deletedBy: 7 });
    expect(user.isActive).toBe(true);
    expect(await service.changeStatus(1, true, 8)).toMatchObject({ idDoctor: 1, isActive: true });
    user.isActive = false;
    await expect(service.changeStatus(1, true, 8)).rejects.toThrow(
      'cuenta del médico está inactiva',
    );
    doctors.findOne.mockResolvedValueOnce(null);
    await expect(service.changeStatus(99, false, 8)).rejects.toThrow('Médico no encontrado');
  });

  it('reuses the user search pagination and exposes only identity fields needed to register', async () => {
    const getAll = jest.spyOn(usersService, 'getAll').mockResolvedValueOnce({
      data: [user],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    try {
      const query = Object.assign(new DoctorsQueryDto(), {
        search: 'ana',
        status: RecordStatus.ALL,
      });
      const result = await service.searchRegistrationUsers(query);
      expect(getAll).toHaveBeenCalledWith(query);
      expect(result.data[0]).toEqual({
        idUser: 4,
        name: 'Ana',
        lastname: 'Pérez',
        email: 'ana@example.com',
        ci: '123',
        isActive: true,
      });
      await expect(service.searchRegistrationUsers(new DoctorsQueryDto())).rejects.toThrow(
        'al menos 3',
      );
    } finally {
      getAll.mockRestore();
    }
  });
});
