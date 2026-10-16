import { BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

export function avatarUrl(storage: StorageService, key?: string | null): string | null {
  if (!key) return null;
  try {
    return storage.getPublicUrl(key);
  } catch (error) {
    // Ignore legacy template paths/URLs; never return an arbitrary external URL.
    if (error instanceof BadRequestException) return null;
    throw error;
  }
}
