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
  const service = { create: jest.fn(), specialties: jest.fn() };
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
});
