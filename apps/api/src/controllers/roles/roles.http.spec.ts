import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'http';
import request from 'supertest';
import { RolesController } from './roles.controller';
import { RolesService } from 'src/services/roles/roles.service';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import { AuthService } from 'src/services/auth/auth.service';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { MEDISUR_ROLES } from 'src/database/seeders/access-control.catalog';
import { JwtStrategy } from 'src/core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from 'src/core/guards/auth/auth.guard';
import { PermissionsGuard } from 'src/core/guards/permissions/permissions.guard';
import { createValidationPipe } from 'src/core/pipes/validation.pipe';
import { ResponseInterceptor } from 'src/core/interceptors/response/response.interceptor';

describe('HU-USR-06 roles over HTTP', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previousSecret: string | undefined;
  let roles: Role[];
  const actor = { idUser: 7, idSession: 1, roles: ['STAFF'], permissions: [] as string[] };
  const getPermission = jest.fn();
  const repository = {
    findOne: ({ where }: { where: { idRole?: number; name?: string; isActive?: boolean } }) =>
      Promise.resolve(
        roles.find(
          (role) =>
            (where.idRole === undefined || role.idRole === where.idRole) &&
            (where.name === undefined || role.name === where.name) &&
            (where.isActive === undefined || role.isActive === where.isActive),
        ) ?? null,
      ),
    create: (value: Partial<Role>) => Object.assign(new Role(), { isActive: true }, value),
    save: (role: Role) => {
      if (!role.idRole) {
        role.idRole = roles.length + 1;
        roles.push(role);
      }
      return Promise.resolve(role);
    },
  };

  beforeAll(async () => {
    previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'roles-http-test-secret';
    const module = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        RolesService,
        JwtStrategy,
        { provide: getRepositoryToken(Role), useValue: repository },
        { provide: PermissionsService, useValue: { getOneByName: getPermission } },
        { provide: AuthService, useValue: { getSession: () => Promise.resolve(actor) } },
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
      { idUser: 7, idSession: 1 },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
  });
  beforeEach(() => {
    getPermission.mockReset();
    getPermission.mockImplementation((name: string) =>
      Promise.resolve(
        ['user.get-all', 'user.create', 'role.get-all'].includes(name)
          ? Object.assign(new Permission(), {
              idPermission: name === 'user.create' ? 2 : 1,
              name,
              isActive: true,
            })
          : null,
      ),
    );
    roles = MEDISUR_ROLES.map((role, index) =>
      Object.assign(new Role(), role, { idRole: index + 1, isActive: true, permissions: [] }),
    );
    actor.permissions = [
      'role.create',
      'role.update',
      'role.delete',
      'role.reactivate',
      'role.assign-permissions',
    ];
  });
  afterAll(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  it('persists multiple assignments, withdrawal and empty replacements without changing base codes or granting implicit clinical access', async () => {
    actor.permissions.push('role.get-one-by-id');
    const replace = (permissionNames: string[]) =>
      request(server)
        .put('/roles/assign-permissions/1')
        .auth(token, { type: 'bearer' })
        .send({ permissionNames });
    await replace(['user.get-all', 'user.create']).expect(200);
    const detail = await request(server)
      .get('/roles/id/1')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(
      (detail.body as { data: Role }).data.permissions.map((permission) => permission.name),
    ).toEqual(['user.get-all', 'user.create']);
    await replace(['user.create']).expect(200);
    expect(roles[0].permissions.map((permission) => permission.name)).toEqual(['user.create']);
    await replace(['role.get-all', 'clinical.global']).expect(400);
    expect(roles[0].permissions.map((permission) => permission.name)).toEqual(['user.create']);
    expect(roles[0].name).toBe('SUPERADMIN');
    await replace([]).expect(200);
    expect(roles[0].permissions).toEqual([]);
    roles[0].isActive = false;
    await replace(['user.create']).expect(400);
    await request(server).get('/roles/id/1').auth(token, { type: 'bearer' }).expect(200);
    expect(roles[0].permissions).toEqual([]);
  });

  it('creates, rejects duplicates, edits descriptions and logically deactivates/reactivates without granting capabilities', async () => {
    const created = await request(server)
      .post('/roles')
      .auth(token, { type: 'bearer' })
      .send({ name: ' reception ', description: ' Recepción ' })
      .expect(201);
    expect(created.body as unknown).toMatchObject({
      data: {
        idRole: 5,
        name: 'RECEPTION',
        description: 'Recepción',
        permissions: [],
        isActive: true,
        createdBy: 7,
      },
    });
    await request(server)
      .post('/roles')
      .auth(token, { type: 'bearer' })
      .send({ name: 'RECEPTION' })
      .expect(400);
    await request(server)
      .patch('/roles/5')
      .auth(token, { type: 'bearer' })
      .send({ description: 'Nueva' })
      .expect(200);
    await request(server).delete('/roles/5').auth(token, { type: 'bearer' }).expect(200);
    expect(roles[4]).toMatchObject({
      name: 'RECEPTION',
      description: 'Nueva',
      isActive: false,
      permissions: [],
      updatedBy: 7,
      deletedBy: 7,
    });
    expect(roles).toHaveLength(5);
    await request(server).patch('/roles/reactivate/5').auth(token, { type: 'bearer' }).expect(200);
    expect(roles[4].isActive).toBe(true);
  });

  it.each(MEDISUR_ROLES)(
    'rejects direct destructive operations on base role $name with valid grants',
    async ({ name }) => {
      const role = roles.find((role) => role.name === name)!;
      await request(server)
        .delete(`/roles/${role.idRole}`)
        .auth(token, { type: 'bearer' })
        .expect(400);
      await request(server)
        .put(`/roles/${role.idRole}`)
        .auth(token, { type: 'bearer' })
        .send({ name: 'CUSTOM', permissionNames: [] })
        .expect(400);
      await request(server)
        .patch(`/roles/${role.idRole}`)
        .auth(token, { type: 'bearer' })
        .send({ name: 'CUSTOM' })
        .expect(400);
      await request(server)
        .patch(`/roles/${role.idRole}`)
        .auth(token, { type: 'bearer' })
        .send({ description: 'Actualizada' })
        .expect(200);
      expect(role).toMatchObject({
        name,
        isActive: true,
        description: 'Actualizada',
        permissions: [],
      });
    },
  );

  it('does not authorize creation by actor role and rejects attempts to assign permissions during creation', async () => {
    actor.permissions = [];
    await request(server).post('/roles').send({ name: 'CUSTOM' }).expect(401);
    await request(server)
      .post('/roles')
      .auth(token, { type: 'bearer' })
      .send({ name: 'CUSTOM' })
      .expect(403);
    actor.permissions = ['role.create'];
    await request(server)
      .post('/roles')
      .auth(token, { type: 'bearer' })
      .send({ name: 'CUSTOM', permissionNames: ['clinical.read'] })
      .expect(400);
    await request(server)
      .post('/roles')
      .auth(token, { type: 'bearer' })
      .send({ name: 'CUSTOM' })
      .expect(201);
    expect(roles[4].permissions).toEqual([]);
  });
});
