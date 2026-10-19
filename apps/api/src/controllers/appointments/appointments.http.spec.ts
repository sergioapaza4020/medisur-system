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
  const service = { create: jest.fn() };
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
});
