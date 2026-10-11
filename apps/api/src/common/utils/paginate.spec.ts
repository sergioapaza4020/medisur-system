import { SelectQueryBuilder } from 'typeorm';
import { paginate } from './paginate';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';

describe('Shared database pagination', () => {
  it.each([
    { page: 1, limit: 10, total: 57, size: 10, totalPages: 6 },
    { page: 3, limit: 10, total: 57, size: 10, totalPages: 6 },
    { page: 6, limit: 10, total: 57, size: 7, totalPages: 6 },
    { page: 7, limit: 10, total: 57, size: 0, totalPages: 6 },
    { page: 1, limit: 10, total: 0, size: 0, totalPages: 0 },
    { page: 1, limit: 100, total: 200, size: 100, totalPages: 2 },
  ])(
    'returns the requested page and accurate totals: %p',
    async ({ page, limit, total, size, totalPages }) => {
      const data = Array.from({ length: size }, (_, id) => ({ id: (page - 1) * limit + id + 1 }));
      const query = {
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      const result = await paginate(query as unknown as SelectQueryBuilder<{ id: number }>, {
        page,
        limit,
      });
      expect(query.skip).toHaveBeenCalledWith((page - 1) * limit);
      expect(query.take).toHaveBeenCalledWith(limit);
      expect(query.getManyAndCount).toHaveBeenCalledTimes(1);
      expect(query.take.mock.invocationCallOrder[0]).toBeLessThan(
        query.getManyAndCount.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({ data, meta: { page, limit, total, totalPages } });
      expect(result.data).toBe(data);
    },
  );

  it('uses bounded defaults without requiring module-specific pagination', async () => {
    const query = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const result = await paginate(query as unknown as SelectQueryBuilder<{ id: number }>);
    expect(result.meta).toEqual({ ...new PaginationQueryDto(), total: 0, totalPages: 0 });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.take).toHaveBeenCalledWith(10);
  });
});
