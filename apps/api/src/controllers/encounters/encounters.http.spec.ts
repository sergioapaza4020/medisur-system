import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { EncountersController } from './encounters.controller';
import { EncountersService } from 'src/services/encounters/encounters.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Clinical registration HTTP authorization and validation', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previous: string | undefined;
  const session = { idUser: 7, idSession: 1, roles: ['DOCTOR'], permissions: ['encounter.create'] };
  const service = { create: jest.fn() };
  beforeAll(async () => {
    previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'encounter-http-test';
    const module = await Test.createTestingModule({
      controllers: [EncountersController],
      providers: [
        { provide: EncountersService, useValue: service },
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
    session.permissions = ['encounter.create'];
    session.roles = ['DOCTOR'];
    service.create.mockResolvedValue({ idEncounter: 1 });
  });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });
  it('requires authentication', async () => {
    await request(server)
      .post('/encounters')
      .send({ idAppointment: 9, summary: 'Text' })
      .expect(401);
    expect(service.create).not.toHaveBeenCalled();
  });
  it.each(['SUPERADMIN', 'STAFF', 'PATIENT', 'DOCTOR'])(
    'does not authorize %s by role alone',
    async (role) => {
      session.roles = [role];
      session.permissions = [];
      await request(server)
        .post('/encounters')
        .auth(token, { type: 'bearer' })
        .send({ idAppointment: 9, summary: 'Text' })
        .expect(403);
      expect(service.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { summary: 'Text' },
    { idAppointment: 0, summary: 'Text' },
    { idAppointment: null, summary: 'Text' },
    { idAppointment: '9', summary: 'Text' },
    { idAppointment: 9, summary: '   ' },
    { idAppointment: 9, summary: 1 },
    { idAppointment: 9, summary: 'x'.repeat(10001) },
    { idPatient: 1.5, idSpecialty: 1, summary: 'Text' },
    { idPatient: 1, idSpecialty: null, summary: 'Text' },
  ])('rejects invalid input before service execution', async (body) => {
    const response = await request(server)
      .post('/encounters')
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(response.body).not.toHaveProperty('summary');
  });
  it('strips forged doctor, date and audit data and uses session identity', async () => {
    await request(server)
      .post('/encounters')
      .auth(token, { type: 'bearer' })
      .send({
        idAppointment: 9,
        summary: ' Text ',
        idDoctor: 99,
        createdBy: 99,
        occurredAt: '2000-01-01',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith({ idAppointment: 9, summary: 'Text' }, 7);
  });
  it('accepts a valid encounter without an appointment', async () => {
    await request(server)
      .post('/encounters')
      .auth(token, { type: 'bearer' })
      .send({ idPatient: 2, idSpecialty: 3, summary: 'Text' })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      { idPatient: 2, idSpecialty: 3, summary: 'Text' },
      7,
    );
  });
});
