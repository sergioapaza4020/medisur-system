import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { UsersController } from 'src/controllers/users/users.controller';
import { RolesController } from 'src/controllers/roles/roles.controller';
import { PermissionsController } from 'src/controllers/permissions/permissions.controller';
import { SessionsController } from 'src/controllers/sessions/sessions.controller';
import { UsersService } from 'src/services/users/users.service';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { MEDISUR_PERMISSION_NAMES } from 'src/database/seeders/access-control.catalog';
import { PERMISSIONS_KEY } from '@core/decorators/permissions/permissions.decorator';
import { Repository } from 'typeorm';
import { User } from 'src/entities/users/users.entity';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Permission enforcement over HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previousSecret: string | undefined;
  const capabilities = {
    idUser: 1,
    idSession: 1,
    roles: ['SUPERADMIN'],
    permissions: [] as string[],
  };
  const service = {
    getAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    assignPermissions: jest.fn().mockResolvedValue({}),
    updateAdministrative: jest.fn().mockResolvedValue({}),
    getAdministrativeDetail: jest.fn().mockResolvedValue({}),
    getOneByEmail: jest.fn().mockResolvedValue({}),
    getOneByUsername: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    reactivate: jest.fn().mockResolvedValue({}),
    assignRoles: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'http-permissions-test';
    const module = await Test.createTestingModule({
      controllers: [UsersController, RolesController, PermissionsController],
      providers: [
        { provide: UsersService, useValue: service },
        { provide: RolesService, useValue: service },
        { provide: PermissionsService, useValue: service },
        {
          provide: AuthService,
          useValue: { getSession: jest.fn(() => Promise.resolve(capabilities)) },
        },
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    server = app.getHttpServer() as Server;
    token = new JwtService().sign(
      { ...capabilities, permissions: MEDISUR_PERMISSION_NAMES },
      {
        secret: process.env.JWT_ACCESS_SECRET,
      },
    );
  });

  beforeEach(() => {
    capabilities.permissions = [];
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  it.each([
    ['users', 'user.get-all'],
    ['roles', 'role.get-all'],
    ['permissions', 'permission.get-all'],
  ])(
    'rejects direct GET /%s without its permission and honors live grants/revocations',
    async (path, permission) => {
      await request(server).get(`/${path}`).expect(401);
      await request(server).get(`/${path}`).auth(token, { type: 'bearer' }).expect(403);
      expect(service.getAll).not.toHaveBeenCalled();
      capabilities.permissions = [permission];
      await request(server).get(`/${path}`).auth(token, { type: 'bearer' }).expect(200);
      capabilities.permissions = [];
      await request(server).get(`/${path}`).auth(token, { type: 'bearer' }).expect(403);
    },
  );

  it('cannot assign permissions through role create/update without the assignment grant', async () => {
    const body = { name: 'STAFF', permissionNames: ['user.create'] };
    capabilities.permissions = ['role.create', 'role.update'];
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(400);
    await request(server).put('/roles/1').auth(token, { type: 'bearer' }).send(body).expect(403);
    await request(server)
      .patch('/roles/assign-permissions/1')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    capabilities.permissions.push('role.assign-permissions');
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(400);
    await request(server).put('/roles/1').auth(token, { type: 'bearer' }).send(body).expect(200);
    await request(server)
      .patch('/roles/assign-permissions/1')
      .auth(token, { type: 'bearer' })
      .send({ permissionNames: ['user.create'] })
      .expect(200);
  });

  it('creates and edits administrative roles with their own grants, without requiring or assigning permissions', async () => {
    const body = { name: 'RECEPTION', description: 'Recepción' };
    await request(server).post('/roles').send(body).expect(401);
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(403);
    capabilities.permissions = ['role.create'];
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(201);
    expect(service.create).toHaveBeenCalledWith({ ...body, permissionNames: [] }, 1);
    capabilities.permissions = ['role.update'];
    await request(server)
      .patch('/roles/5')
      .auth(token, { type: 'bearer' })
      .send({ description: 'Actualizada' })
      .expect(200);
    expect(service.updateAdministrative).toHaveBeenCalledWith(5, { description: 'Actualizada' }, 1);
    for (const forbidden of [
      { permissionNames: ['user.get-all'] },
      { name: 'SUPERADMIN' },
      { isActive: false },
      { description: null },
    ]) {
      await request(server)
        .patch('/roles/5')
        .auth(token, { type: 'bearer' })
        .send(forbidden)
        .expect(400);
    }
    expect(service.updateAdministrative).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['patch', '/roles/5', 'role.update', { description: 'Actualizada' }],
    ['delete', '/roles/5', 'role.delete', {}],
    ['patch', '/roles/reactivate/5', 'role.reactivate', {}],
  ] as const)(
    'enforces direct %s %s by permissions regardless of the actor role',
    async (method, path, permission, body) => {
      await request(server)[method](path).send(body).expect(401);
      await request(server)[method](path).auth(token, { type: 'bearer' }).send(body).expect(403);
      capabilities.permissions = [permission];
      await request(server)[method](path).auth(token, { type: 'bearer' }).send(body).expect(200);
    },
  );

  it('validates the common pagination and role administrative inputs', async () => {
    capabilities.permissions = ['role.get-all', 'role.create'];
    for (const query of ['page=0', 'limit=101', 'status=invalid', 'search=' + 'a'.repeat(201)]) {
      await request(server)
        .get('/roles?' + query)
        .auth(token, { type: 'bearer' })
        .expect(400);
    }
    for (const body of [
      { name: '   ' },
      { name: 'a'.repeat(101) },
      { name: 'CUSTOM', description: 'a'.repeat(501) },
      { name: 'CUSTOM', isActive: false },
    ]) {
      await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(400);
    }
    expect(service.getAll).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    await request(server)
      .get('/roles?page=2&limit=25&status=inactive&search=Recepción')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 25, status: 'inactive', search: 'Recepción' }),
    );
  });

  it('rejects invalid assignment arrays before reaching the service', async () => {
    capabilities.permissions = ['role.assign-permissions'];
    for (const permissionNames of [['user.create', 'user.create'], [1], [''], ['   ']]) {
      await request(server)
        .patch('/roles/assign-permissions/1')
        .auth(token, { type: 'bearer' })
        .send({ permissionNames })
        .expect(400);
    }
    expect(service.assignPermissions).not.toHaveBeenCalled();
  });

  it('requires the role assignment grant when creating a user with roles', async () => {
    const body = {
      name: 'Ana',
      lastname: 'Pérez',
      username: 'ana',
      email: 'ana@example.com',
      ci: '123456',
      password: 'test-password',
      roleNames: ['STAFF'],
    };
    capabilities.permissions = ['user.create'];
    await request(server).post('/users').auth(token, { type: 'bearer' }).send(body).expect(403);
    expect(service.create).not.toHaveBeenCalled();
    capabilities.permissions.push('user.assign-roles');
    await request(server).post('/users').auth(token, { type: 'bearer' }).send(body).expect(201);
  });

  it('rejects creation without roles and rejects roles supplied to the administrative PATCH', async () => {
    capabilities.permissions = ['user.create', 'user.assign-roles', 'user.update'];
    await request(server)
      .post('/users')
      .auth(token, { type: 'bearer' })
      .send({
        name: 'Ana',
        lastname: 'Pérez',
        username: 'ana',
        email: 'ana@example.com',
        ci: '123',
        password: 'secret',
        roleNames: [],
      })
      .expect(400);
    await request(server)
      .patch('/users/2')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Ana', roleNames: [] })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('includes every existing protected controller operation in the initial catalog', () => {
    for (const controller of [
      UsersController,
      RolesController,
      PermissionsController,
      SessionsController,
    ]) {
      for (const key of Object.getOwnPropertyNames(controller.prototype)) {
        if (key === 'constructor') continue;
        const handler: unknown = Reflect.get(controller.prototype, key);
        if (typeof handler !== 'function') continue;
        const permissions = Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[];
        if (controller === SessionsController && key === 'logout') {
          expect(permissions).toBeUndefined();
          continue;
        }
        expect(permissions?.length).toBeGreaterThan(0);
        for (const permission of permissions)
          expect(MEDISUR_PERMISSION_NAMES).toContain(permission);
      }
    }
  });

  it.each([
    ['get', '/users/id/1', 'user.get-one-by-id', {}],
    ['get', '/users/email/ana@example.com', 'user.get-one-by-email', {}],
    ['get', '/users/username/ana', 'user.get-one-by-username', {}],
    ['patch', '/users/1', 'user.update', { name: 'Ana' }],
    ['delete', '/users/1', 'user.delete', {}],
    ['patch', '/users/reactivate/1', 'user.reactivate', {}],
    ['patch', '/users/assign-roles/1', 'user.assign-roles', { roleNames: ['STAFF'] }],
    ['put', '/users/assign-roles/1', 'user.assign-roles', { roleNames: ['STAFF'] }],
  ] as const)(
    'protects direct %s %s with its specific permission',
    async (method, path, permission, body) => {
      await request(server)[method](path).send(body).expect(401);
      await request(server)[method](path).auth(token, { type: 'bearer' }).send(body).expect(403);
      expect(Object.values(service).every((mock) => mock.mock.calls.length === 0)).toBe(true);
      capabilities.permissions = [permission];
      await request(server)[method](path).auth(token, { type: 'bearer' }).send(body).expect(200);
    },
  );

  it('validates pagination and user fields before invoking administration', async () => {
    capabilities.permissions = ['user.get-all', 'user.update'];
    for (const query of [
      'page=0',
      'page=1.5',
      'limit=101',
      'limit=-1',
      'status=invalid',
      'page=abc',
    ]) {
      await request(server).get(`/users?${query}`).auth(token, { type: 'bearer' }).expect(400);
    }
    for (const body of [{ name: '   ' }, { ci: null }, { email: 'invalid' }]) {
      await request(server)
        .patch('/users/1')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
    }
    expect(service.getAll).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    await request(server)
      .get('/users?page=2&limit=25&status=all&search=Ana')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 25, status: 'all', search: 'Ana' }),
    );
    await request(server)
      .patch('/users/1')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Ana', isActive: true })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(1, { name: 'Ana' }, 1);
  });

  it('rejects empty replacements and forwards valid roles with the authenticated author', async () => {
    capabilities.permissions = ['user.assign-roles'];
    for (const roleNames of [[], ['STAFF', 'STAFF'], ['   '], [1], null]) {
      await request(server)
        .put('/users/assign-roles/2')
        .auth(token, { type: 'bearer' })
        .send({ roleNames })
        .expect(400);
    }
    expect(service.assignRoles).not.toHaveBeenCalled();
    await request(server)
      .put('/users/assign-roles/2')
      .auth(token, { type: 'bearer' })
      .send({ roleNames: ['STAFF'] })
      .expect(200);
    expect(service.assignRoles).toHaveBeenCalledWith(2, ['STAFF'], 1, true);
  });

  it('rejects direct self-deactivation but allows another account with the delete grant', async () => {
    const account = Object.assign(new User(), { idUser: 2, isActive: true });
    const repository = {
      findOne: jest.fn().mockResolvedValue(account),
      save: jest.fn((user: User) => Promise.resolve(user)),
    };
    const users = new UsersService(repository as unknown as Repository<User>, {} as RolesService);
    capabilities.permissions = ['user.delete'];
    service.delete.mockImplementationOnce((id: number, author: number) => users.delete(id, author));
    const response = await request(server)
      .delete('/users/1')
      .auth(token, { type: 'bearer' })
      .send({ idUser: 9 })
      .expect(400);
    expect((response.body as { message: string }).message).toBe(
      'No puedes desactivar tu propia cuenta',
    );
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    service.delete.mockImplementationOnce((id: number, author: number) => users.delete(id, author));
    await request(server).delete('/users/2').auth(token, { type: 'bearer' }).expect(200);
    expect(account).toMatchObject({ isActive: false, updatedBy: 1, deletedBy: 1 });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('ignores manual password changes while updating administrative fields without exposing credentials', async () => {
    const account = Object.assign(new User(), {
      idUser: 2,
      name: 'Before',
      password: 'original-hash',
      roles: [{ idRole: 1, name: 'STAFF' }],
    });
    const repository = {
      findOne: jest.fn().mockResolvedValue(account),
      merge: jest.fn((user: User, fields: Partial<User>) =>
        Object.assign(
          user,
          Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
        ),
      ),
      save: jest.fn((user: User) => Promise.resolve(user)),
    };
    const users = new UsersService(repository as unknown as Repository<User>, {} as RolesService);
    capabilities.permissions = ['user.update', 'user.get-one-by-id'];
    service.update.mockImplementationOnce((id: number, dto: never, author: number) =>
      users.update(id, dto, author),
    );
    const response = await request(server)
      .patch('/users/2')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Ana', password: 'new-secret', passwordHash: 'injected', resetToken: 'reset' })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(2, { name: 'Ana' }, 1);
    expect(account.password).toBe('original-hash');
    expect(account.name).toBe('Ana');
    expect(JSON.stringify(response.body)).not.toMatch(/password|Token|original-hash|new-secret/);
    service.getAdministrativeDetail.mockResolvedValueOnce(account);
    const detail = await request(server)
      .get('/users/id/2')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(JSON.stringify(detail.body)).not.toContain('original-hash');
    expect((detail.body as { data: User }).data).not.toHaveProperty('password');
  });
});
