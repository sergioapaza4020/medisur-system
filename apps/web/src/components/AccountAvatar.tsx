'use client';

import Avatar from '@mui/material/Avatar';
import type { AvatarProps } from '@mui/material/Avatar';

export default function AccountAvatar({
  user,
  ...props
}: AvatarProps & {
  user: { name?: string; lastname?: string; avatarUrl?: string | null } | null;
}) {
  return (
    <Avatar {...props} src={user?.avatarUrl ?? undefined} alt='Foto de perfil'>
      {[user?.name, user?.lastname]
        .filter(Boolean)
        .map((value) => value!.trim().charAt(0).toUpperCase())
        .join('') || <i aria-hidden='true' className='ri-user-line' />}
    </Avatar>
  );
}
