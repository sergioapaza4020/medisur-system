'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

import ListPagination from '@/components/pagination/ListPagination';
import { appointmentsService } from '@/services/appointments/appointmentsService';
import { proposalStatusLabels, type ProposalsPage } from '@/types/rescheduling-proposal';
import type { PaginationQuery } from '@/types/pagination';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function PatientProposals({
  idAppointment,
  mode = 'patient',
  canRespond = false,
  onResult,
}: {
  idAppointment: number;
  mode?: 'patient' | 'doctor';
  canRespond?: boolean;
  onResult?: (success: boolean, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<{ key: string; page?: ProposalsPage; error?: string } | null>(null);
  const [decision, setDecision] = useState<{ idProposal: number; status: 'ACCEPTED' | 'REJECTED' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inFlight = useRef(false);
  const key = `${mode}/${idAppointment}/${JSON.stringify(query)}/${refresh}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = mode === 'doctor' ? appointmentsService.doctorProposals : appointmentsService.patientProposals;
    load(idAppointment, query)
      .then((page) => {
        if (active) setResponse({ key, page });
      })
      .catch((failure: unknown) => {
        if (active) setResponse({ key, error: getApiErrorMessage(failure) });
      });
    return () => {
      active = false;
    };
  }, [open, idAppointment, query, key, mode]);
  async function respond() {
    if (!decision || inFlight.current || !canRespond || mode !== 'patient') return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await appointmentsService.respondRescheduling(decision.idProposal, decision.status);
      const message =
        result.status === 'ACCEPTED'
          ? `Reprogramación aceptada. Tu nueva cita #${result.resultingAppointmentId} está reservada para ${result.date}, ${result.startTime.slice(0, 5)}–${result.endTime.slice(0, 5)} (Bolivia).`
          : 'Propuesta rechazada. No se ha reservado el horario propuesto.';
      setDecision(null);
      setRefresh((value) => value + 1);
      if (onResult) {
        setOpen(false);
        onResult(true, message);
      } else setSuccess(message);
    } catch (failure) {
      setError(getApiErrorMessage(failure));
      setDecision(null);
      setRefresh((value) => value + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setRefresh((value) => value + 1);
        }}
      >
        Ver propuestas
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth='sm'
        aria-labelledby='patient-proposals-title'
      >
        <DialogTitle id='patient-proposals-title'>Propuestas de reprogramación</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Horarios de Bolivia. Una propuesta pendiente no modifica tu cita ni asegura una nueva reserva.
            </Typography>
            {error && <Alert severity='error'>{error}</Alert>}
            {success && <Alert severity='success'>{success}</Alert>}
            {!current ? (
              <CircularProgress aria-label='Cargando propuestas' />
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
                  {!current.page.data.length && <Typography>No tienes propuestas para esta cita.</Typography>}
                  {current.page.data.map((proposal) => (
                    <Stack key={proposal.idProposal} spacing={1}>
                      <Chip
                        label={proposalStatusLabels[proposal.status]}
                        color={
                          proposal.status === 'PENDING'
                            ? 'warning'
                            : proposal.status === 'ACCEPTED'
                              ? 'success'
                              : 'default'
                        }
                      />
                      <Typography>
                        Original: {proposal.originalDate}, {proposal.originalStartTime.slice(0, 5)}–
                        {proposal.originalEndTime.slice(0, 5)}
                      </Typography>
                      <Typography>
                        Propuesta: {proposal.date}, {proposal.startTime.slice(0, 5)}–{proposal.endTime.slice(0, 5)}
                      </Typography>
                      {proposal.resultingAppointmentId != null && (
                        <Typography>Cita de reemplazo: #{proposal.resultingAppointmentId}</Typography>
                      )}
                      {mode === 'patient' && canRespond && proposal.status === 'PENDING' && (
                        <Stack direction='row' spacing={1}>
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setDecision({ idProposal: proposal.idProposal, status: 'ACCEPTED' });
                              setError('');
                              setSuccess('');
                            }}
                          >
                            Aceptar propuesta
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setDecision({ idProposal: proposal.idProposal, status: 'REJECTED' });
                              setError('');
                              setSuccess('');
                            }}
                          >
                            Rechazar propuesta
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  ))}
                  <ListPagination
                    query={query}
                    meta={current.page.meta}
                    disabled={busy}
                    onChange={(pagination) => {
                      setQuery(pagination);
                      setDecision(null);
                    }}
                  />
                </>
              )
            )}
            {decision && (
              <Stack spacing={1}>
                <Typography>
                  {decision.status === 'ACCEPTED'
                    ? '¿Confirmas la aceptación? Se volverá a validar y reservar el horario propuesto.'
                    : '¿Confirmas el rechazo de esta propuesta?'}
                </Typography>
                <Button disabled={busy} onClick={() => setDecision(null)}>
                  Volver
                </Button>
                <Button disabled={busy} variant='contained' onClick={() => void respond()}>
                  {busy ? 'Guardando respuesta…' : 'Confirmar respuesta'}
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
