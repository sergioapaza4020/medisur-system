'use client';

import { useState } from 'react';

import { Accordion, AccordionDetails, AccordionSummary, Container, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';

import { sectionSx } from './landingStyles';

const questions = [
  {
    id: 'cuenta',
    question: '¿Necesito una cuenta para reservar una cita?',
    answer:
      'El proceso previsto requiere una cuenta de paciente. Ya puedes crearla; las reservas en línea aún no están habilitadas.',
  },
  {
    id: 'reserva',
    question: '¿Cómo puedo reservar una cita?',
    answer:
      'Cuando se habilite el módulo de citas, el proceso será elegir una especialidad, un médico y un horario disponible. Por ahora puedes consultar las especialidades y los profesionales de MEDISUR.',
  },
  {
    id: 'cambios',
    question: '¿Puedo cancelar o reprogramar mi cita?',
    answer:
      'La cancelación y reprogramación en línea forman parte del módulo de citas pendiente de habilitación. Sus condiciones se informarán cuando esté disponible.',
  },
  {
    id: 'proximas',
    question: '¿Cómo puedo consultar mis próximas citas?',
    answer: 'La consulta de próximas citas se incorporará al módulo de citas. Esta función todavía no está disponible.',
  },
  {
    id: 'contrasena',
    question: '¿Qué hago si olvidé mi contraseña?',
    answer:
      'Solicita orientación al personal de MEDISUR para recuperar el acceso. No compartas tu contraseña; la recuperación automática por correo aún no está habilitada.',
  },
];

export default function FaqSection() {
  const [expanded, setExpanded] = useState<string | false>(false);

  return (
    <Container component='section' id='preguntas-frecuentes' aria-labelledby='faq-title' maxWidth='md' sx={sectionSx}>
      <Typography component='h2' variant='h3' id='faq-title' align='center' sx={{ mb: 10 }}>
        Preguntas frecuentes
      </Typography>
      {questions.map(({ id, question, answer }) => (
        <Accordion
          key={id}
          expanded={expanded === id}
          onChange={(_, isExpanded) => setExpanded(isExpanded ? id : false)}
          sx={{ mb: 3, border: 1, borderColor: expanded === id ? 'primary.main' : 'divider', boxShadow: 'none' }}
          slotProps={{ heading: { component: 'h3' } }}
        >
          <AccordionSummary
            id={`faq-${id}-question`}
            aria-controls={`faq-${id}-answer`}
            expandIcon={expanded === id ? <Close aria-hidden='true' /> : <Add aria-hidden='true' />}
            sx={{
              flexDirection: 'row',
              gap: 3,
              color: expanded === id ? 'primary.main' : 'text.primary',
              '& .MuiAccordionSummary-content': { flex: 1, minWidth: 0 },
              '& .MuiAccordionSummary-expandIconWrapper': {
                flexShrink: 0,
                color: 'inherit',
                '&.Mui-expanded': { transform: 'none' },
              },
            }}
          >
            <Typography component='span' fontWeight={500}>
              {question}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography color='text.secondary'>{answer}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Container>
  );
}
