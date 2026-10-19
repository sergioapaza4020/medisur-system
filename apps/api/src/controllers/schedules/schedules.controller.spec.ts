import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from 'src/services/schedules/schedules.service';

describe('Schedule HTTP authorization and input validation', () => {
  let app: INestApplication;
  let server: Server;
  let permissions: string[];
  const service = {
    create: jest.fn(),
    specialties: jest.fn(),
    availability: jest.fn(),
    update: jest.fn(),
    mine: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        { provide: SchedulesService, useValue: service },
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

  it('denies missing registration permission even for SUPERADMIN', async () => {
    await request(server).post('/schedules').send({}).expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('accepts valid input and passes the authenticated identity', async () => {
    permissions = ['schedule.create'];
    await request(server)
      .post('/schedules')
      .send({
        idDoctor: 999,
        idSpecialty: 2,
        date: '2026-11-02',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ idSpecialty: 2 }), 7);
    expect((service.create.mock.calls[0] as unknown[])[0]).not.toHaveProperty('idDoctor');
  });
  it.each([
    { date: '2026-02-30' },
    { date: '2026-11-02T00:00:00Z' },
    { startTime: '25:00' },
    { endTime: '09:60' },
    { idSpecialty: 0 },
  ])('rejects malformed input and injected doctor identifiers: %j', async (invalid) => {
    permissions = ['schedule.create'];
    await request(server)
      .post('/schedules')
      .send({
        idSpecialty: 2,
        date: '2026-11-02',
        startTime: '09:00',
        endTime: '10:00',
        ...invalid,
      })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('requires the availability grant independently of schedule creation', async () => {
    permissions = ['schedule.create'];
    await request(server).get('/schedules/availability?idDoctor=3&date=2026-11-02').expect(403);
    expect(service.availability).not.toHaveBeenCalled();
    permissions = ['schedule.get-availability'];
    service.availability.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    const response = await request(server)
      .get('/schedules/availability?idDoctor=3&idSpecialty=2&date=2026-11-02')
      .expect(200);
    expect(response.body).toMatchObject({ data: [], meta: { total: 0 } });
    expect(service.availability).toHaveBeenCalledWith(
      expect.objectContaining({
        idDoctor: 3,
        idSpecialty: 2,
        page: 1,
        limit: 10,
        date: '2026-11-02',
      }),
    );
  });
  it.each([
    'idDoctor=3',
    'idDoctor=3&from=2026-11-01',
    'idDoctor=3&to=2026-11-30',
    'idDoctor=3&from=2026-02-30&to=2026-03-01',
    'idDoctor=3&date=2026-02-30',
    'idDoctor=3&date=not-a-date',
    'idDoctor=3&date=0000-01-01',
    'idDoctor=3&date=2026-11-02T00:00:00Z',
    'date=2026-11-02',
    'idDoctor=0&date=2026-11-02',
    'idDoctor=3&date=2026-11-02&idSpecialty=0',
    'idDoctor=3&date=2026-11-02&page=0',
    'idDoctor=3&date=2026-11-02&limit=101',
  ])('validates availability queries: %s', async (query) => {
    permissions = ['schedule.get-availability'];
    await request(server)
      .get('/schedules/availability?' + query)
      .expect(400);
    expect(service.availability).not.toHaveBeenCalled();
  });
  it('accepts a monthly range with the existing permission and pagination', async () => {
    permissions = ['schedule.get-availability'];
    await request(server)
      .get(
        '/schedules/availability?idDoctor=3&idSpecialty=2&from=2026-11-01&to=2026-11-30&limit=100',
      )
      .expect(200);
    expect(service.availability).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-11-01', to: '2026-11-30', limit: 100 }),
    );
  });
  it('protects modification and own listings independently of registration', async () => {
    permissions = ['schedule.create'];
    await request(server).get('/schedules/mine').expect(403);
    await request(server).get('/schedules/editing-specialties').expect(403);
    await request(server).put('/schedules/9').send({}).expect(403);
    expect(service.update).not.toHaveBeenCalled();
    permissions = ['schedule.update'];
    await request(server).get('/schedules/mine?page=2&limit=5').expect(200);
    expect(service.mine).toHaveBeenCalledWith(7, expect.objectContaining({ page: 2, limit: 5 }));
    await request(server).get('/schedules/editing-specialties').expect(200);
  });
  it('passes only validated replacement fields and the session identity', async () => {
    permissions = ['schedule.update'];
    await request(server)
      .put('/schedules/9')
      .send({
        idSpecialty: 2,
        date: '2026-11-02',
        startTime: '09:00',
        endTime: '10:00',
        isActive: false,
        expectedVersion: 1,
        idDoctor: 999,
        createdBy: 999,
      })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      9,
      {
        idSpecialty: 2,
        date: '2026-11-02',
        startTime: '09:00',
        endTime: '10:00',
        isActive: false,
        expectedVersion: 1,
      },
      7,
    );
  });
  it.each([
    { date: '2026-02-30' },
    { startTime: '24:00' },
    { expectedVersion: 0 },
    { isActive: 'false' },
    { idSpecialty: 0 },
  ])('rejects invalid schedule replacements: %j', async (invalid) => {
    permissions = ['schedule.update'];
    await request(server)
      .put('/schedules/9')
      .send({
        idSpecialty: 2,
        date: '2026-11-02',
        startTime: '09:00',
        endTime: '10:00',
        isActive: true,
        expectedVersion: 1,
        ...invalid,
      })
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });
});
