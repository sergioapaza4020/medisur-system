import { PermissionsGuard } from './permissions.guard';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
