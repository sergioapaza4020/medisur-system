import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from 'src/services/appointments/appointments.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Appointment creation HTTP boundary', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previous: string | undefined;
  const session = {
    idUser: 7,
    idSession: 1,
    roles: ['PATIENT'],
    permissions: ['appointment.create'],
  };
  const service = {
    create: jest.fn(),
    mine: jest.fn(),
    patients: jest.fn(),
    createForPatient: jest.fn(),
  };
  beforeAll(async () => {
    previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'booking-http-test';
    const module = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: service },
        { provide: AuthService, useValue: { getSession: jest.fn(() => Promise.resolve(session)) } },
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
    token = new JwtService().sign(session, { secret: process.env.JWT_ACCESS_SECRET });
  });
  beforeEach(() => {
    jest.clearAllMocks();
    session.permissions = ['appointment.create'];
    service.mine.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    service.patients.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    service.createForPatient.mockResolvedValue({
      idAppointment: 2,
      idPatient: 9,
      status: 'RESERVED',
    });
    service.create.mockResolvedValue({ idAppointment: 1, status: 'RESERVED' });
  });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });
  it('requires authentication and the explicit permission', async () => {
    await request(server)
      .post('/appointments')
      .send({ idSchedule: 9, expectedVersion: 1 })
      .expect(401);
    session.permissions = [];
    await request(server)
      .post('/appointments')
      .auth(token, { type: 'bearer' })
      .send({ idSchedule: 9, expectedVersion: 1 })
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { idSchedule: 0, expectedVersion: 1 },
    { idSchedule: 1.5, expectedVersion: 1 },
    { idSchedule: '9', expectedVersion: 1 },
    { idSchedule: 9 },
    { idSchedule: 9, expectedVersion: -1 },
  ])('rejects invalid booking input %j before calling the service', async (body) => {
    await request(server)
      .post('/appointments')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('takes identity exclusively from the authenticated session and strips forged appointment fields', async () => {
    const response = await request(server)
      .post('/appointments')
      .auth(token, { type: 'bearer' })
      .send({
        idSchedule: 9,
        expectedVersion: 1,
        idPatient: 999,
        idDoctor: 999,
        date: '2000-01-01',
        status: 'PAID',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith({ idSchedule: 9, expectedVersion: 1 }, 7);
    expect(response.body).toMatchObject({
      status: true,
      data: { idAppointment: 1, status: 'RESERVED' },
    });
  });
  it('requires authentication and its own read permission for mine', async () => {
    await request(server).get('/appointments/mine').expect(401);
    await request(server).get('/appointments/mine').auth(token, { type: 'bearer' }).expect(403);
    expect(service.mine).not.toHaveBeenCalled();
  });
  it('ignores forged patient identifiers and passes validated filters with session identity', async () => {
    session.permissions = ['appointment.get-mine'];
    const response = await request(server)
      .get(
        '/appointments/mine?idPatient=999&idUser=999&period=past&status=RESERVED&date=2026-01-01&page=2&limit=5',
      )
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.mine).toHaveBeenCalledWith(7, {
      period: 'past',
      status: 'RESERVED',
      date: '2026-01-01',
      page: 2,
      limit: 5,
    });
    expect(response.body).toMatchObject({ data: [], meta: { total: 0 } });
    await request(server).get('/appointments/mine/999').auth(token, { type: 'bearer' }).expect(404);
  });
  it.each([
    'page=0',
    'limit=101',
    'period=other',
    'status=unknown',
    'date=2026-02-30',
    'date=0000-01-01',
    'date=2026-01-01T10:00:00Z',
  ])('validates list query %s', async (query) => {
    session.permissions = ['appointment.get-mine'];
    await request(server)
      .get(`/appointments/mine?${query}`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(service.mine).not.toHaveBeenCalled();
  });
  it('protects patient lookup and administrative creation with a separate permission', async () => {
    await request(server).get('/appointments/patients?search=Ana').expect(401);
    await request(server).post('/appointments/for-patient').send({}).expect(401);
    await request(server)
      .get('/appointments/patients?search=Ana')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(server)
      .post('/appointments/for-patient')
      .auth(token, { type: 'bearer' })
      .send({ idSchedule: 9, expectedVersion: 1, idPatient: 8 })
      .expect(403);
    expect(service.createForPatient).not.toHaveBeenCalled();
    expect(service.patients).not.toHaveBeenCalled();
  });
  it('uses the selected patient and session actor only with the administrative permission', async () => {
    session.permissions = ['appointment.create-for-patient'];
    await request(server)
      .post('/appointments/for-patient')
      .auth(token, { type: 'bearer' })
      .send({
        idSchedule: 9,
        expectedVersion: 1,
        idPatient: 9,
        createdBy: 999,
        actorId: 999,
        status: 'PAID',
      })
      .expect(201);
    expect(service.createForPatient).toHaveBeenCalledWith(
      { idSchedule: 9, expectedVersion: 1, idPatient: 9 },
      7,
    );
    expect(service.create).not.toHaveBeenCalled();
    await request(server)
      .get('/appointments/patients?search=%20Ana%20&page=2&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.patients).toHaveBeenCalledWith({ search: 'Ana', page: 2, limit: 5 });
  });
  it.each([undefined, 0, -1, 1.5, '9'])('validates target patient %j', async (idPatient) => {
    session.permissions = ['appointment.create-for-patient'];
    await request(server)
      .post('/appointments/for-patient')
      .auth(token, { type: 'bearer' })
      .send({ idSchedule: 9, expectedVersion: 1, idPatient })
      .expect(400);
    expect(service.createForPatient).not.toHaveBeenCalled();
  });
  it.each(['', 'search=ab', 'search=%20%20%20', 'search=Ana&limit=101', 'search=Ana&page=0'])(
    'validates bounded patient search %s',
    async (query) => {
      session.permissions = ['appointment.create-for-patient'];
      await request(server)
        .get(`/appointments/patients?${query}`)
        .auth(token, { type: 'bearer' })
        .expect(400);
      expect(service.patients).not.toHaveBeenCalled();
    },
  );
});
