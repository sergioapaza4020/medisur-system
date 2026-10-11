import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/common/pagination-query.dto';
import { PaginatedResult } from '../types/pagination.type';

// The caller supplies filters, joins and a stable ordering before pagination.
export async function paginate<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  { page, limit }: PaginationQueryDto = new PaginationQueryDto(),
): Promise<PaginatedResult<T>> {
  query.skip((page - 1) * limit).take(limit);
  const [data, total] = await query.getManyAndCount();
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
