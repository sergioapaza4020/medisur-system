'use client';

import { useRef, useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

import { useAuth } from '@/components/auth/AuthGuard';
import { encountersService } from '@/services/encounters/encountersService';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { DoctorAppointment } from '@/types/doctor-agenda';

export default function RegisterEncounter({ appointment }: { appointment?: DoctorAppointment }) {
  const { user, hasPermission } = useAuth();
  if (!user || !hasPermission('encounter.create')) return null;
  return <EncounterForm key={`${user.idUser}/${appointment?.idAppointment ?? 'none'}`} appointment={appointment} />;
}

function EncounterForm({ appointment }: { appointment?: DoctorAppointment }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [idPatient, setIdPatient] = useState('');
  const [idSpecialty, setIdSpecialty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const [observedNow] = useState(() => Date.now());
  if (
    appointment &&
    (appointment.status !== 'RESERVED' ||
      Date.parse(`${appointment.date}T${appointment.startTime}-04:00`) > observedNow)
  )
    return null;

  async function save() {
    if (inFlight.current) return;
    if (!summary.trim() || summary.trim().length > 10000) {
      setError('Escribe un resumen de entre 1 y 10000 caracteres');
      return;
    }
    if (
      !appointment &&
      ![idPatient, idSpecialty].every((value) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)))
    ) {
      setError('Indica identificadores válidos de paciente y especialidad');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await encountersService.create({
        ...(appointment
          ? { idAppointment: appointment.idAppointment }
          : { idPatient: Number(idPatient), idSpecialty: Number(idSpecialty) }),
        summary: summary.trim(),
      });
      setSummary('');
      setIdPatient('');
      setIdSpecialty('');
      setOpen(false);
      setSuccess('Atención registrada correctamente');
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setSuccess('');
          setError('');
          setOpen(true);
        }}
      >
        {appointment ? 'Registrar atención' : 'Registrar atención sin cita'}
      </Button>
      {success && <Alert severity='success'>{success}</Alert>}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setSummary('');
          }
        }}
        fullWidth
        maxWidth='sm'
        aria-labelledby='encounter-title'
      >
        <DialogTitle id='encounter-title'>Registrar atención médica</DialogTitle>
        <DialogContent>
          {appointment ? (
            <Typography>
              {appointment.patient.name} {appointment.patient.lastname} · {appointment.specialty.name}
            </Typography>
          ) : (
            <>
              <TextField
                label='Identificador del paciente'
                required
                fullWidth
                value={idPatient}
                disabled={busy}
                onChange={(event) => setIdPatient(event.target.value)}
                margin='normal'
              />
              <TextField
                label='Identificador de especialidad asignada'
                required
                fullWidth
                value={idSpecialty}
                disabled={busy}
                onChange={(event) => setIdSpecialty(event.target.value)}
                margin='normal'
              />
            </>
          )}
          <Typography variant='body2'>
            Se registrará con tu perfil médico y la fecha y hora actuales. La atención se conservará como un nuevo
            registro.
          </Typography>
          <TextField
            label='Resumen de atención'
            required
            multiline
            minRows={5}
            fullWidth
            value={summary}
            disabled={busy}
            onChange={(event) => setSummary(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 10000 } }}
            margin='normal'
          />
          {error && <Alert severity='error'>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setSummary('');
            }}
          >
            Volver
          </Button>
          <Button variant='contained' disabled={busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar atención'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
