import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { doctorsService } from '@/services/doctors/doctorsService';
import { specialtiesService } from '@/services/specialties/specialtiesService';
import type { PublicDoctor } from '@/types/doctors';

import { SpecialtiesSection, SpecialistsSection } from './CatalogSections';
import { HowItWorksSection, BenefitsSection } from './InformationalSections';
import { SpecialtiesDataSection, SpecialistsDataSection } from './LandingDataSections';

vi.mock('@/services/doctors/doctorsService', () => ({ doctorsService: { publicPage: vi.fn() } }));
vi.mock('@/services/specialties/specialtiesService', () => ({ specialtiesService: { publicPage: vi.fn() } }));

describe('Landing phase 2 content', () => {
  it.each([null, undefined])('keeps initials when avatarUrl is %s', (avatarUrl) => {
    const html = renderToStaticMarkup(
      <SpecialistsSection
        state={{
          status: 'ready',
          items: [{ idDoctor: 1, name: 'Ana', lastname: 'Perez', specialties: [], avatarUrl }],
        }}
      />,
    );
    expect(html).toContain('AP');
    expect(html).not.toContain('<img');
  });

  it('renders each API avatar URL with its matching doctor and uses the new URL after replacement', () => {
    const doctors = [
      {
        idDoctor: 1,
        name: 'Ana',
        lastname: 'Perez',
        specialties: [],
        avatarUrl: 'https://public.example.test/first.png',
      },
      {
        idDoctor: 2,
        name: 'Luis',
        lastname: 'Lopez',
        specialties: [],
        avatarUrl: 'https://public.example.test/second.png',
      },
    ];
    const render = () => renderToStaticMarkup(<SpecialistsSection state={{ status: 'ready', items: doctors }} />);
    const html = render();
    expect(html).toContain('src="https://public.example.test/first.png"');
    expect(html).toContain('alt="Foto de Ana Perez"');
    expect(html).toContain('src="https://public.example.test/second.png"');
    expect(html).toContain('alt="Foto de Luis Lopez"');
    doctors[0].avatarUrl = 'https://public.example.test/replaced.webp';
    const updated = render();
    expect(updated).toContain('src="https://public.example.test/replaced.webp"');
    expect(updated).not.toContain('first.png');
    expect(updated).toContain('second.png');
  });
  it('renders public specialties and names only, without administrative fields', () => {
    const html = renderToStaticMarkup(
      <SpecialtiesSection state={{ status: 'ready', items: [{ idSpecialty: 1, name: 'Cardiología' }] }} />,
    );
    expect(html).toContain('Cardiología');
    expect(html).toContain('id="especialidades"');
    expect(html).not.toMatch(/isActive|idSpecialty|Editar|Eliminar/);
  });

  it('renders specialist initials, name and specialties without private fields even if extra data arrives', () => {
    const doctor = {
      idDoctor: 90123,
      name: 'Ana',
      lastname: 'Pérez',
      specialties: [{ idSpecialty: 1, name: 'Cardiología' }],
      email: 'private@example.com',
      ci: '123456789',
      roles: ['DOCTOR'],
      password: 'secret',
    };
    const html = renderToStaticMarkup(
      <SpecialistsSection state={{ status: 'ready', items: [doctor as PublicDoctor] }} />,
    );
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Cardiología');
    expect(html).toContain('AP');
    expect(html).not.toMatch(/private@example.com|123456789|DOCTOR|secret|90123/);
  });

  it.each(['specialties', 'specialists'])('handles loading, error and empty %s independently', (section) => {
    const Section = section === 'specialties' ? SpecialtiesSection : SpecialistsSection;
    expect(renderToStaticMarkup(<Section state={{ status: 'loading' }} />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<Section state={{ status: 'error' }} />)).toContain('No pudimos cargar');
    expect(renderToStaticMarkup(<Section state={{ status: 'ready', items: [] }} />)).toContain(
      'disponibles actualmente.',
    );
  });

  it('shows the four steps in order and makes pending reservation availability clear', () => {
    const html = renderToStaticMarkup(<HowItWorksSection />);
    const titles = ['Crea tu cuenta', 'Elige una especialidad', 'Selecciona un médico', 'Reserva tu cita'];
    const positions = titles.map((title) => html.indexOf(title));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.match(/<li\b/g)).toHaveLength(4);
    expect(html).toContain('aún no están habilitadas');
  });

  it('shows the approved benefits with moderate descriptions', () => {
    const html = renderToStaticMarkup(<BenefitsSection />);
    for (const title of [
      'Especialistas calificados',
      'Atención organizada de citas',
      'Atención cercana',
      'Acceso seguro',
    ])
      expect(html).toContain(title);
    expect(html).not.toMatch(/100% seguro|los mejores|Robust workflow|User friendly/);
  });

  it('requests bounded first pages and renders real data from each existing domain service', async () => {
    vi.mocked(specialtiesService.publicPage).mockResolvedValueOnce({
      status: true,
      statusCode: 200,
      meta: { page: 1, limit: 8, total: 1, totalPages: 1 },
      data: [{ idSpecialty: 1, name: 'Cardiología' }],
    });
    vi.mocked(doctorsService.publicPage).mockResolvedValueOnce({
      status: true,
      statusCode: 200,
      meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
      data: [
        {
          idDoctor: 2,
          name: 'Ana',
          lastname: 'Pérez',
          specialties: [],
          avatarUrl: 'https://public.example.test/from-api.png',
        },
      ],
    });
    expect(renderToStaticMarkup(await SpecialtiesDataSection())).toContain('Cardiología');
    const specialists = renderToStaticMarkup(await SpecialistsDataSection());
    expect(specialists).toContain('Ana Pérez');
    expect(specialists).toContain('src="https://public.example.test/from-api.png"');
    expect(specialtiesService.publicPage).toHaveBeenCalledWith({ page: 1, limit: 8 });
    expect(doctorsService.publicPage).toHaveBeenCalledWith({ page: 1, limit: 6 });
  });

  it('isolates service failures and never displays technical errors', async () => {
    vi.mocked(specialtiesService.publicPage).mockRejectedValueOnce(new Error('postgres secret'));
    vi.mocked(doctorsService.publicPage).mockRejectedValueOnce(new Error('token expired'));
    const html =
      renderToStaticMarkup(await SpecialtiesDataSection()) + renderToStaticMarkup(await SpecialistsDataSection());
    expect(html.match(/No pudimos cargar/g)).toHaveLength(2);
    expect(html).not.toMatch(/postgres|secret|token expired/);
  });
});
