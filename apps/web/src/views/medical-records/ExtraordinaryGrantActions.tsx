'use client';

import { useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { medicalRecordsService } from '@/services/medical-records/medicalRecordsService';
import type { BookingPatient } from '@/types/booking-patient';
import type { ExtraordinaryGrant } from '@/types/medical-records';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import ExtraordinaryPersonPicker from './ExtraordinaryPersonPicker';

export function CreateGrant({ idActor, onCreated }: { idActor: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<BookingPatient | null>(null);
  const [beneficiary, setBeneficiary] = useState<BookingPatient | null>(null);
  const [type, setType] = useState<ExtraordinaryGrant['type']>('AUTHORIZATION');
  const [hours, setHours] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  function close() {
    if (!busy) {
      setOpen(false);
      setPatient(null);
      setBeneficiary(null);
      setReason('');
      setError('');
    }
  }
  async function save() {
    if (inFlight.current) return;
    if (
      !patient ||
      !beneficiary ||
      beneficiary.idUser === idActor ||
      reason.trim().length < 10 ||
      reason.trim().length > 1000
    ) {
      setError('Selecciona paciente y otro médico beneficiario e indica un motivo de 10 a 1000 caracteres.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await medicalRecordsService.grant({
        idPatient: patient.idUser,
        idBeneficiary: beneficiary.idUser,
        type,
        reason: reason.trim(),
        expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
      });
      setOpen(false);
      setPatient(null);
      setBeneficiary(null);
      setReason('');
      onCreated();
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant='contained' onClick={() => setOpen(true)}>
        Conceder acceso extraordinario
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth='sm' aria-labelledby='grant-title'>
        <DialogTitle id='grant-title'>Autorizar lectura clínica temporal</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Verifica la identidad y la autorización válida del paciente o la situación de emergencia. Esta acción
              concede lectura a un médico concreto; no permite consultar el contenido desde esta pantalla.
            </Typography>
            <ExtraordinaryPersonPicker kind='patients' selected={patient} onSelect={setPatient} disabled={busy} />
            <ExtraordinaryPersonPicker
              kind='beneficiaries'
              selected={beneficiary}
              onSelect={setBeneficiary}
              disabled={busy}
            />
            <TextField
              select
              label='Causa del acceso'
              value={type}
              disabled={busy}
              onChange={(event) => setType(event.target.value as ExtraordinaryGrant['type'])}
            >
              <MenuItem value='AUTHORIZATION'>Autorización válida</MenuItem>
              <MenuItem value='EMERGENCY'>Emergencia</MenuItem>
            </TextField>
            <TextField
              select
              label='Vigencia'
              value={hours}
              disabled={busy}
              onChange={(event) => setHours(Number(event.target.value))}
            >
              {[1, 4, 8, 24].map((value) => (
                <MenuItem key={value} value={value}>
                  {value} {value === 1 ? 'hora' : 'horas'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label='Motivo y constancia de la causa'
              required
              multiline
              minRows={3}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              helperText='Explica la autorización o emergencia. No copies el historial ni datos clínicos innecesarios.'
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
            {error && <Alert severity='error'>{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={close}>
            Cancelar
          </Button>
          <Button disabled={busy} variant='contained' onClick={() => void save()}>
            {busy ? 'Guardando autorización…' : 'Confirmar concesión'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function RevokeGrant({ grant, onRevoked }: { grant: ExtraordinaryGrant; onRevoked: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function revoke() {
    if (inFlight.current) return;
    if (reason.trim().length < 10 || reason.trim().length > 1000) {
      setError('Indica un motivo de revocación de 10 a 1000 caracteres');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await medicalRecordsService.revoke(grant.idGrant, reason.trim());
      setOpen(false);
      setReason('');
      onRevoked();
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button color='error' onClick={() => setOpen(true)}>
        Revocar autorización
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setReason('');
          }
        }}
        fullWidth
        maxWidth='sm'
        aria-labelledby='revoke-grant-title'
      >
        <DialogTitle id='revoke-grant-title'>Confirmar revocación</DialogTitle>
        <DialogContent>
          <Typography>
            {grant.patient.name} {grant.patient.lastname} · Médico: {grant.beneficiary.name}{' '}
            {grant.beneficiary.lastname}
          </Typography>
          <TextField
            label='Motivo de revocación'
            required
            multiline
            fullWidth
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            margin='normal'
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          {error && <Alert severity='error'>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setReason('');
            }}
          >
            Volver
          </Button>
          <Button disabled={busy} color='error' onClick={() => void revoke()}>
            {busy ? 'Revocando…' : 'Confirmar revocación'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
