import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { MyAccountController } from './my-account.controller';
import { UsersController } from './users.controller';
import { AuthController } from '../auth/auth.controller';
import { MyAccountService } from 'src/services/users/my-account.service';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { AuthService } from 'src/services/auth/auth.service';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { StorageService } from 'src/services/storage/storage.service';
import { StorageProvider } from 'src/services/storage/storage.provider';
import { STORAGE_CONFIG } from 'src/services/storage/storage.config';
import { storageTestImage } from 'src/common/test-mocks/storage-image.mock';

describe('HU-USR-08 own account over HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let users: User[];
  let sessions: UserSession[];
  let token: string;
  const jwt = new JwtService();
  const secret = 'account-test-secret';
  const source = { transaction: jest.fn(), query: jest.fn() };
  const previousKey = 'images/profiles/12345678-abcd-4abc-8abc-123456789abc.png';
  const provider = {
    upload: jest.fn<Promise<void>, [string, Buffer, string]>(),
    delete: jest.fn<Promise<void>, [string]>(),
    getPublicUrl: (key: string) => `https://storage.example.test/${key}`,
  };

  const userRepository = {
    findOne: jest.fn(({ where }: { where: Partial<User> }) =>
      Promise.resolve(
        users.find((user) =>
          Object.entries(where).every(([key, value]) => user[key as keyof User] === value),
        ) ?? null,
      ),
    ),
    merge: (user: User, fields: Partial<User>) =>
      Object.assign(
        user,
        Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
      ),
    save: jest.fn((user: User) => Promise.resolve(user)),
    update: jest.fn(({ idUser }: { idUser: number }, fields: Partial<User>) => {
      Object.assign(
        users.find((user) => user.idUser === idUser)!,
        fields,
      );
      return Promise.resolve({ affected: 1 });
    }),
    exists: jest.fn(),
    createQueryBuilder: () => {
      let params: { email?: string; idUser?: number } = {};
      const builder = {
        addSelect: () => builder,
        leftJoinAndSelect: () => builder,
        where: (_: string, values: typeof params) => {
          params = values;
          return builder;
        },
        setLock: () => builder,
        getOne: () =>
          Promise.resolve(
            users.find(
              (user) =>
                user.isActive &&
                (params.idUser !== undefined
                  ? user.idUser === params.idUser
                  : user.email === params.email),
            ) ?? null,
          ),
      };
      return builder;
    },
  };
  const sessionRepository = {
    findOne: ({ where }: { where: { idSession: number; user: { idUser: number } } }) =>
      Promise.resolve(
        sessions.find(
          (session) =>
            session.isActive &&
            session.user.isActive &&
            session.idSession === where.idSession &&
            session.user.idUser === where.user.idUser,
        ) ?? null,
      ),
    find: () => Promise.resolve(sessions.filter((session) => session.isActive)),
    update: jest.fn((where: { user: { idUser: number } }, fields: Partial<UserSession>) => {
      sessions
        .filter((session) => session.user.idUser === where.user.idUser && session.isActive)
        .forEach((session) => Object.assign(session, fields));
      return Promise.resolve({ affected: 1 });
    }),
  };
  const manager = {
    query: source.query,
    getRepository: (entity: unknown) => (entity === User ? userRepository : sessionRepository),
  } as unknown as EntityManager;
  let previousSecret: string | undefined;

  beforeAll(async () => {
    previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = secret;
    source.transaction.mockImplementation(
      (callback: (manager: EntityManager) => Promise<unknown>) => callback(manager),
    );
    const module = await Test.createTestingModule({
      controllers: [MyAccountController, UsersController, AuthController],
      providers: [
        MyAccountService,
        StorageService,
        { provide: StorageProvider, useValue: provider },
        { provide: STORAGE_CONFIG, useValue: { maxImageSize: 1024 } },
        UsersService,
        AuthService,
        SessionsService,
        JwtService,
        JwtStrategy,
        { provide: DataSource, useValue: source },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(UserSession), useValue: sessionRepository },
        { provide: RolesService, useValue: {} },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    provider.upload.mockReset().mockResolvedValue(undefined);
    provider.delete.mockReset().mockResolvedValue(undefined);
    users = [1, 2].map((idUser) =>
      Object.assign(new User(), {
        idUser,
        name: idUser === 1 ? 'Ana' : 'Luis',
        lastname: 'Perez',
        ci: `12345${idUser}`,
        email: `user${idUser}@example.com`,
        isActive: true,
        roles: [Object.assign(new Role(), { name: 'PATIENT', isActive: true, permissions: [] })],
      }),
    );
    users[0].password = await bcrypt.hash('Anterior123', 4);
    sessions = [1, 2].map((idSession) =>
      Object.assign(new UserSession(), {
        idSession,
        user: users[0],
        isActive: true,
        expiresAt: new Date(Date.now() + 60000),
        refreshToken: 'not-exposed',
      }),
    );
    token = jwt.sign({ idUser: 1, idSession: 1 }, { secret, expiresIn: '1m' });
    userRepository.exists.mockReset().mockResolvedValue(false);
  });

  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  function own(method: 'get' | 'patch' | 'post', path = '') {
    return request(server)[method](`/api/users/me${path}`).auth(token, { type: 'bearer' });
  }

  it('returns only personal fields without requiring administrative permissions', async () => {
    const response = await own('get').expect(200);
    expect((response.body as { data: unknown }).data).toEqual({
      avatarUrl: null,
      avatarUpload: { maxSize: 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      name: 'Ana',
      lastname: 'Perez',
      email: users[0].email,
      ci: users[0].ci,
    });
  });

  it.each([
    ['get', ''],
    ['patch', ''],
    ['post', '/password'],
    ['post', '/deactivate'],
  ] as const)('rejects unauthenticated %s %s', async (method, path) => {
    await request(server)[method](`/api/users/me${path}`).send({ name: 'Maria' }).expect(401);
  });

  it('persists partial changes and normalizes email using existing user update logic', async () => {
    const response = await own('patch')
      .send({ name: ' Maria ', email: ' NUEVO@Example.com ' })
      .expect(200);
    expect((response.body as { data: unknown }).data).toMatchObject({
      name: 'Maria',
      email: 'nuevo@example.com',
      ci: '123451',
    });
    expect(users[0].email).toBe('nuevo@example.com');
    expect(users[0].updatedBy).toBe(1);
    await own('get')
      .expect(200)
      .expect(({ body }: { body: { data: { name: string } } }) =>
        expect(body.data.name).toBe('Maria'),
      );
    expect(users[1].name).toBe('Luis');
  });

  it.each(['email', 'ci'] as const)('rejects duplicate %s', async (field) => {
    await own('patch')
      .send({ [field]: users[1][field] })
      .expect(400);
    expect(users[0][field]).not.toBe(users[1][field]);
  });

  it.each([
    { roles: ['SUPERADMIN'] },
    { permissions: ['user.update'] },
    { roleNames: ['SUPERADMIN'] },
    { idUser: 2 },
    { isActive: false },
    { email: 'invalid' },
    { name: null },
    { ci: '' },
  ])('rejects privileged fields or invalid personal data: %j', async (payload) => {
    await own('patch').send(payload).expect(400);
    expect(users[0].isActive).toBe(true);
  });

  it('ignores internal fields and cannot modify another user through an ID route', async () => {
    await own('patch')
      .send({ createdBy: 999, password: 'Injected123', avatar: 'demo.png', name: 'Maria' })
      .expect(200);
    expect(users[0].createdBy).toBeUndefined();
    expect(users[0].avatar).toBeUndefined();
    expect(await bcrypt.compare('Anterior123', users[0].password)).toBe(true);
    await request(server)
      .patch('/api/users/2')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Maria' })
      .expect(403);
    expect(users[1].name).toBe('Luis');
  });

  it.each([
    { currentPassword: 'Incorrecta123', password: 'NuevaSegura123' },
    { currentPassword: 'Anterior123', password: 'weak' },
    { currentPassword: '', password: 'NuevaSegura123' },
    { currentPassword: 'Anterior123', password: 'Anterior123' },
  ])('rejects unsafe password changes: %j', async (payload) => {
    await own('post', '/password').send(payload).expect(400);
    expect(await bcrypt.compare('Anterior123', users[0].password)).toBe(true);
    expect(sessions.every((session) => session.isActive)).toBe(true);
  });

  it('hashes the password, invalidates all sessions and accepts only the new password at login', async () => {
    const oldHash = users[0].password;
    await own('post', '/password')
      .send({ currentPassword: 'Anterior123', password: 'NuevaSegura123' })
      .expect(201);
    expect(users[0].password).not.toBe(oldHash);
    expect(users[0].password).not.toBe('NuevaSegura123');
    expect(await bcrypt.compare('Anterior123', users[0].password)).toBe(false);
    expect(await bcrypt.compare('NuevaSegura123', users[0].password)).toBe(true);
    expect(sessions.every((session) => !session.isActive)).toBe(true);
    await own('get').expect(401);
    const auth = app.get(AuthService);
    await expect(
      auth.validateUser({ email: users[0].email, password: 'Anterior123' }),
    ).rejects.toThrow();
    // Return a fresh entity as a real query would; validateUser removes the selected hash.
    const query = jest
      .spyOn(app.get(UsersService), 'getForAuthentication')
      .mockResolvedValueOnce(Object.assign(new User(), users[0]));
    await expect(
      auth.validateUser({ email: users[0].email, password: 'NuevaSegura123' }),
    ).resolves.toMatchObject({ idUser: 1 });
    query.mockRestore();
  });

  it('deactivates logically, preserves data and denies login, access and refresh even with an active session', async () => {
    await own('post', '/deactivate').send({ idUser: 2 }).expect(201);
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ isActive: false, deletedBy: 1, updatedBy: 1, ci: '123451' });
    expect(users[1].isActive).toBe(true);
    expect(sessions.every((session) => !session.isActive)).toBe(true);
    sessions[0].isActive = true;
    await own('get').expect(401);
    await own('patch').send({ name: 'Maria' }).expect(401);
    await request(server)
      .post('/api/auth/login')
      .send({ email: users[0].email, password: 'Anterior123' })
      .expect(401);
    await expect(app.get(SessionsService).validateRefreshToken('any-token')).rejects.toThrow();
  });

  it('prevents the last active SUPERADMIN from self-deactivating', async () => {
    userRepository.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await own('post', '/deactivate').expect(400);
    expect(users[0].isActive).toBe(true);
    expect(sessions.every((session) => session.isActive)).toBe(true);
    expect(source.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(81008)');
  });

  it('allows a SUPERADMIN to deactivate when another active SUPERADMIN exists', async () => {
    userRepository.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    await own('post', '/deactivate').expect(201);
    expect(users[0].isActive).toBe(false);
  });

  it('uploads a validated file, stores only its key and exposes the URL in the account and session', async () => {
    const response = await own('post', '/avatar')
      .attach('avatar', storageTestImage(), 'foto.png')
      .expect(201);
    expect(users[0].avatar).toMatch(/^images\/profiles\/[a-f0-9-]{36}\.png$/);
    expect(provider.upload).toHaveBeenCalledWith(users[0].avatar, storageTestImage(), 'image/png');
    expect(users[0].updatedBy).toBe(1);
    const url = provider.getPublicUrl(users[0].avatar!);
    expect((response.body as { data: unknown }).data).toEqual({
      avatarUrl: url,
      cleanupPending: false,
    });
    await own('get')
      .expect(200)
      .expect(({ body }: { body: { data: { avatarUrl: string } } }) =>
        expect(body.data.avatarUrl).toBe(url),
      );
    await request(server)
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect(({ body }: { body: { data: { avatarUrl: string } } }) =>
        expect(body.data.avatarUrl).toBe(url),
      );
  });

  it.each(['post', 'delete'] as const)('requires authentication for avatar %s', async (method) => {
    await request(server)[method]('/api/users/me/avatar').expect(401);
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it('rejects missing images, invalid MIME, spoofed content, oversized files and multiple files', async () => {
    await own('post', '/avatar').expect(400);
    await own('post', '/avatar')
      .attach('avatar', Buffer.from('bad'), { filename: 'image.svg', contentType: 'image/svg+xml' })
      .expect(400);
    await own('post', '/avatar')
      .attach('avatar', Buffer.from('fake png'), {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(400);
    await own('post', '/avatar').attach('avatar', Buffer.alloc(1025), 'large.png').expect(413);
    await own('post', '/avatar')
      .attach('avatar', storageTestImage(), 'one.png')
      .attach('avatar', storageTestImage(), 'two.png')
      .expect(400);
    expect(provider.upload).not.toHaveBeenCalled();
  });

  it('commits the new reference before deleting the previous image', async () => {
    users[0].avatar = previousKey;
    await own('post', '/avatar').attach('avatar', storageTestImage(), 'photo.png').expect(201);
    expect(users[0].avatar).not.toBe(previousKey);
    expect(provider.delete).toHaveBeenCalledWith(previousKey);
    expect(provider.upload.mock.invocationCallOrder[0]).toBeLessThan(
      userRepository.update.mock.invocationCallOrder[0],
    );
    expect(userRepository.update.mock.invocationCallOrder[0]).toBeLessThan(
      provider.delete.mock.invocationCallOrder[0],
    );
  });

  it('preserves the previous image and DB reference if uploading fails', async () => {
    users[0].avatar = previousKey;
    provider.upload.mockRejectedValueOnce(
      new ServiceUnavailableException('No se pudo subir la imagen'),
    );
    await own('post', '/avatar').attach('avatar', storageTestImage(), 'photo.png').expect(503);
    expect(users[0].avatar).toBe(previousKey);
    expect(provider.delete).not.toHaveBeenCalledWith(previousKey);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('compensates a DB failure by deleting the new image and preserving the old one', async () => {
    users[0].avatar = previousKey;
    userRepository.update.mockRejectedValueOnce(new Error('database failure'));
    await own('post', '/avatar').attach('avatar', storageTestImage(), 'photo.png').expect(500);
    expect(users[0].avatar).toBe(previousKey);
    expect(provider.delete).toHaveBeenCalledWith(provider.upload.mock.calls[0][0]);
    expect(provider.delete).not.toHaveBeenCalledWith(previousKey);
  });

  it('rejects a stale concurrent replacement and cleans only its own new image', async () => {
    users[0].avatar = previousKey;
    const concurrentKey = 'images/profiles/87654321-abcd-4abc-8abc-123456789abc.png';
    source.transaction.mockImplementationOnce(
      async (callback: (manager: EntityManager) => Promise<unknown>) => {
        users[0].avatar = concurrentKey;
        return callback(manager);
      },
    );
    await own('post', '/avatar').attach('avatar', storageTestImage(), 'photo.png').expect(409);
    expect(users[0].avatar).toBe(concurrentKey);
    expect(provider.delete).not.toHaveBeenCalledWith(previousKey);
    expect(provider.delete).not.toHaveBeenCalledWith(concurrentKey);
  });

  it('clears the avatar reference before deletion and preserves another user image', async () => {
    users[0].avatar = previousKey;
    users[1].avatar = 'images/profiles/87654321-abcd-4abc-8abc-123456789abc.png';
    const response = await request(server)
      .delete('/api/users/me/avatar?idUser=2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((response.body as { data: unknown }).data).toEqual({
      avatarUrl: null,
      cleanupPending: false,
    });
    expect(users[0].avatar).toBeNull();
    expect(users[1].avatar).toBeTruthy();
    expect(provider.delete).toHaveBeenCalledWith(previousKey);
    expect(userRepository.update.mock.invocationCallOrder[0]).toBeLessThan(
      provider.delete.mock.invocationCallOrder[0],
    );
    await request(server)
      .delete('/api/users/me/avatar')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(provider.delete).toHaveBeenCalledTimes(1);
  });

  it('does not accept a target user, object key or external URL as multipart fields', async () => {
    for (const field of ['idUser', 'key', 'avatarUrl']) {
      await own('post', '/avatar')
        .field(field, 'attacker-controlled')
        .attach('avatar', storageTestImage(), 'photo.png')
        .expect(400);
    }
    await own('post', '/avatar?idUser=2')
      .attach('avatar', storageTestImage(), 'photo.png')
      .expect(201);
    expect(users[0].avatar).toBeTruthy();
    expect(users[1].avatar).toBeUndefined();
  });

  it('keeps the new reference and reports pending cleanup if old-image deletion fails', async () => {
    users[0].avatar = previousKey;
    provider.delete.mockRejectedValueOnce(new Error('cleanup unavailable'));
    const response = await own('post', '/avatar')
      .attach('avatar', storageTestImage(), 'photo.png')
      .expect(201);
    expect((response.body as { data: { cleanupPending: boolean } }).data.cleanupPending).toBe(true);
    expect(users[0].avatar).not.toBe(previousKey);
  });

  it('removes the visible photo and reports pending cleanup if Storage deletion fails', async () => {
    users[0].avatar = previousKey;
    provider.delete.mockRejectedValueOnce(new Error('cleanup unavailable'));
    const response = await request(server)
      .delete('/api/users/me/avatar')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((response.body as { data: { cleanupPending: boolean } }).data.cleanupPending).toBe(true);
    expect(users[0].avatar).toBeNull();
  });

  it('keeps the photo when deactivating the account', async () => {
    users[0].avatar = previousKey;
    await own('post', '/deactivate').expect(201);
    expect(users[0].avatar).toBe(previousKey);
    expect(provider.delete).not.toHaveBeenCalled();
  });
});
