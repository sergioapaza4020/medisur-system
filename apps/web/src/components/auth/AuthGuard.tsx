'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import { authService } from '@/services/auth/authService';
import type { AuthUser } from '@/types/auth';
import { AUTH_CLEARED_EVENT } from '@/utils/http/authCookies';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const AuthContext = createContext<{
  user: AuthUser | null;
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
} | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth requiere una sesión protegida');

  return context;
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<{ user: AuthUser | null; error: string | null }>({ user: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    const onCleared = () => {
      if (!active) return;
      requestVersion += 1;
      setSession({ user: null, error: null });
      router.replace('/login');
    };

    const loadUser = () => {
      const version = ++requestVersion;
      authService.getCurrentUser().then(
        (user) => {
          if (active && version === requestVersion) setSession({ user, error: null });
        },
        (error: unknown) => {
          if (active && version === requestVersion) setSession({ user: null, error: getApiErrorMessage(error) });
        },
      );
    };

    loadUser();
    window.addEventListener(AUTH_CLEARED_EVENT, onCleared);
    window.addEventListener('focus', loadUser);

    return () => {
      active = false;
      window.removeEventListener(AUTH_CLEARED_EVENT, onCleared);
      window.removeEventListener('focus', loadUser);
    };
  }, [router, pathname, attempt]);

  if (!session.user) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 5 }}>
        {session.error ? (
          <Alert
            severity='error'
            action={
              <Button color='inherit' onClick={() => setAttempt((value) => value + 1)}>
                Reintentar
              </Button>
            }
          >
            {session.error}
          </Alert>
        ) : (
          <CircularProgress aria-label='Verificando sesión' />
        )}
      </Box>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        hasPermission: (permission) => session.user?.permissions.includes(permission) ?? false,
        logout: () => authService.logout(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
