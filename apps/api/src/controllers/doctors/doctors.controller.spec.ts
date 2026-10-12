import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from 'src/services/doctors/doctors.service';

describe('Doctor HTTP authorization and input validation', () => {
  let app: INestApplication;
  let server: Server;
  let permissions: string[];
  const service = {
    getAll: jest.fn(),
    searchRegistrationUsers: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DoctorsController],
      providers: [
        { provide: DoctorsService, useValue: service },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { idUser: 7, roles: ['SUPERADMIN'], permissions };
      next();
    });
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
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

  it.each([
    ['get', '/doctors', 'doctor.get-all', 'getAll'],
    ['get', '/doctors/registration-users?search=ana', 'doctor.create', 'searchRegistrationUsers'],
    ['post', '/doctors', 'doctor.create', 'create'],
    ['delete', '/doctors/1', 'doctor.delete', 'changeStatus'],
    ['patch', '/doctors/reactivate/1', 'doctor.reactivate', 'changeStatus'],
  ] as const)(
    'requires the specific grant for %s %s',
    async (method, path, permission, handler) => {
      await request(server)[method](path).send({ idUser: 4 }).expect(403);
      permissions = ['user.assign-roles'];
      await request(server)[method](path).send({ idUser: 4 }).expect(403);
      expect(service[handler]).not.toHaveBeenCalled();
      permissions = [permission];
      await request(server)
        [method](path)
        .send({ idUser: 4 })
        .expect(method === 'post' ? 201 : 200);
      expect(service[handler]).toHaveBeenCalledTimes(1);
      if (handler === 'changeStatus')
        expect(service.changeStatus).toHaveBeenCalledWith(1, method === 'patch', 7);
    },
  );

  it('validates required IDs, boolean state and unique positive specialty IDs before service execution', async () => {
    permissions = ['doctor.create'];
    for (const body of [
      {},
      { idUser: null },
      { idUser: '4' },
      { idUser: 0 },
      { idUser: 1.5 },
      { idUser: 4, isActive: null },
      { idUser: 4, isActive: 'false' },
      { idUser: 4, specialtyIds: null },
      { idUser: 4, specialtyIds: [1, 1] },
      { idUser: 4, specialtyIds: [0] },
      { idUser: 4, specialtyIds: ['1'] },
      { idUser: 4, specialtyIds: Array.from({ length: 101 }, (_, i) => i + 1) },
    ])
      await request(server).post('/doctors').send(body).expect(400);
    expect(service.create).not.toHaveBeenCalled();
    await request(server).post('/doctors').send({ idUser: 4 }).expect(201);
    expect(service.create).toHaveBeenCalledWith({ idUser: 4, isActive: true, specialtyIds: [] }, 7);
  });

  it('cannot grant arbitrary roles or override the audit author', async () => {
    permissions = ['doctor.create'];
    await request(server)
      .post('/doctors')
      .send({
        idUser: 4,
        isActive: false,
        specialtyIds: [1, 2],
        roleNames: ['SUPERADMIN'],
        createdBy: 99,
        password: 'secret',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      { idUser: 4, isActive: false, specialtyIds: [1, 2] },
      7,
    );
  });

  it('reuses paginated responses and validates query values and route IDs', async () => {
    permissions = ['doctor.get-all', 'doctor.delete'];
    for (const query of ['page=0', 'limit=101', 'status=invalid', 'search=' + 'a'.repeat(201)])
      await request(server)
        .get('/doctors?' + query)
        .expect(400);
    await request(server).delete('/doctors/invalid').expect(400);
    expect(service.getAll).not.toHaveBeenCalled();
    service.getAll.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    const response = await request(server).get('/doctors').expect(200);
    expect(response.body).toMatchObject({ status: true, data: [], meta: { total: 0 } });
    expect(service.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, status: 'active' }),
    );
  });
});
