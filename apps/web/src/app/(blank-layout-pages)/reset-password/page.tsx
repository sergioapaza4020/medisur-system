import type { Metadata } from 'next';

import ResetPassword from '@/views/pages/auth/ResetPassword';

export const metadata: Metadata = {
  title: 'Restablecer contraseña | MEDISUR',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const recoveryToken = typeof token === 'string' ? token : '';
  return <ResetPassword key={recoveryToken} token={recoveryToken} />;
}
