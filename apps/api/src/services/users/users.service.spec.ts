import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { mockUserRepository } from '@common/test-mocks/users.mock';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';
import { UsersQueryDto } from 'src/dtos/users/users-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersService, useValue: mockUserRepository }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('HU-USR-04 administration', () => {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    create: jest.fn((value: Partial<User>) => Object.assign(new User(), value)),
    merge: jest.fn((user: User, value: Partial<User>) => {
      Object.assign(
        user,
        Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)),
      );
      return user;
    }),
    save: jest.fn((value: User) => Promise.resolve(value)),
  };
  const roles = { getOneByName: jest.fn() };
  const service = new UsersService(
    repository as unknown as Repository<User>,
    roles as unknown as RolesService,
  );
  const dto = {
    username: 'ana',
    email: 'ana@example.com',
    name: 'Ana',
    lastname: 'Pérez',
    ci: '123',
    password: 'secret',
    roleNames: ['staff', ' STAFF '],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findOne.mockReset();
    roles.getOneByName.mockReset();
  });

  it('paginates the existing query, filters status and binds literal search safely', async () => {
    qb.getManyAndCount.mockResolvedValue([[{ idUser: 1 }], 26]);
    const query = Object.assign(new UsersQueryDto(), {
      page: 2,
      limit: 10,
      status: RecordStatus.INACTIVE,
      search: ' ana_% ',
    });
    expect(await service.getAll(query)).toEqual({
      data: [{ idUser: 1 }],
      meta: { page: 2, limit: 10, total: 26, totalPages: 3 },
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: false });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { search: '%ana\\_\\%%' });
    qb.andWhere.mockClear();
    await service.getAll(Object.assign(new UsersQueryDto(), { status: RecordStatus.ALL }));
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('creates with hashed password, unique roles and the authenticated author', async () => {
    repository.findOne.mockResolvedValue(null);
    roles.getOneByName.mockResolvedValue({ idRole: 1, name: 'STAFF' });
    const result = await service.create(dto, 9);
    expect(result.createdBy).toBe(9);
    expect(result.password).not.toBe(dto.password);
    expect(await bcrypt.compare(dto.password, result.password)).toBe(true);
    expect(result.roles).toHaveLength(1);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: [{ email: dto.email }, { username: dto.username }, { ci: dto.ci }],
    });
  });

  it('rejects duplicate identities and unavailable roles before saving', async () => {
    repository.findOne.mockResolvedValue({ idUser: 2 });
    await expect(service.create(dto, 9)).rejects.toThrow('User already exists');
    repository.findOne.mockResolvedValue(null);
    roles.getOneByName.mockResolvedValue(null);
    await expect(service.create(dto, 9)).rejects.toThrow('Role not found');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows administrative detail for inactive accounts without changing the active auth lookup', async () => {
    repository.findOne.mockResolvedValue({ idUser: 1, isActive: false });
    await service.getAdministrativeDetail(1);
    expect(repository.findOne).toHaveBeenLastCalledWith({
      where: { idUser: 1 },
      relations: { roles: true },
    });
    await service.getOneById(1);
    expect(repository.findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { idUser: 1, isActive: true } }),
    );
  });

  it('updates inactive accounts, preserves roles/state and rejects duplicate documents', async () => {
    const user = Object.assign(new User(), {
      idUser: 1,
      isActive: false,
      roles: [{ name: 'PATIENT' }],
      password: 'original',
    });
    repository.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce({ idUser: 2 });
    await expect(service.update(1, { ci: 'duplicate' }, 9)).rejects.toThrow('ci already exists');
    expect(repository.save).not.toHaveBeenCalled();
    repository.findOne.mockResolvedValueOnce(user);
    const result = await service.update(
      1,
      { name: 'Ana', password: 'new-secret', roleNames: ['SUPERADMIN'], isActive: true } as never,
      9,
    );
    expect(user.roles).toEqual([{ name: 'PATIENT' }]);
    expect(user.isActive).toBe(false);
    expect(user.updatedBy).toBe(9);
    expect(user.password).toBe('original');
    expect(result).not.toHaveProperty('password');
  });

  it('deactivates and reactivates through save, retaining information and recording authors', async () => {
    const assigned = [{ idRole: 1, name: 'STAFF' }];
    const user = Object.assign(new User(), {
      idUser: 1,
      isActive: true,
      ci: '123',
      roles: assigned,
    });
    repository.findOne.mockResolvedValue(user);
    await service.delete(1, 9);
    expect(user).toMatchObject({ isActive: false, ci: '123', deletedBy: 9, updatedBy: 9 });
    expect(user.roles).toBe(assigned);
    await service.reactivate(1, 10);
    expect(user).toMatchObject({ isActive: true, ci: '123', updatedBy: 10 });
    expect(repository.save).toHaveBeenCalledTimes(2);
    repository.findOne.mockResolvedValue(null);
    await expect(service.delete(99, 9)).rejects.toThrow('User not found');
  });

  it('rejects creation without roles before querying or saving', async () => {
    await expect(service.create({ ...dto, roleNames: [] }, 9)).rejects.toThrow(
      'El usuario debe tener al menos un rol',
    );
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects updating or reactivating legacy accounts without roles without changing data', async () => {
    const user = Object.assign(new User(), {
      idUser: 1,
      name: 'Original',
      isActive: false,
      roles: [],
    });
    repository.findOne.mockResolvedValue(user);
    await expect(service.update(1, { name: 'New' }, 9)).rejects.toThrow(
      'El usuario debe tener al menos un rol',
    );
    await expect(service.reactivate(1, 9)).rejects.toThrow('El usuario debe tener al menos un rol');
    expect(user).toMatchObject({ name: 'Original', isActive: false, roles: [] });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates users with multiple valid roles', async () => {
    repository.findOne.mockResolvedValue(null);
    roles.getOneByName.mockImplementation((name: string) =>
      Promise.resolve({ name, isActive: true }),
    );
    expect(
      (await service.create({ ...dto, roleNames: ['DOCTOR', 'STAFF'] }, 9)).roles,
    ).toHaveLength(2);
  });

  it('rejects self-deactivation with HTTP 400 before reading or modifying the account', async () => {
    const user = Object.assign(new User(), { idUser: 1, isActive: true, ci: '123' });
    repository.findOne.mockResolvedValue(user);
    const failure = await service.delete(1, 1).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BadRequestException);
    expect((failure as BadRequestException).getStatus()).toBe(400);
    expect((failure as Error).message).toBe('No puedes desactivar tu propia cuenta');
    expect(user).toMatchObject({ isActive: true, ci: '123' });
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(user.deletedBy).toBeUndefined();
    expect(user.updatedBy).toBeUndefined();
  });
});

