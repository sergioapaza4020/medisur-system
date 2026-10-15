import type * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Mui from '@mui/material';

import FaqSection from './FaqSection';

const state = vi.hoisted(() => ({
  expanded: false as string | false,
  handlers: [] as NonNullable<Mui.AccordionProps['onChange']>[],
  summaries: [] as Mui.AccordionSummaryProps[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: () => [
    state.expanded,
    (value: string | false) => {
      state.expanded = value;
    },
  ],
}));
vi.mock('@mui/material', async (original) => {
  const mui = await original<typeof Mui>();

  return {
    ...mui,
    Accordion: (props: Mui.AccordionProps) => {
      state.handlers.push(props.onChange!);
      return <mui.Accordion {...props} />;
    },
    AccordionSummary: (props: Mui.AccordionSummaryProps) => {
      state.summaries.push(props);
      return <mui.AccordionSummary {...props} />;
    },
  };
});

function render() {
  state.handlers = [];
  state.summaries = [];
  return renderToStaticMarkup(<FaqSection />);
}
beforeEach(() => {
  state.expanded = false;
});

describe('Public FAQ', () => {
  it('renders five accessible summaries with stable controls and honest availability', () => {
    const html = render();
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(5);
    expect(html.match(/aria-controls="faq-/g)).toHaveLength(5);
    expect(html).toContain('¿Necesito una cuenta para reservar una cita?');
    expect(html).toContain('¿Cómo puedo reservar una cita?');
    expect(html).toContain('¿Puedo cancelar o reprogramar mi cita?');
    expect(html).toContain('¿Cómo puedo consultar mis próximas citas?');
    expect(html).toContain('¿Qué hago si olvidé mi contraseña?');
    expect(html).toContain('todavía no está disponible');
    expect(html).toContain('recuperación automática por correo aún no está habilitada');
  });

  it('expands, switches and collapses a single question through MUI onChange', () => {
    render();
    const event = {} as React.SyntheticEvent;
    state.handlers[0](event, true);
    expect(render().match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(state.expanded).toBe('cuenta');
    state.handlers[2](event, true);
    expect(render().match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(state.expanded).toBe('cambios');
    state.handlers[2](event, false);
    expect(render().match(/aria-expanded="false"/g)).toHaveLength(5);
  });

  it('switches Add/Close icons and the summary title color while retaining accessible controls', () => {
    let html = render();
    expect(html.match(/data-testid="AddIcon"/g)).toHaveLength(5);
    expect(html).not.toContain('data-testid="CloseIcon"');
    expect(state.summaries[0].sx).toMatchObject({ color: 'text.primary' });
    state.handlers[0]({} as React.SyntheticEvent, true);
    html = render();
    expect(html.match(/data-testid="CloseIcon"/g)).toHaveLength(1);
    expect(html.match(/data-testid="AddIcon"/g)).toHaveLength(4);
    expect(state.summaries[0].sx).toMatchObject({ color: 'primary.main' });
    expect(state.summaries[1].sx).toMatchObject({ color: 'text.primary' });
    expect(html).toContain('aria-controls="faq-cuenta-answer"');
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    state.handlers[0]({} as React.SyntheticEvent, false);
    html = render();
    expect(html.match(/data-testid="AddIcon"/g)).toHaveLength(5);
    expect(state.summaries[0].sx).toMatchObject({ color: 'text.primary' });
  });
});
