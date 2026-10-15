import type * as React from 'react';
import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Mui from '@mui/material';

import HomePage, { metadata } from '@/app/(blank-layout-pages)/page';

import LandingNavbar from './LandingNavbar';
import HeroSection from './HeroSection';
import { SpecialtiesSection, SpecialistsSection } from './CatalogSections';

vi.mock('./LandingDataSections', () => ({
  SpecialtiesDataSection: () => <SpecialtiesSection state={{ status: 'ready', items: [] }} />,
  SpecialistsDataSection: () => <SpecialistsSection state={{ status: 'ready', items: [] }} />,
}));

const menu = vi.hoisted(() => ({
  open: false,
  toggle: undefined as (() => void) | undefined,
  close: undefined as (() => void) | undefined,
}));

vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: () => [
    menu.open,
    (value: boolean) => {
      menu.open = value;
    },
  ],
}));
vi.mock('@components/layout/shared/ModeDropdown', () => ({ default: () => null }));
vi.mock('@mui/material', async (original) => {
  const mui = await original<typeof Mui>();

  return {
    ...mui,
    Drawer: ({ open, children, onClose }: { open: boolean; children: ReactNode; onClose: () => void }) => {
      menu.close = onClose;
      return open ? <div role='dialog'>{children}</div> : null;
    },
    IconButton: ({
      children,
      onClick,
      'aria-label': label,
      'aria-expanded': expanded,
    }: {
      children: ReactNode;
      onClick: () => void;
      'aria-label': string;
      'aria-expanded'?: boolean;
    }) => {
      if (label.startsWith('Abrir')) menu.toggle = onClick;
      if (label.startsWith('Cerrar')) menu.close = onClick;
      return (
        <button aria-label={label} aria-expanded={expanded} onClick={onClick}>
          {children}
        </button>
      );
    },
  };
});

beforeEach(() => {
  menu.open = false;
});

describe('Public MEDISUR landing', () => {
  it('renders / without a session, with one h1 and all public landmarks', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const element of ['header', 'nav', 'main', 'footer']) expect(html).toContain(`<${element}`);
    expect(html).toContain('MEDISUR, inicio');
    expect(html).toContain('logo.png');
    expect(html).toContain('Centro médico de especialidades');
    expect(html).toContain('Saltar al contenido principal');
    expect(html).toContain(`© ${new Date().getFullYear()} MEDISUR`);
    expect(html).not.toMatch(/Landify|href="\/dashboard"/);
  });

  it('uses the actual public auth routes in both hero CTAs', () => {
    const html = renderToStaticMarkup(<HeroSection />);

    expect(html).toMatch(/href="\/register"[^>]*>Crear cuenta/);
    expect(html).toMatch(/href="\/login"[^>]*>Iniciar sesión/);
    expect(html).toContain('Encuentra especialistas y gestiona tus citas de manera sencilla.');
  });

  it('connects every navbar and footer anchor to exactly one section', () => {
    const html = renderToStaticMarkup(<HomePage />);

    for (const id of ['especialidades', 'como-funciona', 'especialistas', 'preguntas-frecuentes', 'contacto']) {
      expect(html.match(new RegExp(`href="#${id}"`, 'g'))).toHaveLength(2);
      expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
    expect(html.match(/href="\/login"/g)).toHaveLength(3);
    expect(html.match(/href="\/register"/g)).toHaveLength(4);
  });

  it('preserves the approved full section order, public SEO and clean production content', () => {
    const html = renderToStaticMarkup(<HomePage />);
    const titles = [
      'landing-title',
      'especialidades-title',
      'como-funciona-title',
      'especialistas-title',
      'beneficios-title',
      'faq-title',
      'cta-title',
      'contacto-title',
    ];
    const positions = titles.map((id) => html.indexOf(`id="${id}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.indexOf('<footer')).toBeGreaterThan(positions.at(-1)!);
    expect(html).not.toMatch(/Landify|lorem ipsum|Robust workflow|User friendly|Jane Cooper|<form/i);
    expect(metadata.title).toBe('MEDISUR | Centro Médico de Especialidades');
    expect(metadata.description).toContain('Centro Médico de Especialidades MEDISUR');
  });

  it('opens and closes the mobile menu, retaining public navigation', () => {
    const render = () => renderToStaticMarkup(<LandingNavbar />);

    expect(render()).toContain('aria-expanded="false"');
    menu.toggle!();
    let html = render();
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="landing-mobile-menu"');
    expect(html).toContain('Navegación móvil');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
    menu.close!();
    html = render();
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="landing-mobile-menu"');
  });
});
