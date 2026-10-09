// Type Imports
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { ChildrenType } from '@core/types';

// Layout Imports
import LayoutWrapper from '@layouts/LayoutWrapper';
import VerticalLayout from '@layouts/VerticalLayout';

// Component Imports
import Providers from '@components/Providers';
import Navigation from '@components/layout/vertical/Navigation';
import Navbar from '@components/layout/vertical/Navbar';
import VerticalFooter from '@components/layout/vertical/Footer';
import AuthGuard from '@components/auth/AuthGuard';

const Layout = async ({ children }: ChildrenType) => {
  // Vars
  const direction = 'ltr';
  const cookieStore = await cookies();

  if (!cookieStore.has('accessToken') && !cookieStore.has('refreshToken')) redirect('/login');

  return (
    <Providers direction={direction}>
      <AuthGuard>
        <LayoutWrapper
          verticalLayout={
            <VerticalLayout navigation={<Navigation />} navbar={<Navbar />} footer={<VerticalFooter />}>
              {children}
            </VerticalLayout>
          }
        />
      </AuthGuard>
    </Providers>
  );
};

export default Layout;
