'use client';

import { useRef, useState } from 'react';

import { isAxiosError } from 'axios';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

import type { PatientAppointment } from '@/types/appointments';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { displayDate } from '@/views/schedules/availabilityDates';

export default function CancelAppointment({
  appointment,
  onResult,
}: {
  appointment: PatientAppointment;
  onResult: (success: boolean, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const [observedNow] = useState(() => Date.now());
  // Civil time of Bolivia; the API remains authoritative if time/state changes after display.
  const future = Date.parse(`${appointment.date}T${appointment.startTime}-04:00`) > observedNow;
  if (appointment.status !== 'RESERVED' || !future) return null;
  async function cancel() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await appointmentsService.cancelMine(appointment.idAppointment);
      setOpen(false);
      onResult(true, 'Cita cancelada correctamente. Puedes consultar nuevamente la disponibilidad.');
    } catch (failure) {
      const message = getApiErrorMessage(failure);
      if (isAxiosError(failure) && [404, 409].includes(failure.response?.status ?? 0)) {
        setOpen(false);
        onResult(false, message);
      } else setError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button color='error' onClick={() => setOpen(true)}>
        Cancelar cita
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        aria-labelledby={`cancel-${appointment.idAppointment}`}
      >
        <DialogTitle id={`cancel-${appointment.idAppointment}`}>Confirmar cancelación</DialogTitle>
        <DialogContent>
          <Typography>
            {appointment.doctor.name} {appointment.doctor.lastname} · {appointment.specialty.name}
          </Typography>
          <Typography>
            {displayDate(appointment.date, { day: 'numeric', month: 'long', year: 'numeric' })},{' '}
            {appointment.startTime.slice(0, 5)}–{appointment.endTime.slice(0, 5)} (hora de Bolivia).
          </Typography>
          <Typography>
            La cita se conservará como cancelada y el horario podrá reservarse nuevamente si sigue disponible.
          </Typography>
          {error && <Alert severity='error'>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Volver
          </Button>
          <Button color='error' variant='contained' disabled={busy} onClick={() => void cancel()}>
            {busy ? 'Cancelando…' : 'Confirmar cancelación'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
