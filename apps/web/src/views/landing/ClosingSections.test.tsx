import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContactSection from './ContactSection';
import FinalCtaSection from './FinalCtaSection';

describe('Landing final CTA and institutional contact', () => {
  it('directs the final CTA to the existing patient registration route without promising current bookings', () => {
    const html = renderToStaticMarkup(<FinalCtaSection />);
    expect(html).toContain('Agenda tu atención médica de forma sencilla');
    expect(html).toMatch(/href="\/register"[^>]*>Crear una cuenta/);
    expect(html).toContain('reservas en línea aún no están habilitadas');
    expect(html).toContain('aria-labelledby="cta-title"');
  });

  it('shows an honest location placeholder without invented contact data or third-party requests', () => {
    const html = renderToStaticMarkup(<ContactSection contact={{}} />);
    expect(html).toContain('id="contacto"');
    expect(html).toContain('¿Dónde encontrarnos?');
    expect(html).toContain('información oficial');
    expect(html).toContain('La ubicación oficial se publicará próximamente.');
    expect(html).not.toMatch(/tel:|mailto:|<iframe|<form|maps.google|google.com\/maps/);
  });

  it('uses the institutionally supplied address, phone and lazy official map without publishing unconfirmed fields', () => {
    const html = renderToStaticMarkup(<ContactSection />);
    expect(html).toContain('Av. Murillo Nro. 77');
    expect(html).toContain('62-45655');
    expect(html).toContain('href="tel:6245655"');
    expect(html).toContain('https://maps.app.goo.gl/zw1hVJUyy7e5hBHh6');
    expect(html).toContain('title="Ubicación del Centro Médico de Especialidades MEDISUR"');
    expect(html).toContain('Cómo llegar');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('https://www.google.com/maps/embed?pb=');
    expect(html).not.toMatch(/mailto:|Horarios de atención|Correo institucional/);
  });

  it('renders only provided institutional details and usable contact links', () => {
    // Test-only fixture; these values are never configured in production.
    const html = renderToStaticMarkup(
      <ContactSection
        contact={{
          address: 'Dirección institucional validada',
          phone: '+591 20000000',
          email: 'centro@example.test',
          hours: 'Horario institucional validado',
          mapsUrl: 'https://example.test/mapa-oficial',
        }}
      />,
    );
    expect(html).toContain('Dirección institucional validada');
    expect(html).toContain('Horario institucional validado');
    expect(html).toContain('href="tel:+59120000000"');
    expect(html).toContain('href="mailto:centro@example.test"');
    expect(html).toContain('href="https://example.test/mapa-oficial"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('abre otra pestaña');
    expect(html).toContain('<address');
    expect(html).not.toMatch(/<iframe|<form/);
  });

  it('omits undefined fields instead of rendering fake links', () => {
    const html = renderToStaticMarkup(<ContactSection contact={{ address: 'Dirección institucional validada' }} />);
    expect(html).toContain('Dirección institucional validada');
    expect(html).not.toMatch(/tel:|mailto:|Horarios de atención|Cómo llegar/);
  });
});
