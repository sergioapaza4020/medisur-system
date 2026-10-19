import { Button, Stack, Typography } from '@mui/material';

import type { AvailabilityBlock } from '@/types/availability';
import AppointmentBooking from './AppointmentBooking';
import { displayDate } from './availabilityDates';

export default function AvailabilitySlots({
  date,
  blocks,
  onReserve,
}: {
  date: string;
  blocks: AvailabilityBlock[];
  onReserve?: (success: boolean, message: string) => void;
}) {
  return (
    <Stack spacing={2} aria-live='polite'>
      <Typography variant='h6' component='h2'>
        {date
          ? displayDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
          : 'Selecciona una fecha disponible'}
      </Typography>
      {date && <Typography>Horarios disponibles (hora de Bolivia)</Typography>}
      <Stack direction='row' useFlexGap flexWrap='wrap' gap={1}>
        {blocks.map((block) =>
          onReserve ? (
            <AppointmentBooking key={`${block.idSchedule}-${block.version}`} block={block} onResult={onReserve} />
          ) : (
            <Button
              key={`${block.idSchedule}-${block.startTime}-${block.endTime}`}
              variant='outlined'
              sx={{ minHeight: 44, cursor: 'default', color: 'text.primary' }}
              aria-label={`Horario disponible de ${block.startTime.slice(0, 5)} a ${block.endTime.slice(0, 5)}`}
            >
              {block.startTime.slice(0, 5)}–{block.endTime.slice(0, 5)}
            </Button>
          ),
        )}
      </Stack>
    </Stack>
  );
}
