import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { mockPermissionsService } from '@common/test-mocks/permissions.mock';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: PermissionsService, useValue: mockPermissionsService }],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
