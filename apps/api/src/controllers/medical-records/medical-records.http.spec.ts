import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from 'src/services/medical-records/medical-records.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Medical record HTTP access boundary', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previous: string | undefined;
  const session = {
    idUser: 7,
    idSession: 1,
    roles: ['DOCTOR'],
    permissions: ['medical-record.get-by-appointment'],
  };
  const service = { byAppointment: jest.fn() };
  const path = '/medical-records/by-appointment/9';
  beforeAll(async () => {
    previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'clinical-read-http-test';
    const module = await Test.createTestingModule({
      controllers: [MedicalRecordsController],
      providers: [
        { provide: MedicalRecordsService, useValue: service },
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
    session.roles = ['DOCTOR'];
    session.permissions = ['medical-record.get-by-appointment'];
    service.byAppointment.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });
  it('requires authentication', async () => {
    await request(server).get(path).expect(401);
    expect(service.byAppointment).not.toHaveBeenCalled();
  });
  it.each(['DOCTOR', 'STAFF', 'SUPERADMIN', 'PATIENT'])(
    'does not authorize %s by name or creation grants',
    async (role) => {
      session.roles = [role];
      session.permissions = ['encounter.create', 'appointment.get-agenda'];
      await request(server).get(path).auth(token, { type: 'bearer' }).expect(403);
      expect(service.byAppointment).not.toHaveBeenCalled();
    },
  );
  it.each(['?page=0', '?page=1.5', '?limit=101', '?limit=0', '?page=abc'])(
    'validates shared pagination %s',
    async (query) => {
      await request(server)
        .get(path + query)
        .auth(token, { type: 'bearer' })
        .expect(400);
      expect(service.byAppointment).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed appointment identifiers', async () => {
    await request(server)
      .get('/medical-records/by-appointment/not-an-id')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(service.byAppointment).not.toHaveBeenCalled();
  });
  it('uses the session actor and discards forged patient, doctor, record and audit identifiers', async () => {
    const response = await request(server)
      .get(
        path +
          '?page=2&limit=5&idUser=999&idPatient=999&idDoctor=999&idMedicalRecord=999&createdBy=999',
      )
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(service.byAppointment).toHaveBeenCalledWith(9, 7, { page: 2, limit: 5 });
    expect(response.body).toMatchObject({ status: true, data: [], meta: { total: 0 } });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rechecks effective permissions on each request', async () => {
    await request(server).get(path).auth(token, { type: 'bearer' }).expect(200);
    session.permissions = [];
    await request(server).get(path).auth(token, { type: 'bearer' }).expect(403);
    expect(service.byAppointment).toHaveBeenCalledTimes(1);
  });
});
