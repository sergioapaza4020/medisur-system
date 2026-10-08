// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css';

import { InitColorSchemeScript } from '@mui/material';

// Type Imports
import type { ChildrenType } from '@core/types';

// Style Imports
import '@/app/globals.css';

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css';

export const metadata = {
  title: 'MEDISUR',
  description: 'Sistema web de gestión del Centro Médico de Especialidades MEDISUR',
  manifest: '/manifest.webmanifest',
};

const RootLayout = ({ children }: ChildrenType) => {
  // Vars
  const direction = 'ltr';

  return (
    <html lang='es' suppressHydrationWarning id='__next' dir={direction}>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript attribute='class' />
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
