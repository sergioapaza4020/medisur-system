'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { appointmentsService } from '@/services/appointments/appointmentsService';
import type { AvailabilityBlock, AvailabilityPage } from '@/types/availability';
import type { ProposalAvailabilityQuery } from '@/types/rescheduling-proposal';
import type { DoctorAppointment } from '@/types/doctor-agenda';
import ListPagination from '@/components/pagination/ListPagination';
import AvailabilitySlots from '@/views/schedules/AvailabilitySlots';
import { boliviaToday } from '@/views/schedules/availabilityDates';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function ProposeRescheduling({
  appointment,
  onResult,
}: {
  appointment: DoctorAppointment;
  onResult: (success: boolean, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<ProposalAvailabilityQuery>(() => ({ date: boliviaToday(), page: 1, limit: 10 }));
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<{ key: string; page?: AvailabilityPage; error?: string } | null>(null);
  const [selected, setSelected] = useState<AvailabilityBlock | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const key = `${appointment.idAppointment}/${JSON.stringify(query)}/${refresh}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    if (!open || !query.date) return;
    let active = true;
    appointmentsService
      .reschedulingAvailability(appointment.idAppointment, query)
      .then((page) => {
        if (active) setResponse({ key, page });
      })
      .catch((failure: unknown) => {
        if (active) setResponse({ key, error: getApiErrorMessage(failure) });
      });
    return () => {
      active = false;
    };
  }, [open, appointment.idAppointment, query, key]);
  async function submit() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await appointmentsService.proposeRescheduling(appointment.idAppointment, selected);
      setOpen(false);
      onResult(true, 'Propuesta pendiente creada. La cita original conserva su fecha y horario.');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setSelected(null);
      setRefresh((value) => value + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (appointment.status !== 'CANCELLED') return null;
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setSelected(null);
          setError('');
          setRefresh((value) => value + 1);
        }}
      >
        Proponer reprogramación
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth='sm'
        aria-labelledby='rescheduling-title'
      >
        <DialogTitle id='rescheduling-title'>Proponer una nueva atención</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Paciente: {appointment.patient.name} {appointment.patient.lastname} · {appointment.specialty.name}
            </Typography>
            <Typography>
              Original: {appointment.date}, {appointment.startTime.slice(0, 5)}–{appointment.endTime.slice(0, 5)}{' '}
              (Bolivia).
            </Typography>
            <Alert severity='info'>
              La propuesta quedará pendiente. No cambia la cita original ni reserva el horario; su disponibilidad deberá
              confirmarse al aceptar.
            </Alert>
            <TextField
              label='Nueva fecha'
              type='date'
              value={query.date}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: boliviaToday() } }}
              onChange={(event) => {
                setQuery({ ...query, date: event.target.value, page: 1 });
                setSelected(null);
              }}
            />
            {!query.date ? (
              <Typography>Selecciona una fecha.</Typography>
            ) : !current ? (
              <CircularProgress aria-label='Consultando horarios para propuesta' />
            ) : current.error ? (
              <Alert
                severity='error'
                action={<Button onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button>}
              >
                {current.error}
              </Alert>
            ) : (
              current.page && (
                <>
                  {current.page.data.length === 0 ? (
                    <Typography>No hay horarios disponibles para esta fecha.</Typography>
                  ) : (
                    <AvailabilitySlots
                      date={query.date}
                      blocks={current.page.data}
                      onSelect={busy ? undefined : setSelected}
                    />
                  )}
                  <ListPagination
                    query={query}
                    meta={current.page.meta}
                    disabled={busy}
                    onChange={(pagination) => {
                      setQuery({ ...query, ...pagination });
                      setSelected(null);
                    }}
                  />
                </>
              )
            )}
            {selected && (
              <Typography>
                Nuevo horario: {selected.date}, {selected.startTime.slice(0, 5)}–{selected.endTime.slice(0, 5)}{' '}
                (Bolivia).
              </Typography>
            )}
            {error && <Alert severity='error'>{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Volver
          </Button>
          <Button disabled={busy || !selected} variant='contained' onClick={() => void submit()}>
            {busy ? 'Creando propuesta…' : 'Confirmar propuesta'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
