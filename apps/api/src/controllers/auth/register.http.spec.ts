import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { UsersController } from '../users/users.controller';
import { AuthService } from 'src/services/auth/auth.service';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { User } from 'src/entities/users/users.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { JwtStrategy } from 'src/core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from 'src/core/guards/auth/auth.guard';
import { PermissionsGuard } from 'src/core/guards/permissions/permissions.guard';
import { createValidationPipe } from 'src/core/pipes/validation.pipe';
import { ResponseInterceptor } from 'src/core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from 'src/core/filters/http-exception/http-exception.filter';
import { QueryFailedError } from 'typeorm';

describe('Patient registration over HTTP (HU-USR-02 and HU-USR-03)', () => {
  let app: INestApplication;
  let server: Server;
  let users: User[];
  let sessions: UserSession[];
  let patient: Role;
  let racingDuplicate: boolean;
  let previous: Record<string, string | undefined>;
  const keys = [
    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_REFRESH',
    'JWT_ACCESS_SECRET_EXPIRES_IN',
    'JWT_ACCESS_REFRESH_EXPIRES_IN',
  ];
  const valid = {
    name: 'Ana María',
    lastname: 'Pérez',
    email: 'ana@example.com',
    ci: '1234567-1A',
    password: 'Segura123',
  };
  const matches = (user: User, where: Partial<User>) =>
    Object.entries(where).every(([key, value]) => user[key as keyof User] === value);
  const userRepository = {
    findOne: ({ where }: { where: Partial<User> | Partial<User>[] }) =>
      Promise.resolve(
        users.find((user) =>
          (Array.isArray(where) ? where : [where]).some((filter) => matches(user, filter)),
        ) ?? null,
      ),
    create: (fields: Partial<User>) => Object.assign(new User(), { isActive: true }, fields),
    save: jest.fn((user: User) => {
      if (racingDuplicate)
        throw new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('duplicate'), { code: '23505' }),
        );
      user.idUser = users.length + 1;
      users.push(user);
      return Promise.resolve(user);
    }),
    createQueryBuilder: () => {
      let email: string;
      let search: string | undefined;
      let isActive: boolean | undefined;
      let skip = 0;
      let take = 10;
      const qb = {
        orderBy: () => qb,
        andWhere: (_: string, params: { search?: string; isActive?: boolean }) => {
          if (params.search !== undefined) search = params.search.slice(1, -1).toLowerCase();
          if (params.isActive !== undefined) isActive = params.isActive;
          return qb;
        },
        skip: (value: number) => {
          skip = value;
          return qb;
        },
        take: (value: number) => {
          take = value;
          return qb;
        },
        getManyAndCount: () => {
          const matches = users.filter(
            (user) =>
              (isActive === undefined || user.isActive === isActive) &&
              (!search ||
                [user.name, user.lastname, user.email, user.ci].some((field) =>
                  field?.toLowerCase().includes(search!),
                )),
          );
          return Promise.resolve([matches.slice(skip, skip + take), matches.length]);
        },
        addSelect: () => qb,
        leftJoinAndSelect: () => qb,
        where: (_: string, params: { email: string }) => {
          email = params.email;
          return qb;
        },
        getOne: () =>
          Promise.resolve(
            users.find((user) => user.email === email && user.isActive)
              ? Object.assign(
                  new User(),
                  users.find((user) => user.email === email),
                )
              : null,
          ),
      };
      return qb;
    },
  };
  const sessionRepository = {
    create: (fields: Partial<UserSession>) =>
      Object.assign(new UserSession(), { isActive: true }, fields),
    save: (session: UserSession) => {
      session.idSession = sessions.length + 1;
      sessions.push(session);
      return Promise.resolve(session);
    },
    findOne: ({ where }: { where: { idSession: number; user: { idUser: number } } }) =>
      Promise.resolve(
        sessions.find(
          (session) =>
            session.idSession === where.idSession &&
            session.user.idUser === where.user.idUser &&
            session.isActive &&
            session.user.isActive,
        ) ?? null,
      ),
  };

  beforeAll(async () => {
    previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      JWT_ACCESS_SECRET: 'register-access',
      JWT_ACCESS_REFRESH: 'register-refresh',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        AuthService,
        UsersService,
        SessionsService,
        JwtService,
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(UserSession), useValue: sessionRepository },
        {
          provide: RolesService,
          useValue: {
            getOneByName: (name: string) =>
              Promise.resolve(name === 'PATIENT' && patient.isActive ? patient : null),
          },
        },
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
  beforeEach(() => {
    users = [];
    sessions = [];
    racingDuplicate = false;
    userRepository.save.mockClear();
    patient = Object.assign(new Role(), {
      idRole: 4,
      name: 'PATIENT',
      isActive: true,
      permissions: [],
    });
  });

  async function administrativeToken(granted = true, name = 'STAFF') {
    const actor = Object.assign(new User(), {
      idUser: users.length + 1,
      name: 'Personal',
      lastname: 'Administrativo',
      email: 'staff@example.com',
      ci: 'STAFF123',
      isActive: true,
      password: await bcrypt.hash('Staff1234', 4),
      roles: [
        {
          name,
          isActive: true,
          permissions: granted ? [{ name: 'user.create-patient', isActive: true }] : [],
        },
      ],
    });
    users.push(actor);
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: actor.email, password: 'Staff1234' })
      .expect(201);
    return (response.body as { data: { accessToken: string } }).data.accessToken;
  }

  it('allows the specific registration permission without general user/role administration and attributes the author from the session', async () => {
    const token = await administrativeToken();
    const response = await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send({
        ...valid,
        email: ' ANA@EXAMPLE.COM ',
        roleNames: ['SUPERADMIN'],
        permissions: ['user.create'],
        createdBy: 999,
        isActive: false,
      })
      .expect(201);
    expect(response.body as unknown).toMatchObject({ data: { idUser: 2, email: valid.email } });
    expect(users[1]).toMatchObject({
      email: valid.email,
      roles: [patient],
      isActive: true,
      createdBy: 1,
    });
    expect(await bcrypt.compare(valid.password, users[1].password)).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/password|Segura123/);
    await request(server).get('/api/users').auth(token, { type: 'bearer' }).expect(403);
    await request(server)
      .post('/api/users')
      .auth(token, { type: 'bearer' })
      .send({ ...valid, roleNames: ['SUPERADMIN'] })
      .expect(403);
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password })
      .expect(201);
    const patientToken = (login.body as { data: { accessToken: string } }).data.accessToken;
    const current = await request(server)
      .get('/api/auth/me')
      .auth(patientToken, { type: 'bearer' })
      .expect(200);
    expect(current.body as unknown).toMatchObject({
      data: { roles: ['PATIENT'], permissions: [] },
    });
  });

  it('rejects direct anonymous and unauthorized registration/search, including SUPERADMIN without grants', async () => {
    await request(server).post('/api/users/patient-registration').send(valid).expect(401);
    await request(server).get('/api/users/patient-registration?search=123').expect(401);
    const token = await administrativeToken(false, 'SUPERADMIN');
    await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send(valid)
      .expect(403);
    await request(server)
      .get('/api/users/patient-registration?search=123')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('finds prior inactive and non-patient accounts with paginated minimum identity data and validates query parameters', async () => {
    const token = await administrativeToken();
    await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send(valid)
      .expect(201);
    users[1].isActive = false;
    const found = await request(server)
      .get('/api/users/patient-registration?search=123&status=all&limit=1')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(found.body as unknown).toMatchObject({
      meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
      data: [{ isPatient: false }],
    });
    const next = await request(server)
      .get('/api/users/patient-registration?search=123&status=all&limit=1&page=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(next.body as unknown).toMatchObject({
      data: [{ email: valid.email, isPatient: true, isActive: false }],
    });
    expect(JSON.stringify(next.body)).not.toMatch(/password|createdBy|permissions|Segura123/);
    await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send(valid)
      .expect(400);
    for (const query of [
      '',
      'search=a',
      'search=123&page=0',
      'search=123&limit=101',
      'search=123&status=invalid',
    ]) {
      await request(server)
        .get('/api/users/patient-registration?' + query)
        .auth(token, { type: 'bearer' })
        .expect(400);
    }
    const empty = await request(server)
      .get('/api/users/patient-registration?search=absent&status=all')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(empty.body as unknown).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it('validates administrative input and uniqueness races before persisting partial records', async () => {
    const token = await administrativeToken();
    for (const invalid of [
      {},
      { ...valid, password: 'short' },
      { ...valid, email: 'invalid' },
      { ...valid, ci: null },
    ]) {
      await request(server)
        .post('/api/users/patient-registration')
        .auth(token, { type: 'bearer' })
        .send(invalid)
        .expect(400);
    }
    expect(userRepository.save).not.toHaveBeenCalled();
    racingDuplicate = true;
    await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send(valid)
      .expect(400);
    expect(users).toHaveLength(1);
    racingDuplicate = false;
    patient.isActive = false;
    await request(server)
      .post('/api/users/patient-registration')
      .auth(token, { type: 'bearer' })
      .send(valid)
      .expect(503);
    expect(users).toHaveLength(1);
  });
  afterAll(async () => {
    await app?.close();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it('registers publicly using the existing hash, assigns only PATIENT, then authenticates with no administrative access', async () => {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ ...valid, name: ' Ana María ', email: ' ANA@example.com ' })
      .expect(201);
    expect(response.body as unknown).toMatchObject({
      data: { idUser: 1, email: valid.email },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/password|Segura123|\$2b\$/);
    expect(users[0].roles).toEqual([patient]);
    expect(users[0].createdBy).toBeUndefined();
    expect(users[0].isActive).toBe(true);
    expect(users[0].name).toBe('Ana María');
    expect(await bcrypt.compare(valid.password, users[0].password)).toBe(true);
    expect(bcrypt.getRounds(users[0].password)).toBe(10);
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password })
      .expect(201);
    const token = (login.body as { data: { accessToken: string } }).data.accessToken;
    const current = await request(server)
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(current.body as unknown).toMatchObject({
      data: { email: valid.email, roles: ['PATIENT'], permissions: [] },
    });
    await request(server).get('/api/users').auth(token, { type: 'bearer' }).expect(403);
  });

  it.each(['email', 'ci'] as const)(
    'rejects duplicate %s including inactive accounts',
    async (field) => {
      await request(server).post('/api/auth/register').send(valid).expect(201);
      users[0].isActive = false;
      const other = {
        ...valid,
        email: 'other@example.com',
        ci: '999999',
        [field]: valid[field],
      };
      const duplicate = await request(server).post('/api/auth/register').send(other).expect(400);
      expect(duplicate.body as unknown).toMatchObject({
        message: 'Ya existe una cuenta con ese correo electrónico o documento',
      });
      expect(users).toHaveLength(1);
    },
  );

  it('ignores privilege fields and nested associations, never trusting public authors or state', async () => {
    await request(server)
      .post('/api/auth/register')
      .send({
        ...valid,
        roleNames: ['SUPERADMIN'],
        roles: [{ name: 'SUPERADMIN' }],
        permissions: ['user.create'],
        permissionNames: ['user.create'],
        isActive: false,
        idUser: 99,
        createdBy: 99,
        updatedBy: 99,
        deletedAt: '2020-01-01',
        passwordHash: 'injected',
      })
      .expect(201);
    expect(users[0]).toMatchObject({ idUser: 1, isActive: true, roles: [patient] });
    for (const field of [
      'createdBy',
      'updatedBy',
      'deletedAt',
      'permissions',
      'permissionNames',
      'passwordHash',
    ])
      expect((users[0] as unknown as Record<string, unknown>)[field]).toBeUndefined();
    expect(users[0].password).not.toBe('injected');
  });

  it.each([
    { name: '' },
    { name: 'Ana123' },
    { lastname: '   ' },
    { email: 'invalid' },
    { ci: '<script>' },
    { password: 'short' },
    { password: 'onlylowercase' },
    { password: 'abcdefgh' },
    { password: 'Abcdefgh' },
    { password: 'ABCDEFG1' },
    { password: 'A1' + 'á'.repeat(36) },
    { email: null },
  ])('validates required fields and formats before saving: %j', async (invalid) => {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ ...valid, ...invalid })
      .expect(400);
    expect(JSON.stringify(response.body)).not.toContain(valid.password);
    expect(JSON.stringify(response.body)).not.toMatch(/bytes|UTF-8|bcrypt|72 bits/);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(users).toEqual([]);
  });

  it('rejects all missing mandatory fields and accepts the exact bcrypt byte boundary', async () => {
    await request(server).post('/api/auth/register').send({}).expect(400);
    await request(server)
      .post('/api/auth/register')
      .send({ ...valid, password: 'Aa1' + 'x'.repeat(69) })
      .expect(201);
  });

  it('reports uniqueness races without database details and refuses an unavailable PATIENT role', async () => {
    racingDuplicate = true;
    const duplicate = await request(server).post('/api/auth/register').send(valid).expect(400);
    expect(JSON.stringify(duplicate.body)).not.toMatch(/23505|INSERT|password/);
    expect(users).toEqual([]);
    racingDuplicate = false;
    patient.isActive = false;
    await request(server).post('/api/auth/register').send(valid).expect(503);
    expect(users).toEqual([]);
  });
});
