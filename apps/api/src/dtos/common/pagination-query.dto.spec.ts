import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/core/pipes/validation.pipe';
import { PaginationQueryDto } from './pagination-query.dto';
import { UsersQueryDto } from '../users/users-query.dto';

describe('Shared pagination query validation', () => {
  const pipe = createValidationPipe();
  const transform = (value: unknown, metatype = PaginationQueryDto) =>
    pipe.transform(value, { type: 'query', metatype });

  it('defaults to page one and ten records and transforms string query parameters', async () => {
    await expect(transform({})).resolves.toEqual({ page: 1, limit: 10 });
    await expect(transform({ page: '3', limit: '100' })).resolves.toEqual({ page: 3, limit: 100 });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { page: 'Infinity' },
    { page: '' },
    { limit: '0' },
    { limit: '-1' },
    { limit: '101' },
    { limit: '2.5' },
    { limit: 'abc' },
    { limit: 'Infinity' },
    { page: ['1', '2'] },
    { limit: ['10', '25'] },
  ])('rejects unsafe query parameters %p', async (value) => {
    await expect(transform(value)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('combines common pagination with the existing user filters without losing defaults or validators', async () => {
    await expect(transform({}, UsersQueryDto)).resolves.toMatchObject({
      page: 1,
      limit: 10,
      status: 'active',
    });
    await expect(
      transform({ page: '2', limit: '25', status: 'inactive', search: 'Ana' }, UsersQueryDto),
    ).resolves.toMatchObject({ page: 2, limit: 25, status: 'inactive', search: 'Ana' });
    await expect(transform({ limit: '101' }, UsersQueryDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transform({ status: 'invalid' }, UsersQueryDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
