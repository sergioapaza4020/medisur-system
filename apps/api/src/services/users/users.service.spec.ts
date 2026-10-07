import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { mockUserRepository } from '@common/test-mocks/users.mock';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';

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

describe('User role assignments', () => {
  const repository = { findOne: jest.fn(), save: jest.fn() };
  const roles = { getOneByName: jest.fn() };
  const service = new UsersService(
    repository as unknown as Repository<User>,
    roles as unknown as RolesService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('normalizes and deduplicates names and rejects an existing association', async () => {
    const user = { roles: [] } as unknown as User;
    const role = { idRole: 1, name: 'STAFF' } as Role;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName.mockResolvedValue(role);
    await service.assignRoles(1, [' staff ', 'STAFF']);
    expect(user.roles).toEqual([role]);
    expect(roles.getOneByName).toHaveBeenCalledTimes(1);
    repository.save.mockClear();
    await expect(service.assignRoles(1, ['staff'])).rejects.toThrow('Role already assigned');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not partially assign roles when any role is missing or inactive', async () => {
    const user = { roles: [] } as unknown as User;
    repository.findOne.mockResolvedValue(user);
    roles.getOneByName
      .mockResolvedValueOnce({ idRole: 1, name: 'STAFF' })
      .mockResolvedValueOnce(null);
    await expect(service.assignRoles(1, ['STAFF', 'DOCTOR'])).rejects.toThrow('Role not found');
    expect(user.roles).toEqual([]);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
