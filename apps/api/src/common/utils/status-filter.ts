import { RecordStatus } from 'src/dtos/common/status-query.dto';

export function statusFilter(status: RecordStatus = RecordStatus.ACTIVE): { isActive?: boolean } {
  return status === RecordStatus.ALL ? {} : { isActive: status === RecordStatus.ACTIVE };
}
