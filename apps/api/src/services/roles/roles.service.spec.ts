import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;

  const roleRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const permissionsService = {
    getOneByName: jest.fn(),
  };

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

  it('creates a role with its permissions in a single save', async () => {
    const permission = {
      idPermission: 1,
      name: 'role.get-all',
    } as Permission;
    const createdRole = {
      idRole: 1,
      name: 'COORDINATOR',
      description: 'Course coordinator',
      permissions: [permission],
    } as Role;

    roleRepository.findOne.mockResolvedValue(null);
    permissionsService.getOneByName.mockResolvedValue(permission);
    roleRepository.create.mockReturnValue(createdRole);
    roleRepository.save.mockResolvedValue(createdRole);

    await expect(
      service.create({
        name: ' coordinator ',
        description: 'Course coordinator',
        permissionNames: [permission.name],
      }),
    ).resolves.toBe(createdRole);

    expect(roleRepository.create).toHaveBeenCalledWith({
      name: 'COORDINATOR',
      description: 'Course coordinator',
      permissions: [permission],
    });
    expect(roleRepository.save).toHaveBeenCalledTimes(1);
  });

  it('does not persist a role when a requested permission does not exist', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    permissionsService.getOneByName.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'COORDINATOR',
        description: 'Course coordinator',
        permissionNames: ['role.unknown'],
      }),
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
      name: 'COORDINATOR',
      description: 'Course coordinator',
      permissions: [previousPermission],
    } as Role;

    roleRepository.findOne.mockResolvedValueOnce(role).mockResolvedValueOnce(null);
    permissionsService.getOneByName.mockResolvedValue(updatedPermission);
    roleRepository.save.mockResolvedValue(role);

    await expect(
      service.update(1, {
        name: 'academic coordinator',
        description: 'Updated description',
        permissionNames: [updatedPermission.name],
      }),
    ).resolves.toBe(role);

    expect(role).toMatchObject({
      name: 'ACADEMIC COORDINATOR',
      description: 'Updated description',
      permissions: [updatedPermission],
    });
    expect(roleRepository.save).toHaveBeenCalledWith(role);
  });
});
