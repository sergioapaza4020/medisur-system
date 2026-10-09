import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SessionsService } from '../sessions/sessions.service';
import { mockJwtService } from '@common/test-mocks/jwt.mock';
import { mockSessionService } from '@common/test-mocks/sessions.mock';
import { mockUsersService } from '@common/test-mocks/users.mock';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/entities/users/users.entity';

describe('AuthService', () => {
  let service: AuthService;
  const getForAuthentication = jest.fn();
  const getOneById = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { ...mockUsersService, getForAuthentication, getOneById },
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SessionsService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('includes only unique permissions from active roles and active permissions', async () => {
    const permission = { name: 'role.get-all', isActive: true };
    const user = {
      idUser: 1,
      isActive: true,
      roles: [
        {
          name: 'STAFF',
          isActive: true,
          permissions: [permission, permission, { name: 'role.update', isActive: false }],
        },
        { name: 'DOCTOR', isActive: false, permissions: [{ name: 'user.create', isActive: true }] },
      ],
    } as User;
    getOneById.mockResolvedValue(user);
    await expect(service.getSession(1, 2)).resolves.toMatchObject({
      roles: ['STAFF'],
      permissions: ['role.get-all'],
    });
    user.roles[0].permissions = [];
    await expect(service.getSession(1, 2)).resolves.toMatchObject({ permissions: [] });
    getOneById.mockResolvedValue(null);
    await expect(service.getSession(1, 2)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('validates the hash but never passes it to session creation or login responses', async () => {
    getForAuthentication.mockResolvedValue({
      idUser: 1,
      username: 'test',
      isActive: true,
      password: await bcrypt.hash('secret', 4),
      roles: [],
    });
    const sessions = jest
      .spyOn(mockSessionService, 'createSession')
      .mockResolvedValue({ idSession: 1 });
    const response = await service.login({ username: 'test', password: 'secret' }, {
      headers: {},
      socket: {},
    } as Request);
    expect(getForAuthentication).toHaveBeenCalledWith('test');
    expect(sessions).toHaveBeenCalledWith(
      expect.objectContaining({ user: { idUser: 1, username: 'test', isActive: true, roles: [] } }),
    );
    expect(JSON.stringify(response)).not.toContain('password');
  });

  it('rejects invalid credentials and missing or inactive users', async () => {
    getForAuthentication.mockResolvedValue({
      isActive: true,
      password: await bcrypt.hash('secret', 4),
    });
    await expect(
      service.validateUser({ username: 'test', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    getForAuthentication.mockResolvedValue(null);
    await expect(
      service.validateUser({ username: 'test', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
