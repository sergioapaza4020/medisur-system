import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { DoctorsController } from './doctors.controller';
import { SpecialtiesController } from '../specialties/specialties.controller';
import { DoctorsService } from 'src/services/doctors/doctors.service';
import { SpecialtiesService } from 'src/services/specialties/specialties.service';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';

describe('Anonymous landing catalogs', () => {
  let app: INestApplication;
  let server: Server;
  let previous: string | undefined;
  const doctors = { getPublicPage: jest.fn(), getAll: jest.fn() };
  const specialties = { getPublicPage: jest.fn(), getAll: jest.fn() };
  beforeAll(async () => {
    previous = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'public-catalog-test';
    const module = await Test.createTestingModule({
      controllers: [DoctorsController, SpecialtiesController],
      providers: [
        { provide: DoctorsService, useValue: doctors },
        { provide: SpecialtiesService, useValue: specialties },
        { provide: AuthService, useValue: { getSession: jest.fn() } },
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
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previous;
  });

  it.each([
    ['doctors', doctors, 6],
    ['specialties', specialties, 8],
  ] as const)(
    'allows anonymous GET /%s/public and preserves the paginated envelope',
    async (domain, service, limit) => {
      service.getPublicPage.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit, total: 0, totalPages: 0 },
      });
      const response = await request(server)
        .get(`/${domain}/public?page=1&limit=${limit}&status=all&search=private`)
        .expect(200);
      expect(response.body).toMatchObject({
        status: true,
        data: [],
        meta: { page: 1, limit, total: 0 },
      });
      expect(service.getPublicPage).toHaveBeenCalledWith({ page: 1, limit });
      expect(service.getAll).not.toHaveBeenCalled();
    },
  );

  it.each(['doctors', 'specialties'])(
    'validates pagination and keeps /%s private',
    async (domain) => {
      for (const query of ['page=0', 'page=1.5', 'limit=101', 'limit=0'])
        await request(server).get(`/${domain}/public?${query}`).expect(400);
      await request(server).get(`/${domain}`).expect(401);
      await request(server).post(`/${domain}`).send({}).expect(401);
    },
  );
});
