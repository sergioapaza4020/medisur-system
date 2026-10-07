import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
// Every declared permission is required; role names never grant implicit access.
export const Permissions = (...args: string[]) => SetMetadata(PERMISSIONS_KEY, args);
