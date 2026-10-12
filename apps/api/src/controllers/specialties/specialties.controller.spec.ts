import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { SpecialtiesController } from './specialties.controller';
import { SpecialtiesService } from 'src/services/specialties/specialties.service';

describe('Specialties HTTP permissions and validation', () => {
  let app: INestApplication;
  let server: Server;
  let permissions: string[];
  const service = {
    getAll: jest.fn(),
    getOneById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SpecialtiesController],
      providers: [
        { provide: SpecialtiesService, useValue: service },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    // Authentication is covered by the shared auth suite. Exercise the real permission guard.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { idUser: 7, roles: ['SUPERADMIN'], permissions };
      next();
    });
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    server = app.getHttpServer() as Server;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    permissions = [];
  });
  afterAll(async () => {
    await app.close();
  });

  const routes = [
    ['get', '/specialties', 'specialty.get-all', 'getAll'],
    ['get', '/specialties/id/1', 'specialty.get-one-by-id', 'getOneById'],
    ['post', '/specialties', 'specialty.create', 'create'],
    ['patch', '/specialties/1', 'specialty.update', 'update'],
    ['delete', '/specialties/1', 'specialty.delete', 'deactivate'],
    ['patch', '/specialties/reactivate/1', 'specialty.reactivate', 'reactivate'],
  ] as const;

  it.each(routes)('protects %s %s with %s', async (method, path, permission, handler) => {
    await request(server)[method](path).send({ name: 'Cardiología' }).expect(403);
    expect(service[handler]).not.toHaveBeenCalled();
    permissions = ['unrelated.permission'];
    await request(server)[method](path).send({ name: 'Cardiología' }).expect(403);
    permissions = [permission];
    await request(server)
      [method](path)
      .send({ name: 'Cardiología' })
      .expect(method === 'post' ? 201 : 200);
    expect(service[handler]).toHaveBeenCalledTimes(1);
    if (handler === 'create')
      expect(service.create).toHaveBeenCalledWith({ name: 'Cardiología' }, 7);
    if (handler === 'update')
      expect(service.update).toHaveBeenCalledWith(1, { name: 'Cardiología' }, 7);
    if (handler === 'deactivate' || handler === 'reactivate')
      expect(service[handler]).toHaveBeenCalledWith(1, 7);
  });

  it('rejects missing, blank, null, non-string and oversized names on create and update', async () => {
    permissions = ['specialty.create', 'specialty.update'];
    for (const body of [
      {},
      { name: '   ' },
      { name: null },
      { name: 42 },
      { name: 'a'.repeat(101) },
    ]) {
      await request(server).post('/specialties').send(body).expect(400);
      await request(server).patch('/specialties/1').send(body).expect(400);
    }
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    await request(server).post('/specialties').send({ name: '  Medicina   interna ' }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ name: 'Medicina Interna' }, 7);
  });

  it('validates pagination, status and IDs before invoking the service', async () => {
    permissions = ['specialty.get-all', 'specialty.get-one-by-id'];
    for (const query of [
      'page=0',
      'limit=101',
      'page=abc',
      'status=invalid',
      'search=' + 'a'.repeat(201),
    ])
      await request(server)
        .get('/specialties?' + query)
        .expect(400);
    await request(server).get('/specialties/id/invalid').expect(400);
    expect(service.getAll).not.toHaveBeenCalled();
    await request(server).get('/specialties').expect(200);
    expect(service.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, status: 'active' }),
    );
  });

  it('strips state and audit fields using the production validation pipe', async () => {
    permissions = ['specialty.create', 'specialty.update'];
    const body = { name: 'Cardiología', isActive: false, createdBy: 99, updatedBy: 99 };
    await request(server).post('/specialties').send(body).expect(201);
    expect(service.create).toHaveBeenCalledWith({ name: 'Cardiología' }, 7);
    await request(server).patch('/specialties/1').send(body).expect(200);
    expect(service.update).toHaveBeenCalledWith(1, { name: 'Cardiología' }, 7);
  });
});
