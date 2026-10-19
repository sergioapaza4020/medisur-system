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
    respondRescheduling: jest.fn(),
    doctorProposals: jest.fn(),
    proposeRescheduling: jest.fn(),
    reschedulingAvailability: jest.fn(),
    patientProposals: jest.fn(),
    cancelMine: jest.fn(),
    cancelAsDoctor: jest.fn(),
    agenda: jest.fn(),
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
    service.agenda.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
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
    service.cancelMine.mockResolvedValue({
      idAppointment: 9,
      status: 'CANCELLED',
      cancelledAt: '2026-10-19T12:00:00Z',
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
  it('requires authentication and a specific permission for the medical agenda', async () => {
    await request(server).get('/appointments/agenda?date=2026-11-02').expect(401);
    await request(server)
      .get('/appointments/agenda?date=2026-11-02')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(service.agenda).not.toHaveBeenCalled();
  });
  it('takes the doctor account exclusively from the session and validates date/range/status pagination', async () => {
    session.permissions = ['appointment.get-agenda'];
    const response = await request(server)
      .get(
        '/appointments/agenda?from=2026-11-01&to=2026-11-30&status=CANCELLED&page=2&limit=5&idDoctor=999&idUser=999&idPatient=999',
      )
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.agenda).toHaveBeenCalledWith(7, {
      from: '2026-11-01',
      to: '2026-11-30',
      status: 'CANCELLED',
      page: 2,
      limit: 5,
    });
    expect(response.body).toMatchObject({ data: [], meta: { total: 0 } });
  });
  it.each([
    '',
    'date=2026-02-30',
    'date=0000-01-01',
    'date=2026-11-01T10:00:00Z',
    'from=2026-11-01',
    'to=2026-11-30',
    'date=2026-11-02&status=UNKNOWN',
    'date=2026-11-02&page=0',
    'date=2026-11-02&limit=101',
  ])('rejects invalid agenda filters %s', async (query) => {
    session.permissions = ['appointment.get-agenda'];
    await request(server)
      .get(`/appointments/agenda?${query}`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(service.agenda).not.toHaveBeenCalled();
  });
  it('accepts calendar mode while keeping the session scope', async () => {
    session.permissions = ['appointment.get-agenda'];
    await request(server)
      .get('/appointments/agenda?from=2026-10-01&to=2026-10-31&mode=calendar&idDoctor=999')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.agenda).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ mode: 'calendar', from: '2026-10-01', to: '2026-10-31' }),
    );
    expect(service.agenda).toHaveBeenCalledWith(7, {
      mode: 'calendar',
      from: '2026-10-01',
      to: '2026-10-31',
      page: 1,
      limit: 10,
    });
  });
  it('rejects an unknown calendar mode', async () => {
    session.permissions = ['appointment.get-agenda'];
    await request(server)
      .get('/appointments/agenda?date=2026-10-19&mode=all')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(service.agenda).not.toHaveBeenCalled();
  });
  it('protects cancellation with authentication and its own permission', async () => {
    await request(server).patch('/appointments/9/cancel').expect(401);
    await request(server)
      .patch('/appointments/9/cancel')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(service.cancelMine).not.toHaveBeenCalled();
  });
  it('passes only the appointment and session identity, ignoring forged cancellation audit and patient fields', async () => {
    session.permissions = ['appointment.cancel-mine'];
    const response = await request(server)
      .patch('/appointments/9/cancel?idPatient=999')
      .auth(token, { type: 'bearer' })
      .send({ idPatient: 999, cancelledBy: 999, cancelledAt: '2000-01-01', status: 'RESERVED' })
      .expect(200);
    expect(service.cancelMine).toHaveBeenCalledWith(9, 7);
    expect(response.body).toMatchObject({ data: { idAppointment: 9, status: 'CANCELLED' } });
  });
  it.each(['abc', '1.5'])('rejects malformed appointment identifier %s', async (id) => {
    session.permissions = ['appointment.cancel-mine'];
    await request(server)
      .patch(`/appointments/${id}/cancel`)
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(service.cancelMine).not.toHaveBeenCalled();
  });
  it('requires authentication and the doctor cancellation permission separately from reading the agenda', async () => {
    await request(server)
      .patch('/appointments/9/cancel-as-doctor')
      .send({ reason: 'Urgencia' })
      .expect(401);
    for (const permission of [
      'appointment.get-agenda',
      'appointment.cancel-mine',
      'appointment.create-for-patient',
    ]) {
      session.permissions = [permission];
      await request(server)
        .patch('/appointments/9/cancel-as-doctor')
        .auth(token, { type: 'bearer' })
        .send({ reason: 'Urgencia' })
        .expect(403);
    }
    expect(service.cancelAsDoctor).not.toHaveBeenCalled();
  });
  it.each([{}, { reason: '' }, { reason: '   ' }, { reason: 9 }, { reason: 'x'.repeat(501) }])(
    'validates the mandatory cancellation reason %j',
    async (body) => {
      session.permissions = ['appointment.cancel-as-doctor'];
      await request(server)
        .patch('/appointments/9/cancel-as-doctor')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
      expect(service.cancelAsDoctor).not.toHaveBeenCalled();
    },
  );
  it('uses only authenticated actor, parsed appointment and trimmed reason', async () => {
    session.permissions = ['appointment.cancel-as-doctor'];
    service.cancelAsDoctor.mockResolvedValue({ idAppointment: 9, status: 'CANCELLED' });
    await request(server)
      .patch('/appointments/9/cancel-as-doctor')
      .auth(token, { type: 'bearer' })
      .send({
        reason: '  Urgencia  ',
        idDoctor: 99,
        idPatient: 55,
        cancelledBy: 99,
        status: 'RESERVED',
      })
      .expect(200);
    expect(service.cancelAsDoctor).toHaveBeenCalledWith(9, 7, 'Urgencia');
    expect(service.cancelMine).not.toHaveBeenCalled();
    await request(server)
      .patch('/appointments/invalid/cancel-as-doctor')
      .auth(token, { type: 'bearer' })
      .send({ reason: 'Urgencia' })
      .expect(400);
  });
  it('requires separate proposal permission and authentication', async () => {
    await request(server)
      .post('/appointments/9/rescheduling-proposals')
      .send({ idSchedule: 2, expectedVersion: 1 })
      .expect(401);
    session.permissions = ['appointment.get-agenda', 'appointment.cancel-as-doctor'];
    await request(server)
      .post('/appointments/9/rescheduling-proposals')
      .auth(token, { type: 'bearer' })
      .send({ idSchedule: 2, expectedVersion: 1 })
      .expect(403);
    await request(server)
      .get('/appointments/9/rescheduling-availability?date=2099-11-03')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(service.proposeRescheduling).not.toHaveBeenCalled();
  });
  it('creates proposals using only authenticated actor and validated schedule/version', async () => {
    session.permissions = ['appointment.propose-rescheduling'];
    service.proposeRescheduling.mockResolvedValue({ idProposal: 1, status: 'PENDING' });
    await request(server)
      .post('/appointments/9/rescheduling-proposals')
      .auth(token, { type: 'bearer' })
      .send({
        idSchedule: 2,
        expectedVersion: 1,
        idDoctor: 99,
        idPatient: 88,
        status: 'ACCEPTED',
        date: '2000-01-01',
      })
      .expect(201);
    expect(service.proposeRescheduling).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({ idSchedule: 2, expectedVersion: 1 }),
    );
    expect(service.proposeRescheduling.mock.calls).toEqual([
      [9, 7, expect.not.objectContaining({ idDoctor: 99 })],
    ]);
  });
  it.each([
    {},
    { idSchedule: -1, expectedVersion: 1 },
    { idSchedule: 1 },
    { idSchedule: 'invalid', expectedVersion: 1 },
  ])('validates proposal payload %j', async (body) => {
    session.permissions = ['appointment.propose-rescheduling'];
    await request(server)
      .post('/appointments/9/rescheduling-proposals')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(service.proposeRescheduling).not.toHaveBeenCalled();
  });
  it('validates shared availability dates and pagination and discards spoofed scope', async () => {
    session.permissions = ['appointment.propose-rescheduling'];
    service.reschedulingAvailability.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    for (const query of ['date=2099-02-30', 'date=2099-11-03&limit=101', 'date=bad', ''])
      await request(server)
        .get(`/appointments/9/rescheduling-availability?${query}`)
        .auth(token, { type: 'bearer' })
        .expect(400);
    await request(server)
      .get('/appointments/9/rescheduling-availability?date=2099-11-03&idDoctor=99&idSpecialty=88')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.reschedulingAvailability).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({ date: '2099-11-03', page: 1, limit: 10 }),
    );
    expect(service.reschedulingAvailability.mock.calls).toEqual([
      [9, 7, expect.not.objectContaining({ idDoctor: 99 })],
    ]);
  });
  it('scopes proposal consultation to authenticated patient and reuses pagination validation', async () => {
    service.patientProposals.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    await request(server)
      .get('/appointments/9/rescheduling-proposals')
      .auth(token, { type: 'bearer' })
      .expect(403);
    session.permissions = ['appointment.get-mine'];
    await request(server)
      .get('/appointments/9/rescheduling-proposals?idPatient=99')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.patientProposals).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    await request(server)
      .get('/appointments/9/rescheduling-proposals?page=0')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });
  it('requires authentication and a distinct permission to respond', async () => {
    await request(server)
      .patch('/appointments/rescheduling-proposals/3/response')
      .send({ status: 'ACCEPTED' })
      .expect(401);
    session.permissions = ['appointment.get-mine', 'appointment.propose-rescheduling'];
    await request(server)
      .patch('/appointments/rescheduling-proposals/3/response')
      .auth(token, { type: 'bearer' })
      .send({ status: 'ACCEPTED' })
      .expect(403);
    expect(service.respondRescheduling).not.toHaveBeenCalled();
  });
  it.each([{}, { status: 'PENDING' }, { status: 'accepted' }, { status: null }, { status: 1 }])(
    'validates proposal response %j',
    async (body) => {
      session.permissions = ['appointment.respond-rescheduling'];
      await request(server)
        .patch('/appointments/rescheduling-proposals/3/response')
        .auth(token, { type: 'bearer' })
        .send(body)
        .expect(400);
      expect(service.respondRescheduling).not.toHaveBeenCalled();
    },
  );
  it.each(['ACCEPTED', 'REJECTED'])(
    'uses authenticated actor and whitelisted decision %s',
    async (status) => {
      session.permissions = ['appointment.respond-rescheduling'];
      service.respondRescheduling.mockResolvedValue({ idProposal: 3, status });
      await request(server)
        .patch('/appointments/rescheduling-proposals/3/response')
        .auth(token, { type: 'bearer' })
        .send({ status, idPatient: 99, idSchedule: 88, respondedBy: 99, date: '2000-01-01' })
        .expect(200);
      expect(service.respondRescheduling).toHaveBeenCalledWith(3, 7, status);
      await request(server)
        .patch('/appointments/rescheduling-proposals/invalid/response')
        .auth(token, { type: 'bearer' })
        .send({ status })
        .expect(400);
    },
  );
  it('requires agenda permission and validates doctor history pagination', async () => {
    await request(server)
      .get('/appointments/9/rescheduling-proposals/doctor')
      .auth(token, { type: 'bearer' })
      .expect(403);
    session.permissions = ['appointment.get-agenda'];
    service.doctorProposals.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    await request(server)
      .get('/appointments/9/rescheduling-proposals/doctor?idDoctor=99')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.doctorProposals).toHaveBeenCalledWith(
      9,
      7,
      expect.objectContaining({ page: 1, limit: 10 }),
    );
    await request(server)
      .get('/appointments/9/rescheduling-proposals/doctor?limit=101')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });
});
