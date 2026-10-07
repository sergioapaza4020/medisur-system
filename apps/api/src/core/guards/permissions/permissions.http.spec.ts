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
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(403);
    await request(server).put('/roles/1').auth(token, { type: 'bearer' }).send(body).expect(403);
    await request(server)
      .patch('/roles/assign-permissions/1')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    capabilities.permissions.push('role.assign-permissions');
    await request(server).post('/roles').auth(token, { type: 'bearer' }).send(body).expect(201);
    await request(server).put('/roles/1').auth(token, { type: 'bearer' }).send(body).expect(200);
    await request(server)
      .patch('/roles/assign-permissions/1')
      .auth(token, { type: 'bearer' })
      .send({ permissionNames: ['user.create'] })
      .expect(200);
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
});
