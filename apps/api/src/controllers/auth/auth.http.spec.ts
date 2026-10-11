import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { SessionsController } from '../sessions/sessions.controller';
import { RolesController } from '../roles/roles.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Repository } from 'typeorm';
import { PermissionsService } from 'src/services/permissions/permissions.service';

interface Envelope<T> {
  data: T;
  message: string;
}
interface Tokens {
  accessToken: string;
  refreshToken: string;
  userSession: { idSession: number };
}

describe('HU-USR-01 authentication over HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let user: User;
  let sessions: UserSession[];
  let previous: Record<string, string | undefined>;
  const keys = [
    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_REFRESH',
    'JWT_ACCESS_SECRET_EXPIRES_IN',
    'JWT_ACCESS_REFRESH_EXPIRES_IN',
  ];
  const roleOperations = { getAll: () => [], assignPermissions: jest.fn() };
  const sessionRepository = {
    create: (value: Partial<UserSession>) =>
      Object.assign(new UserSession(), value, { isActive: true }),
    save: jest.fn((session: UserSession) => {
      if (!session.idSession) {
        session.idSession = sessions.length + 1;
        sessions.push(session);
      }
      return Promise.resolve(session);
    }),
    find: jest.fn(() => Promise.resolve(sessions.filter((s) => s.isActive))),
    findOne: jest.fn(({ where }: { where: { idSession: number; user: { idUser: number } } }) =>
      Promise.resolve(
        sessions.find(
          (s) =>
            s.idSession === where.idSession &&
            s.isActive &&
            s.user.isActive &&
            s.user.idUser === where.user.idUser,
        ) ?? null,
      ),
    ),
  };

  beforeAll(async () => {
    previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_ACCESS_REFRESH: 'test-refresh-secret',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController, SessionsController, RolesController],
      providers: [
        AuthService,
        SessionsService,
        JwtService,
        JwtStrategy,
        { provide: getRepositoryToken(UserSession), useValue: sessionRepository },
        {
          provide: UsersService,
          useValue: {
            getForAuthentication: (email: string) =>
              Promise.resolve(email === user.email ? Object.assign(new User(), user) : null),
            getOneById: (idUser: number) =>
              Promise.resolve(idUser === user.idUser && user.isActive ? user : null),
          },
        },
        { provide: RolesService, useValue: roleOperations },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    sessions = [];
    user = Object.assign(new User(), {
      idUser: 1,
      email: 'medisur@example.com',
      name: 'Ana',
      isActive: true,
      password: await bcrypt.hash('valid-password', 4),
      roles: [{ name: 'STAFF', isActive: true, permissions: [] }],
    });
  });

  afterAll(async () => {
    await app?.close();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  async function login() {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: ' MEDISUR@example.com ', password: 'valid-password' })
      .expect(201);
    return (response.body as Envelope<Tokens>).data;
  }

  it('logs in, identifies the current user, and does not expose password or refresh hashes', async () => {
    const tokens = await login();
    expect(tokens.userSession).toHaveProperty('idSession');
    const jwt = new JwtService();
    expect(jwt.decode(tokens.accessToken)).not.toHaveProperty('username');
    expect(jwt.decode(tokens.refreshToken)).not.toHaveProperty('username');
    expect(JSON.stringify(tokens)).not.toContain('password');
    expect(tokens.userSession).not.toHaveProperty('refreshToken');
    const response = await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    expect((response.body as Envelope<unknown>).data).not.toHaveProperty('username');
    expect((response.body as Envelope<unknown>).data).toMatchObject({
      idUser: 1,
      email: 'medisur@example.com',
      roles: ['STAFF'],
      permissions: [],
    });
  });

  it('uses the same 401 message for wrong credentials, absent users, and inactive accounts', async () => {
    const wrong = await request(server)
      .post('/api/auth/login')
      .send({ email: 'medisur@example.com', password: 'wrong' })
      .expect(401);
    const missing = await request(server)
      .post('/api/auth/login')
      .send({ email: 'absent@example.com', password: 'valid-password' })
      .expect(401);
    user.isActive = false;
    const inactive = await request(server)
      .post('/api/auth/login')
      .send({ email: ' MEDISUR@example.com ', password: 'valid-password' })
      .expect(401);
    expect((wrong.body as Envelope<unknown>).message).toBe('Credenciales inválidas');
    expect((missing.body as Envelope<unknown>).message).toBe(
      (wrong.body as Envelope<unknown>).message,
    );
    expect((inactive.body as Envelope<unknown>).message).toBe(
      (wrong.body as Envelope<unknown>).message,
    );
    expect(sessions).toHaveLength(0);
  });

  it('rejects unauthenticated access and distinguishes authentication from authorization', async () => {
    await request(server).get('/api/auth/me').expect(401);
    const tokens = await login();
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(403);
    user.roles[0].permissions = [{ name: 'role.get-all', isActive: true } as Permission];
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('removes and restores live capabilities when an assigned role is deactivated and reactivated', async () => {
    user.roles[0].permissions = [{ name: 'role.get-all', isActive: true } as Permission];
    const tokens = await login();
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    user.roles[0].isActive = false;
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(403);
    const current = await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    expect(current.body as unknown).toMatchObject({ data: { roles: [], permissions: [] } });
    expect(user.roles).toHaveLength(1);
    user.roles[0].isActive = true;
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('applies batch grants and withdrawals to an existing session without implicit SUPERADMIN or clinical capabilities', async () => {
    const assignedRole = user.roles[0];
    assignedRole.idRole = 1;
    assignedRole.name = 'SUPERADMIN';
    const assignment = Object.assign(new Permission(), {
      name: 'role.assign-permissions',
      isActive: true,
    });
    const read = Object.assign(new Permission(), { name: 'role.get-all', isActive: true });
    assignedRole.permissions = [assignment];
    const roles = new RolesService(
      {
        findOne: () => Promise.resolve(assignedRole),
        save: (role: Role) => Promise.resolve(role),
      } as unknown as Repository<Role>,
      {
        getOneByName: (name: string) => Promise.resolve(name === read.name ? read : null),
      } as PermissionsService,
    );
    roleOperations.assignPermissions.mockImplementation(
      (id: number, names: string[], author: number, replace: boolean) =>
        roles.assignPermissions(id, names, author, replace),
    );
    const tokens = await login();
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .put('/api/roles/assign-permissions/1')
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ permissionNames: [assignment.name, read.name] })
      .expect(200);
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    await request(server)
      .put('/api/roles/assign-permissions/1')
      .auth(tokens.accessToken, { type: 'bearer' })
      .send({ permissionNames: [assignment.name] })
      .expect(200);
    await request(server)
      .get('/api/roles')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(403);
    const current = await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    expect(current.body as unknown).toMatchObject({
      data: { roles: ['SUPERADMIN'], permissions: [assignment.name] },
    });
  });

  it('renews access and revokes both access and refresh after logout', async () => {
    const tokens = await login();
    const renewed = await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(201);
    const accessToken = (renewed.body as Envelope<{ accessToken: string }>).data.accessToken;
    await request(server).get('/api/auth/me').auth(accessToken, { type: 'bearer' }).expect(200);
    await request(server)
      .post('/api/sessions/logout')
      .auth(accessToken, { type: 'bearer' })
      .send({ refreshToken: tokens.refreshToken })
      .expect(201);
    await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });

  it('rejects invalid refresh, expired sessions and a user disabled after login', async () => {
    await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: 'invalid' })
      .expect(401);
    const tokens = await login();
    sessions[0].expiresAt = new Date(0);
    await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
    sessions[0].expiresAt = new Date(Date.now() + 60000);
    user.isActive = false;
    await request(server)
      .get('/api/auth/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });

  it('issues distinct refresh tokens for simultaneous logins', async () => {
    const first = await login();
    const second = await login();
    expect(first.refreshToken).not.toBe(second.refreshToken);
    await request(server)
      .post('/api/sessions/logout')
      .auth(first.accessToken, { type: 'bearer' })
      .send({ refreshToken: first.refreshToken })
      .expect(201);
    await request(server)
      .get('/api/auth/me')
      .auth(second.accessToken, { type: 'bearer' })
      .expect(200);
  });
});
