import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { mockSessionService } from '@common/test-mocks/sessions.mock';

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [{ provide: SessionsService, useValue: mockSessionService }],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
