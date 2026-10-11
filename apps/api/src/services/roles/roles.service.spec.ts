import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { RolesService } from './roles.service';
import { MEDISUR_ROLES } from 'src/database/seeders/access-control.catalog';
import { RolesQueryDto } from 'src/dtos/roles/roles-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';

describe('RolesService', () => {
  let service: RolesService;

  const roleRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const permissionsService = {
    getOneByName: jest.fn(),
  };

  it('replaces assignments atomically, preserves codes and permits removing every grant', async () => {
    const previous = { idPermission: 1, name: 'user.get-all', isActive: true } as Permission;
    const next = { idPermission: 2, name: 'user.create', isActive: true } as Permission;
    const role = {
      idRole: 1,
      name: 'SUPERADMIN',
      description: 'Base',
      permissions: [previous],
    } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    roleRepository.save.mockImplementation((value: Role) => Promise.resolve(value));
    permissionsService.getOneByName.mockResolvedValue(next);
    await service.assignPermissions(1, [next.name, next.name], 7, true);
    expect(role).toMatchObject({
      name: 'SUPERADMIN',
      description: 'Base',
      permissions: [next],
      updatedBy: 7,
    });
    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    permissionsService.getOneByName.mockResolvedValueOnce(previous).mockResolvedValueOnce(null);
    await expect(
      service.assignPermissions(1, [previous.name, 'clinical.global'], 7, true),
    ).rejects.toThrow('Permission not found');
    expect(role.permissions).toEqual([next]);
    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    await service.assignPermissions(1, [], 7, true);
    expect(role.permissions).toEqual([]);
  });

  it('consults inactive roles with their assigned permissions without enabling them', async () => {
    const role = {
      idRole: 5,
      isActive: false,
      permissions: [{ name: 'user.create', isActive: false }],
    } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    expect(await service.getOneById(5)).toBe(role);
    expect(roleRepository.findOne).toHaveBeenCalledWith({
      where: { idRole: 5 },
      relations: ['permissions'],
    });
    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  it('can retain or withdraw inactive associations but cannot grant inactive or unknown catalog permissions', async () => {
    const permission = { idPermission: 3, name: 'user.update', isActive: false } as Permission;
    const role = { idRole: 5, permissions: [permission] } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    permissionsService.getOneByName.mockResolvedValue(null);
    await service.assignPermissions(5, [permission.name], 7, true);
    expect(role.permissions).toEqual([permission]);
    expect(permission.isActive).toBe(false);
    expect(permissionsService.getOneByName).not.toHaveBeenCalled();
    await service.assignPermissions(5, [], 7, true);
    await expect(service.assignPermissions(5, [permission.name], 7, true)).rejects.toThrow(
      'Permission not found',
    );
    expect(role.permissions).toEqual([]);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: roleRepository,
        },
        {
          provide: PermissionsService,
          useValue: permissionsService,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('deduplicates an assignment and validates all permissions before changing the role', async () => {
    const role = { idRole: 1, permissions: [] } as unknown as Role;
    const permission = { idPermission: 1, name: 'role.get-all' } as Permission;
    roleRepository.findOne.mockResolvedValue(role);
    permissionsService.getOneByName.mockResolvedValue(permission);
    await service.assignPermissions(1, [permission.name, permission.name], 7);
    expect(role.permissions).toEqual([permission]);
    expect(role.updatedBy).toBe(7);
    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
    await expect(service.assignPermissions(1, [permission.name], 7)).rejects.toThrow(
      'already assigned',
    );
    expect(roleRepository.save).not.toHaveBeenCalled();
    role.permissions = [];
    permissionsService.getOneByName.mockResolvedValueOnce(permission).mockResolvedValueOnce(null);
    await expect(service.assignPermissions(1, [permission.name, 'missing'], 7)).rejects.toThrow(
      'not found',
    );
    expect(role.permissions).toEqual([]);
    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  it('creates a role with its permissions in a single save', async () => {
    const permission = {
      idPermission: 1,
      name: 'role.get-all',
    } as Permission;
    const createdRole = {
      idRole: 1,
      name: 'STAFF',
      description: 'Personal administrativo',
      permissions: [permission],
    } as Role;

    roleRepository.findOne.mockResolvedValue(null);
    permissionsService.getOneByName.mockResolvedValue(permission);
    roleRepository.create.mockReturnValue(createdRole);
    roleRepository.save.mockResolvedValue(createdRole);

    await expect(
      service.create(
        {
          name: ' staff ',
          description: 'Personal administrativo',
          permissionNames: [permission.name],
        },
        7,
      ),
    ).resolves.toBe(createdRole);

    expect(roleRepository.create).toHaveBeenCalledWith({
      name: 'STAFF',
      description: 'Personal administrativo',
      permissions: [permission],
    });
    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    expect(createdRole.createdBy).toBe(7);
  });

  it('does not persist a role when a requested permission does not exist', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    permissionsService.getOneByName.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'STAFF',
          description: 'Personal administrativo',
          permissionNames: ['role.unknown'],
        },
        7,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(roleRepository.create).not.toHaveBeenCalled();
    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  it('replaces all permissions when updating a role', async () => {
    const previousPermission = {
      idPermission: 1,
      name: 'role.get-all',
    } as Permission;
    const updatedPermission = {
      idPermission: 2,
      name: 'role.update',
    } as Permission;
    const role = {
      idRole: 1,
      name: 'STAFF',
      description: 'Personal administrativo',
      permissions: [previousPermission],
    } as Role;

    roleRepository.findOne.mockResolvedValueOnce(role).mockResolvedValueOnce(null);
    permissionsService.getOneByName.mockResolvedValue(updatedPermission);
    roleRepository.save.mockResolvedValue(role);

    await expect(
      service.update(
        1,
        {
          name: ' staff ',
          description: 'Updated description',
          permissionNames: [updatedPermission.name, updatedPermission.name],
        },
        7,
      ),
    ).resolves.toBe(role);

    expect(role).toMatchObject({
      name: 'STAFF',
      description: 'Updated description',
      permissions: [updatedPermission],
      updatedBy: 7,
    });
    expect(roleRepository.save).toHaveBeenCalledWith(role);
  });

  it('creates an administrative role without permissions using the existing creation logic', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    const role = {
      idRole: 5,
      name: 'RECEPTION',
      isActive: true,
      permissions: [],
    } as unknown as Role;
    roleRepository.create.mockReturnValue(role);
    roleRepository.save.mockResolvedValue(role);
    await service.create(
      { name: ' reception ', description: ' Recepción ', permissionNames: [] },
      7,
    );
    expect(roleRepository.create).toHaveBeenCalledWith({
      name: 'RECEPTION',
      description: 'Recepción',
      permissions: [],
    });
    expect(role.createdBy).toBe(7);
    expect(permissionsService.getOneByName).not.toHaveBeenCalled();
  });

  it('rejects duplicate normalized names, including inactive roles', async () => {
    roleRepository.findOne.mockResolvedValue({ name: 'RECEPTION', isActive: false });
    await expect(service.create({ name: ' reception ', permissionNames: [] }, 7)).rejects.toThrow(
      'Role already exists',
    );
    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  it('edits only administrative information of inactive roles without touching codes, state or permissions', async () => {
    const permissions = [{ name: 'user.get-all' }] as Permission[];
    const role = {
      idRole: 5,
      name: 'RECEPTION',
      description: null,
      isActive: false,
      permissions,
    } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    roleRepository.save.mockResolvedValue(role);
    await service.updateAdministrative(
      5,
      {
        description: ' Updated ',
        name: 'SUPERADMIN',
        permissionNames: [],
        isActive: true,
      } as never,
      7,
    );
    expect(role).toMatchObject({
      name: 'RECEPTION',
      description: 'Updated',
      isActive: false,
      updatedBy: 7,
    });
    expect(role.permissions).toBe(permissions);
    expect(permissionsService.getOneByName).not.toHaveBeenCalled();
    expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { idRole: 5 } });
    await service.updateAdministrative(5, { description: '' }, 7);
    expect(role.description).toBeNull();
  });

  it.each(MEDISUR_ROLES)(
    'protects the base role $name from deactivation and legacy code changes',
    async ({ name }) => {
      const role = { idRole: 1, name, isActive: true, permissions: [] } as unknown as Role;
      roleRepository.findOne.mockResolvedValue(role);
      await expect(service.delete(1, 7)).rejects.toThrow('Los roles base');
      await expect(service.update(1, { name: 'CUSTOM', permissionNames: [] }, 7)).rejects.toThrow(
        'código interno',
      );
      expect(role).toMatchObject({ name, isActive: true, permissions: [] });
      expect(roleRepository.save).not.toHaveBeenCalled();
    },
  );

  it('retains associations and audit fields when deactivating/reactivating custom roles', async () => {
    const role = {
      idRole: 5,
      name: 'RECEPTION',
      isActive: true,
      permissions: [{ name: 'user.get-all' }],
    } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    await service.delete(5, 7);
    expect(role).toMatchObject({
      isActive: false,
      deletedBy: 7,
      updatedBy: 7,
      permissions: [{ name: 'user.get-all' }],
    });
    await service.reactivate(5, 8);
    expect(role).toMatchObject({ isActive: true, updatedBy: 8 });
    expect(roleRepository.save).toHaveBeenCalledTimes(2);
  });

  it('allows reactivation and administrative description edits for a legacy inactive base role', async () => {
    const role = { idRole: 1, name: 'SUPERADMIN', isActive: false } as Role;
    roleRepository.findOne.mockResolvedValue(role);
    await service.reactivate(1, 7);
    await service.updateAdministrative(1, { description: 'Administración' }, 7);
    expect(role).toMatchObject({
      name: 'SUPERADMIN',
      isActive: true,
      description: 'Administración',
    });
  });

  it('paginates roles with existing status filters, literal search and base-role metadata', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          { idRole: 1, name: 'SUPERADMIN', permissions: [{ name: 'role.get-all' }] },
          { idRole: 5, name: 'RECEPTION', permissions: [] },
        ],
        12,
      ]),
    };
    roleRepository.createQueryBuilder.mockReturnValue(qb);
    const result = await service.getAll(
      Object.assign(new RolesQueryDto(), {
        page: 2,
        limit: 10,
        status: RecordStatus.INACTIVE,
        search: ' admin_% ',
      }),
    );
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.andWhere).toHaveBeenCalledWith('role.isActive = :isActive', { isActive: false });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { search: '%admin\\_\\%%' });
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 12, totalPages: 2 });
    expect(result.data[0]).toMatchObject({
      name: 'SUPERADMIN',
      isSystem: true,
      permissionCount: 1,
    });
    expect(result.data[1]).toMatchObject({
      name: 'RECEPTION',
      isSystem: false,
      permissionCount: 0,
    });
    qb.andWhere.mockClear();
    await service.getAll();
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('rejects administrative operations on absent roles', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    await expect(service.updateAdministrative(99, { description: 'Missing' }, 7)).rejects.toThrow(
      'Role not found',
    );
    await expect(service.delete(99, 7)).rejects.toThrow('Role not found');
    await expect(service.reactivate(99, 7)).rejects.toThrow('Role not found');
    expect(roleRepository.save).not.toHaveBeenCalled();
  });
});
