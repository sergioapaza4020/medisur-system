import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { mockSessionService } from '@common/test-mocks/sessions.mock';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { User } from 'src/entities/users/users.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: SessionsService, useValue: mockSessionService }],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('Session validation', () => {
  const repository = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const service = new SessionsService(repository as unknown as Repository<UserSession>);

  beforeEach(() => jest.resetAllMocks());

  it('rejects incomplete JWT identities without querying a session', async () => {
    for (const [idUser, idSession] of [
      [1, undefined],
      [0, 1],
      [1, -1],
    ]) {
      await expect(
        service.validateAccessSession(idUser as number, idSession as number),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('does not allow logging out another user using their refresh token', async () => {
    const session = {
      user: { idUser: 2, isActive: true },
      isActive: true,
      expiresAt: new Date(Date.now() + 60000),
      refreshToken: await bcrypt.hash('other-refresh', 4),
    } as UserSession;
    repository.find.mockResolvedValue([session]);
    await expect(service.logout('other-refresh', { idUser: 1 } as User)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(session.isActive).toBe(true);
  });
});
