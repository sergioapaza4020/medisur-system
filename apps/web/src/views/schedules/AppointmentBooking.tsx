'use client';

import { useRef, useState } from 'react';

import { isAxiosError } from 'axios';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

import type { AvailabilityBlock } from '@/types/availability';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import type { BookingPatient } from '@/types/booking-patient';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { displayDate } from './availabilityDates';

export default function AppointmentBooking({
  block,
  onResult,
  bookingFor,
}: {
  block: AvailabilityBlock;
  bookingFor?: BookingPatient;
  onResult: (success: boolean, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function reserve() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const appointment = bookingFor
        ? await appointmentsService.createForPatient(block, bookingFor.idUser)
        : await appointmentsService.create(block);
      setOpen(false);
      onResult(
        true,
        `Cita #${appointment.idAppointment} reservada para el ${displayDate(block.date, { day: 'numeric', month: 'long', year: 'numeric' })}, de ${block.startTime.slice(0, 5)} a ${block.endTime.slice(0, 5)} (hora de Bolivia).`,
      );
    } catch (cause) {
      const unavailable = isAxiosError(cause) && [404, 409].includes(cause.response?.status ?? 0);
      const message = unavailable
        ? bookingFor && isAxiosError(cause) && cause.response?.data?.message
          ? getApiErrorMessage(cause)
          : 'El horario cambió o ya no está disponible. Selecciona otro horario.'
        : 'No fue posible confirmar la reserva. Consulta la disponibilidad antes de volver a intentarlo.';
      if (unavailable) {
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
      <Button
        variant='outlined'
        onClick={() => setOpen(true)}
        aria-label={`Reservar de ${block.startTime.slice(0, 5)} a ${block.endTime.slice(0, 5)}`}
      >
        {block.startTime.slice(0, 5)}–{block.endTime.slice(0, 5)} · Reservar
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        aria-labelledby={`booking-${block.idSchedule}`}
      >
        <DialogTitle id={`booking-${block.idSchedule}`}>Confirmar reserva de cita</DialogTitle>
        <DialogContent>
          <Typography>
            {displayDate(block.date, { day: 'numeric', month: 'long', year: 'numeric' })}, {block.startTime.slice(0, 5)}
            –{block.endTime.slice(0, 5)} (hora de Bolivia).
          </Typography>
          <Typography>
            {bookingFor
              ? `Reserva administrativa en nombre de ${bookingFor.name} ${bookingFor.lastname}, documento ${bookingFor.ci}.`
              : 'Se reservará el bloque completo para tu cuenta de paciente.'}
          </Typography>
          {error && <Alert severity='error'>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Volver
          </Button>
          <Button variant='contained' disabled={busy} onClick={() => void reserve()}>
            {busy ? 'Reservando…' : 'Confirmar reserva'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
