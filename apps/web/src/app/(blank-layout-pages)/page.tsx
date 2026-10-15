import type { Metadata } from 'next';

import Landing from '@/views/landing/Landing';

export const metadata: Metadata = {
  title: 'MEDISUR | Centro Médico de Especialidades',
  description:
    'Conoce las especialidades y los profesionales del Centro Médico de Especialidades MEDISUR. Crea tu cuenta de paciente y consulta información sobre nuestros servicios.',
};

export default function HomePage() {
  return <Landing />;
}
