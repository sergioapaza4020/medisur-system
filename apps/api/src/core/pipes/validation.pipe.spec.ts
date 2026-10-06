import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from './validation.pipe';
import { LoginDto } from 'src/dtos/auth/login.dto';
import { StatusQueryDto } from 'src/dtos/common/status-query.dto';

describe('HTTP validation', () => {
  const pipe = createValidationPipe();

  it('keeps login credentials and removes unknown properties', async () => {
    const result: unknown = await pipe.transform(
      { username: 'test', password: 'secret', isAdmin: true },
      { type: 'body', metatype: LoginDto },
    );
    expect(result).toEqual({ username: 'test', password: 'secret' });
    await expect(
      pipe.transform({ username: 'test' }, { type: 'body', metatype: LoginDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults administrative lists to active and accepts all states', async () => {
    expect(await pipe.transform({}, { type: 'query', metatype: StatusQueryDto })).toEqual({
      status: 'active',
    });
    for (const status of ['active', 'inactive', 'all']) {
      expect(await pipe.transform({ status }, { type: 'query', metatype: StatusQueryDto })).toEqual(
        { status },
      );
    }
  });
});
