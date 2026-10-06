import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { mockUserRepository } from '@common/test-mocks/users.mock';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersService, useValue: mockUserRepository }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
