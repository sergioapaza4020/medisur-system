import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...args: string[]) => SetMetadata(PERMISSIONS_KEY, args);
