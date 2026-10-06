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

describe('AuthService', () => {
  let service: AuthService;
  const getForAuthentication = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { ...mockUsersService, getForAuthentication } },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SessionsService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('validates the hash but never passes it to session creation or login responses', async () => {
    getForAuthentication.mockResolvedValue({
      idUser: 1,
      username: 'test',
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
      expect.objectContaining({ user: { idUser: 1, username: 'test', roles: [] } }),
    );
    expect(JSON.stringify(response)).not.toContain('password');
  });

  it('rejects invalid credentials and missing or inactive users', async () => {
    getForAuthentication.mockResolvedValue({ password: await bcrypt.hash('secret', 4) });
    await expect(
      service.validateUser({ username: 'test', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    getForAuthentication.mockResolvedValue(null);
    await expect(
      service.validateUser({ username: 'test', password: 'secret' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
