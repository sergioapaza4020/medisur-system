import { Box, Button, Stack, Typography } from '@mui/material';

import { displayDate, monthDates } from './availabilityDates';

export default function AvailabilityCalendar({
  month,
  today,
  dates,
  selectedDate,
  loading,
  onMonthChange,
  onSelect,
}: {
  month: string;
  today: string;
  dates: Set<string>;
  selectedDate: string;
  loading: boolean;
  onMonthChange: (delta: number) => void;
  onSelect: (date: string) => void;
}) {
  const { offset, days } = monthDates(month);
  return (
    <Stack spacing={2} aria-label='Calendario de disponibilidad' aria-busy={loading}>
      <Stack direction='row' alignItems='center' justifyContent='space-between'>
        <Button aria-label='Mes anterior' disabled={month <= today.slice(0, 7)} onClick={() => onMonthChange(-1)}>
          ‹
        </Button>
        <Typography component='h2' variant='h6' aria-live='polite'>
          {displayDate(`${month}-01`, { month: 'long', year: 'numeric' })}
        </Typography>
        <Button aria-label='Mes siguiente' disabled={month === '9999-12'} onClick={() => onMonthChange(1)}>
          ›
        </Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
          <Typography key={day} align='center' variant='caption' color='text.secondary'>
            {day}
          </Typography>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <Box key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const available = !loading && dates.has(date) && date >= today;
          const selected = selectedDate === date;
          return (
            <Button
              key={date}
              disabled={!available}
              aria-pressed={selected}
              aria-label={`${displayDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}, ${date < today ? 'fecha pasada' : available ? 'disponible' : 'sin disponibilidad'}`}
              variant={selected ? 'contained' : 'text'}
              onClick={() => onSelect(date)}
              sx={{
                minWidth: 0,
                minHeight: 44,
                flexDirection: 'column',
                p: 0.5,
                color: available && !selected ? 'text.primary' : undefined,
              }}
            >
              {day}
              <Box
                component='span'
                aria-hidden
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  bgcolor: available ? (selected ? 'primary.contrastText' : 'secondary.main') : 'transparent',
                }}
              />
            </Button>
          );
        })}
      </Box>
      <Typography variant='caption' color='text.secondary'>
        ● Disponible · Selecciona una fecha para ver sus horarios.
      </Typography>
    </Stack>
  );
}
