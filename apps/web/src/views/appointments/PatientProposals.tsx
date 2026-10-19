'use client';

import { useEffect, useState } from 'react';

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

export default function PatientProposals({ idAppointment }: { idAppointment: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<PaginationQuery>({ page: 1, limit: 10 });
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<{ key: string; page?: ProposalsPage; error?: string } | null>(null);
  const key = `${idAppointment}/${JSON.stringify(query)}/${refresh}`;
  const current = response?.key === key ? response : null;
  useEffect(() => {
    if (!open) return;
    let active = true;
    appointmentsService
      .patientProposals(idAppointment, query)
      .then((page) => {
        if (active) setResponse({ key, page });
      })
      .catch((failure: unknown) => {
        if (active) setResponse({ key, error: getApiErrorMessage(failure) });
      });
    return () => {
      active = false;
    };
  }, [open, idAppointment, query, key]);
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
        onClose={() => setOpen(false)}
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
                    </Stack>
                  ))}
                  <ListPagination query={query} meta={current.page.meta} onChange={setQuery} />
                </>
              )
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
