import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { ExtraordinaryGrantsController } from './extraordinary-grants.controller';
import { MedicalRecordsController } from './medical-records.controller';
import { ExtraordinaryGrantsService } from 'src/services/medical-records/extraordinary-grants.service';
import { MedicalRecordsService } from 'src/services/medical-records/medical-records.service';
import { AppointmentsService } from 'src/services/appointments/appointments.service';
import { DoctorsService } from 'src/services/doctors/doctors.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Extraordinary clinical access HTTP boundary', () => {
  let app: INestApplication;
  let server: Server;
  let token: string;
  let previous: string | undefined;
  const session = {
    idUser: 7,
    idSession: 1,
    roles: ['STAFF'],
    permissions: ['medical-record.manage-extraordinary'],
  };
  const grants = { create: jest.fn(), revoke: jest.fn(), list: jest.fn() };
  const records = { byExtraordinaryGrant: jest.fn() };
  const appointments = { patients: jest.fn() };
  const doctors = { getAll: jest.fn() };
  const base = '/medical-records/extraordinary-access';
  const read = '/medical-records/by-extraordinary-grant/9';
  const body = {
    idPatient: 2,
    idBeneficiary: 3,
    type: 'AUTHORIZATION',
    reason: 'Autorización válida del paciente',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
  beforeAll(async () => {
    previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'extraordinary-http-test';
    const module = await Test.createTestingModule({
      controllers: [ExtraordinaryGrantsController, MedicalRecordsController],
      providers: [
        { provide: ExtraordinaryGrantsService, useValue: grants },
        { provide: MedicalRecordsService, useValue: records },
        { provide: AppointmentsService, useValue: appointments },
        { provide: DoctorsService, useValue: doctors },
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
    session.roles = ['STAFF'];
    session.permissions = ['medical-record.manage-extraordinary'];
    const page = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    grants.create.mockResolvedValue({ idGrant: 9, expiresAt: body.expiresAt });
    grants.revoke.mockResolvedValue({ idGrant: 9 });
    grants.list.mockResolvedValue(page);
    records.byExtraordinaryGrant.mockResolvedValue(page);
    appointments.patients.mockResolvedValue(page);
    doctors.getAll.mockResolvedValue(page);
  });
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });
  it('requires authentication on grant, revoke, list, selectors and read', async () => {
    await request(server).post(base).send(body).expect(401);
    await request(server)
      .patch(base + '/9/revoke')
      .send({ reason: body.reason })
      .expect(401);
    for (const path of [
      base,
      base + '/mine',
      base + '/patients?search=Luis',
      base + '/beneficiaries?search=Ana',
      read,
    ])
      await request(server).get(path).expect(401);
  });
  it.each(['SUPERADMIN', 'STAFF', 'DOCTOR', 'PATIENT'])(
    'does not authorize %s by name alone',
    async (role) => {
      session.roles = [role];
      session.permissions = [];
      await request(server).post(base).auth(token, { type: 'bearer' }).send(body).expect(403);
      await request(server).get(read).auth(token, { type: 'bearer' }).expect(403);
      await request(server)
        .patch(base + '/9/revoke')
        .auth(token, { type: 'bearer' })
        .send({ reason: body.reason })
        .expect(403);
      expect(grants.create).not.toHaveBeenCalled();
      expect(records.byExtraordinaryGrant).not.toHaveBeenCalled();
      expect(grants.revoke).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { idPatient: 0 },
    { idBeneficiary: '3' },
    { reason: ' ' },
    { reason: 'x'.repeat(1001) },
    { type: 'UNLIMITED' },
    { expiresAt: 'invalid' },
    { expiresAt: '2099-01-01T12:00:00' },
  ])('validates concession fields before executing %j', async (override) => {
    const input = Object.keys(override).length ? { ...body, ...override } : {};
    await request(server).post(base).auth(token, { type: 'bearer' }).send(input).expect(400);
    expect(grants.create).not.toHaveBeenCalled();
  });
  it.each(['AUTHORIZATION', 'EMERGENCY'])(
    'takes the actor from the session and preserves the %s basis',
    async (type) => {
      await request(server)
        .post(base)
        .auth(token, { type: 'bearer' })
        .send({
          ...body,
          type,
          createdBy: 999,
          createdAt: '2000-01-01',
          revokedAt: '2000-01-01',
          scope: 'GLOBAL',
        })
        .expect(201);
      expect(grants.create).toHaveBeenCalledWith({ ...body, type }, 7);
    },
  );
  it('does not give clinical read or beneficiary listing capabilities to a manager', async () => {
    await request(server).get(base).auth(token, { type: 'bearer' }).expect(200);
    await request(server)
      .get(base + '/mine')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(server).get(read).auth(token, { type: 'bearer' }).expect(403);
    expect(records.byExtraordinaryGrant).not.toHaveBeenCalled();
  });
  it('does not give management capabilities to a beneficiary with the read permission', async () => {
    session.permissions = ['medical-record.get-extraordinary'];
    await request(server).post(base).auth(token, { type: 'bearer' }).send(body).expect(403);
    await request(server).get(base).auth(token, { type: 'bearer' }).expect(403);
    await request(server)
      .get(base + '/patients?search=Luis')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get(base + '/beneficiaries?search=Ana')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(server)
      .patch(base + '/9/revoke')
      .auth(token, { type: 'bearer' })
      .send({ reason: body.reason })
      .expect(403);
    await request(server)
      .get(base + '/mine?idBeneficiary=999&page=2&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(grants.list).toHaveBeenCalledWith({ page: 2, limit: 5 }, 7);
  });
  it('scopes clinical requests to the session actor and ignores forged patient identifiers', async () => {
    session.permissions = ['medical-record.get-extraordinary'];
    const response = await request(server)
      .get(read + '?idPatient=999&idUser=999&idBeneficiary=999&idMedicalRecord=999&page=2&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(records.byExtraordinaryGrant).toHaveBeenCalledWith(9, 7, { page: 2, limit: 5 });
    expect(response.headers['cache-control']).toBe('no-store');
    session.permissions = [];
    await request(server).get(read).auth(token, { type: 'bearer' }).expect(403);
    expect(records.byExtraordinaryGrant).toHaveBeenCalledTimes(1);
  });
  it('records only server actor and the validated reason on revocation', async () => {
    await request(server)
      .patch(base + '/9/revoke')
      .auth(token, { type: 'bearer' })
      .send({
        reason: '  Autorización retirada por el paciente  ',
        revokedBy: 999,
        revokedAt: '2000-01-01',
      })
      .expect(200);
    expect(grants.revoke).toHaveBeenCalledWith(9, 7, 'Autorización retirada por el paciente');
  });
  it('rejects empty revocation reasons and invalid pagination', async () => {
    await request(server)
      .patch(base + '/9/revoke')
      .auth(token, { type: 'bearer' })
      .send({ reason: ' ' })
      .expect(400);
    await request(server)
      .get(base + '?limit=101')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(server)
      .get(base + '/patients?search=ab')
      .auth(token, { type: 'bearer' })
      .expect(400);
    expect(grants.revoke).not.toHaveBeenCalled();
    expect(grants.list).not.toHaveBeenCalled();
  });
  it('reuses existing paginated selectors but returns no account secrets or clinical content', async () => {
    doctors.getAll.mockResolvedValue({
      data: [
        {
          user: {
            idUser: 3,
            name: 'Ana',
            lastname: 'Doctor',
            ci: '123',
            email: 'PRIVATE-EMAIL',
            password: 'PRIVATE-PASSWORD',
          },
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    const result = await request(server)
      .get(base + '/beneficiaries?search=Ana')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(result.body).toMatchObject({
      data: [{ idUser: 3, name: 'Ana', lastname: 'Doctor', ci: '123' }],
      meta: { total: 1 },
    });
    expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE-EMAIL|PRIVATE-PASSWORD/);
    await request(server)
      .get(base + '/patients?search=Luis&page=2&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(appointments.patients).toHaveBeenCalledWith({ search: 'Luis', page: 2, limit: 5 });
  });
});