describe('User role assignments', () => {
  const repository = { findOne: jest.fn(), save: jest.fn() };
  const roles = { getOneByName: jest.fn() };
  const service = new UsersService(
    repository as unknown as Repository<User>,
    roles as unknown as RolesService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('replaces roles and removes omitted roles but rejects clearing all associations', async () => {
    const user = { roles: [{ idRole: 1, name: 'STAFF' }], isActive: false } as User;
    const doctor = { idRole: 2, name: 'DOCTOR', isActive: true } as Role;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName.mockResolvedValue(doctor);
    await service.assignRoles(1, [' doctor ', 'DOCTOR'], 9, true);
    expect(user.roles).toEqual([doctor]);
    expect(user.updatedBy).toBe(9);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { idUser: 1 }, relations: ['roles'] });
    await expect(service.assignRoles(1, [], 9, true)).rejects.toThrow(
      'El usuario debe tener al menos un rol',
    );
    expect(user.roles).toEqual([doctor]);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('preserves all associations if replacement contains a missing or inactive new role', async () => {
    const inactive = { idRole: 1, name: 'STAFF', isActive: false } as Role;
    const user = { roles: [inactive] } as User;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName.mockResolvedValue(null);
    await expect(service.assignRoles(1, ['STAFF', 'DOCTOR'], 9, true)).rejects.toThrow(
      'Role not found',
    );
    expect(user.roles).toEqual([inactive]);
    expect(repository.save).not.toHaveBeenCalled();
    await service.assignRoles(1, ['STAFF'], 9, true);
    expect(user.roles).toEqual([inactive]);
  });

  it('normalizes and deduplicates names and rejects an existing association', async () => {
    const user = { roles: [] } as unknown as User;
    const role = { idRole: 1, name: 'STAFF' } as Role;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName.mockResolvedValue(role);
    await service.assignRoles(1, [' staff ', 'STAFF'], 9);
    expect(user.roles).toEqual([role]);
    expect(roles.getOneByName).toHaveBeenCalledTimes(1);
    repository.save.mockClear();
    await expect(service.assignRoles(1, ['staff'], 9)).rejects.toThrow('Role already assigned');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not partially assign roles when any role is missing or inactive', async () => {
    const user = { roles: [] } as unknown as User;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName
      .mockResolvedValueOnce({ idRole: 1, name: 'STAFF' })
      .mockResolvedValueOnce(null);
    await expect(service.assignRoles(1, ['STAFF', 'DOCTOR'], 9)).rejects.toThrow('Role not found');
    expect(user.roles).toEqual([]);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
