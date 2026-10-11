import { Repository } from 'typeorm';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { PermissionsQueryDto } from 'src/dtos/permissions/permissions-query.dto';
import { RecordStatus } from 'src/dtos/common/status-query.dto';
import { PermissionsService } from './permissions.service';

describe('Permission catalog pagination', () => {
  it('uses database pagination and stable ordering with reusable metadata and status filters', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ name: 'user.create' }], 27]),
    };
    const repository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = new PermissionsService(repository as unknown as Repository<Permission>);
    const result = await service.getAll(
      Object.assign(new PermissionsQueryDto(), { page: 3, limit: 10, status: RecordStatus.ALL }),
    );
    expect(qb.orderBy).toHaveBeenCalledWith('permission.name', 'ASC');
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result.meta).toEqual({ page: 3, limit: 10, total: 27, totalPages: 3 });
    await service.getAll();
    expect(qb.andWhere).toHaveBeenCalledWith('permission.isActive = :isActive', { isActive: true });
  });
});
